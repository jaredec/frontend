// Test endpoint: simulates the check-games cron for a given mock game.
// Never posts to Twitter. Returns the post text that would have been sent.
//
// Usage:
//   GET /api/test-x?homeScore=5&awayScore=3&homeTeamId=147&awayTeamId=111&homeTeamName=Yankees&awayTeamName=Red+Sox&gameType=R
//
// gameType values: R (regular), W (World Series), L (LCS), D (Division Series), F (Wild Card)
//
// Auth: Authorization: Bearer <CRON_SECRET>

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import TwitterApi from 'twitter-api-v2';

// --- TYPES ---

interface ScoreHistory {
  occurrences: number;
  last_game_date: string;
  last_home_team: string;
  last_visitor_team: string;
}

// --- HELPERS (mirrored from check-games) ---

async function getFranchiseTeamIds(supabase: SupabaseClient, teamId: number): Promise<number[]> {
  const { data: franchiseData } = await supabase.from('teams').select('franchise').eq('team_id', teamId).single();
  if (!franchiseData || !franchiseData.franchise) return [teamId];
  const { data: teamIdsData } = await supabase.from('teams').select('team_id').eq('franchise', franchiseData.franchise);
  return teamIdsData?.map(t => Number(t.team_id)) || [teamId];
}

async function checkTrueScorigami(supabase: SupabaseClient, s1: number, s2: number) {
  const win = Math.max(s1, s2);
  const lose = Math.min(s1, s2);
  const { data } = await supabase.from('gamelogs')
    .select('game_id')
    .or(`and(home_score.eq.${win},visitor_score.eq.${lose}),and(home_score.eq.${lose},visitor_score.eq.${win})`)
    .eq('is_negro_league', false)
    .limit(1);
  if (data && data.length > 0) return { isScorigami: false, newCount: 0 };
  const result = await pool.query(`
    SELECT COUNT(DISTINCT CONCAT(GREATEST(home_score, visitor_score), '-', LEAST(home_score, visitor_score)))::int AS count
    FROM gamelogs WHERE is_negro_league = false
  `);
  return { isScorigami: true, newCount: (result.rows[0]?.count ?? 0) + 1 };
}

async function isFranchiseScorigami(supabase: SupabaseClient, franchiseIds: number[], s1: number, s2: number) {
  const ids = `(${franchiseIds.join(',')})`;
  const { data } = await supabase.from('gamelogs').select('game_id').or(
    `and(home_team_id.in.${ids},home_score.eq.${s1},visitor_score.eq.${s2}),` +
    `and(visitor_team_id.in.${ids},visitor_score.eq.${s1},home_score.eq.${s2}),` +
    `and(home_team_id.in.${ids},home_score.eq.${s2},visitor_score.eq.${s1}),` +
    `and(visitor_team_id.in.${ids},visitor_score.eq.${s2},home_score.eq.${s1})`
  ).limit(1);
  return !data || data.length === 0;
}

async function getScoreHistory(supabase: SupabaseClient, s1: number, s2: number): Promise<ScoreHistory | null> {
  const win = Math.max(s1, s2);
  const lose = Math.min(s1, s2);
  const { count, data } = await supabase.from('gamelogs')
    .select('date, home_team, visitor_team', { count: 'exact' })
    .or(`and(home_score.eq.${win},visitor_score.eq.${lose}),and(home_score.eq.${lose},visitor_score.eq.${win})`)
    .eq('is_negro_league', false)
    .order('date', { ascending: false })
    .limit(1);
  if (!data || data.length === 0) return null;
  return {
    occurrences: count || 0,
    last_game_date: new Date(data[0].date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }),
    last_home_team: data[0].home_team,
    last_visitor_team: data[0].visitor_team,
  };
}

async function getPlayoffBreakdown(supabase: SupabaseClient, s1: number, s2: number) {
  const win = Math.max(s1, s2);
  const lose = Math.min(s1, s2);
  const { data } = await supabase.from('gamelogs')
    .select('game_type, date')
    .or(`and(home_score.eq.${win},visitor_score.eq.${lose}),and(home_score.eq.${lose},visitor_score.eq.${win})`)
    .in('game_type', ['W', 'L', 'D', 'F'])
    .order('date', { ascending: false });
  if (!data || data.length === 0) return { total: 0, ws: 0, lcs: 0, ds: 0, wc: 0, last_date: null };
  let ws = 0, lcs = 0, ds = 0, wc = 0;
  for (const row of data) {
    if (row.game_type === 'W') ws++;
    else if (row.game_type === 'L') lcs++;
    else if (row.game_type === 'D') ds++;
    else if (row.game_type === 'F') wc++;
  }
  return {
    total: data.length, ws, lcs, ds, wc,
    last_date: new Date(data[0].date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }),
  };
}

async function getUniquePlayoffScoreCount(): Promise<number> {
  const result = await pool.query(`
    SELECT COUNT(DISTINCT CONCAT(GREATEST(home_score, visitor_score), '-', LEAST(home_score, visitor_score)))::int AS count
    FROM gamelogs WHERE game_type IN ('W', 'L', 'D', 'F')
  `);
  return result.rows[0]?.count ?? 0;
}

async function getFranchiseUniqueScoreCount(franchiseIds: number[]): Promise<number> {
  const result = await pool.query(`
    SELECT COUNT(DISTINCT CONCAT(GREATEST(home_score, visitor_score), '-', LEAST(home_score, visitor_score)))::int AS count
    FROM gamelogs WHERE home_team_id = ANY($1) OR visitor_team_id = ANY($1)
  `, [franchiseIds]);
  return result.rows[0]?.count ?? 0;
}

function formatGame(history: ScoreHistory): string {
  return `${history.last_visitor_team} vs ${history.last_home_team}`;
}


function formatNum(n: number): string {
  return n.toLocaleString('en-US');
}

function getOrdinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// --- HANDLER ---

export async function GET(request: NextRequest): Promise<NextResponse> {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const homeScore    = parseInt(searchParams.get('homeScore') ?? '');
  const awayScore    = parseInt(searchParams.get('awayScore') ?? '');
  const homeTeamId   = parseInt(searchParams.get('homeTeamId') ?? '');
  const awayTeamId   = parseInt(searchParams.get('awayTeamId') ?? '');
  const homeTeamName = searchParams.get('homeTeamName') ?? 'Home Team';
  const awayTeamName = searchParams.get('awayTeamName') ?? 'Away Team';
  const gameType     = searchParams.get('gameType') ?? 'R';

  if ([homeScore, awayScore, homeTeamId, awayTeamId].some(isNaN)) {
    return NextResponse.json({ error: 'Missing or invalid params. Required: homeScore, awayScore, homeTeamId, awayTeamId' }, { status: 400 });
  }

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  const isPostseason = ['F', 'D', 'L', 'W'].includes(gameType);
  const winnerIsAway = awayScore > homeScore;
  const winnerName = winnerIsAway ? awayTeamName.split(' ').pop() : homeTeamName.split(' ').pop();
  const loserName  = winnerIsAway ? homeTeamName.split(' ').pop() : awayTeamName.split(' ').pop();
  const header = `FINAL: ${winnerName} ${Math.max(homeScore, awayScore)}, ${loserName} ${Math.min(homeScore, awayScore)}${isPostseason ? '\n#Postseason' : ''}`;

  const [franchiseIdsAway, franchiseIdsHome, scorigamiResult, playoffBreakdown] = await Promise.all([
    getFranchiseTeamIds(supabase, awayTeamId),
    getFranchiseTeamIds(supabase, homeTeamId),
    checkTrueScorigami(supabase, homeScore, awayScore),
    isPostseason ? getPlayoffBreakdown(supabase, homeScore, awayScore) : Promise.resolve(null),
  ]);

  let postText = '';
  let postType = '';

  if (scorigamiResult.isScorigami) {
    postType = 'Scorigami';
    postText = `${header}\n\nThat's Scorigami!\nIt's the ${getOrdinal(scorigamiResult.newCount)} unique final score in MLB history.`;

  } else if (isPostseason && playoffBreakdown && playoffBreakdown.total === 0) {
    postType = 'Playoffigami';
    const [history, playoffCount] = await Promise.all([
      getScoreHistory(supabase, homeScore, awayScore),
      getUniquePlayoffScoreCount(),
    ]);
    const historyLine = history
      ? `\n\nIt's happened ${formatNum(history.occurrences)} times in MLB history, most recently ${history.last_game_date} (${formatGame(history)}).`
      : '';
    postText = `${header}\n\nThat's Playoffigami!\nIt's the ${getOrdinal(playoffCount + 1)} unique final score in MLB playoff history.${historyLine}`;

  } else {
    const [isAwayS, isHomeS, history] = await Promise.all([
      isFranchiseScorigami(supabase, franchiseIdsAway, awayScore, homeScore),
      isFranchiseScorigami(supabase, franchiseIdsHome, homeScore, awayScore),
      getScoreHistory(supabase, homeScore, awayScore),
    ]);

    if (isAwayS || isHomeS) {
      postType = 'Franchisigami';
      const teamName = isAwayS ? awayTeamName : homeTeamName;
      const franchiseIds = isAwayS ? franchiseIdsAway : franchiseIdsHome;
      const franchiseCount = await getFranchiseUniqueScoreCount(franchiseIds);
      const historyLine = history
        ? `\n\nIt's happened ${formatNum(history.occurrences)} times in MLB history, most recently ${history.last_game_date} (${formatGame(history)}).`
        : '';
      postText = `${header}\n\nThat's Franchisigami!\nIt's the ${getOrdinal(franchiseCount + 1)} unique final score in ${teamName} history.${historyLine}`;
    } else {
      postType = 'NoScorigami';
      postText = `${header}\n\nNo Scorigami. This score has happened ${formatNum(history?.occurrences ?? 0)} times in MLB history, most recently ${history?.last_game_date}${history ? ` (${formatGame(history)})` : ''}.`;
    }
  }

  const sendDm = searchParams.get('dm') === 'true';
  if (sendDm) {
    const twitterClient = new TwitterApi({
      appKey: process.env.X_APP_KEY!,
      appSecret: process.env.X_APP_SECRET!,
      accessToken: process.env.X_ACCESS_TOKEN!,
      accessSecret: process.env.X_ACCESS_SECRET!,
    });
    const me = await twitterClient.v2.me();
    await twitterClient.v2.sendDmToParticipant(me.data.id, { text: postText });
  }

  return NextResponse.json({
    postType,
    postText,
    charCount: postText.length,
    dmSent: sendDm,
    inputs: { homeScore, awayScore, homeTeamId, awayTeamId, homeTeamName, awayTeamName, gameType, isPostseason },
  });
}
