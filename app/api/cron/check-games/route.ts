import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import TwitterApi from 'twitter-api-v2';
import { pool } from '@/lib/db';

const TEAM_NAME_SHORTENER_MAP: { [key: string]: string } = {
  'Chicago White Sox': 'White Sox',
  'Boston Red Sox': 'Red Sox',
  'Toronto Blue Jays': 'Blue Jays',
  'Arizona Diamondbacks': 'D-backs',
};

// --- TYPES ---

interface PlayoffBreakdown {
  total: number;
  ws: number;
  lcs: number;
  ds: number;
  wc: number;
  last_date: string | null;
}

interface ScoreHistory {
  occurrences: number;
  last_game_date: string;
  last_home_team: string;
  last_visitor_team: string;
}

// --- DATABASE HELPERS ---

async function getFranchiseTeamIds(supabase: SupabaseClient, teamId: number): Promise<number[]> {
  const { data: franchiseData } = await supabase.from('teams').select('franchise').eq('team_id', teamId).single();
  if (!franchiseData || !franchiseData.franchise) return [teamId];
  const { data: teamIdsData } = await supabase.from('teams').select('team_id').eq('franchise', franchiseData.franchise);
  return teamIdsData?.map(t => Number(t.team_id)) || [teamId];
}

async function checkTrueScorigami(supabase: SupabaseClient, s1: number, s2: number): Promise<{ isScorigami: boolean; newCount: number }> {
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

async function isFranchiseScorigami(supabase: SupabaseClient, franchiseIds: number[], s1: number, s2: number): Promise<boolean> {
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

async function getPlayoffBreakdown(supabase: SupabaseClient, s1: number, s2: number): Promise<PlayoffBreakdown> {
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

function formatPlayoffLine(b: PlayoffBreakdown): string {
  return `Postseason: ${b.total} times (WS: ${b.ws}, LCS: ${b.lcs}, DS: ${b.ds}, WC: ${b.wc}), last on ${b.last_date}.`;
}

function formatNum(n: number): string {
  return n.toLocaleString('en-US');
}

function getOrdinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

async function postTweet(twitterClient: TwitterApi, postText: string, replyText: string | null) {
  if (process.env.ENABLE_POSTING === 'true') {
    const tweet = await twitterClient.v2.tweet(postText);
    if (replyText) {
      await twitterClient.v2.tweet(replyText, { reply: { in_reply_to_tweet_id: tweet.data.id } });
    }
  } else {
    console.log("WOULD TWEET:", postText);
    if (replyText) console.log("WOULD REPLY:", replyText);
  }
}

// --- MAIN HANDLER ---

export async function GET(request: NextRequest): Promise<NextResponse> {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const twitterClient = new TwitterApi({
    appKey: process.env.X_APP_KEY!, appSecret: process.env.X_APP_SECRET!,
    accessToken: process.env.X_ACCESS_TOKEN!, accessSecret: process.env.X_ACCESS_SECRET!,
  });

  const res = await fetch('https://statsapi.mlb.com/api/v1/schedule/games/?sportId=1', { cache: 'no-store' });
  const scheduleData = await res.json();
  if (!scheduleData.dates || scheduleData.dates.length === 0) return NextResponse.json({ message: "No games" });

  const scheduleGames = scheduleData.dates[0].games;

  for (const g of scheduleGames) {
    if (g.status.codedGameState !== 'F' && g.status.codedGameState !== 'O') continue;

    const game_id = g.gamePk;
    const away_id = g.teams.away.team.id;
    const home_id = g.teams.home.team.id;
    const away_score = g.teams.away.score || 0;
    const home_score = g.teams.home.score || 0;
    const away_name = g.teams.away.team.name;
    const home_name = g.teams.home.team.name;

    const { data: alreadyPosted } = await supabase.from('posted_updates').select('id').eq('game_id', game_id).limit(1);
    if (alreadyPosted && alreadyPosted.length > 0) continue;

    const isPostseason = ['F', 'D', 'L', 'W'].includes(g.gameType);
    const winnerIsAway = away_score > home_score;

    const winnerName = winnerIsAway
      ? (TEAM_NAME_SHORTENER_MAP[away_name] || away_name.split(' ').pop())
      : (TEAM_NAME_SHORTENER_MAP[home_name] || home_name.split(' ').pop());
    const loserName = winnerIsAway
      ? (TEAM_NAME_SHORTENER_MAP[home_name] || home_name.split(' ').pop())
      : (TEAM_NAME_SHORTENER_MAP[away_name] || away_name.split(' ').pop());

    const header = `FINAL: ${winnerName} ${Math.max(away_score, home_score)}, ${loserName} ${Math.min(away_score, home_score)}${isPostseason ? '\n#Postseason' : ''}`;

    const [franchiseIdsAway, franchiseIdsHome, scorigamiResult, playoffBreakdown] = await Promise.all([
      getFranchiseTeamIds(supabase, away_id),
      getFranchiseTeamIds(supabase, home_id),
      checkTrueScorigami(supabase, away_score, home_score),
      isPostseason ? getPlayoffBreakdown(supabase, away_score, home_score) : Promise.resolve(null),
    ]);

    let postText = "";

    if (scorigamiResult.isScorigami) {
      // 1. True Scorigami
      postText = `${header}\n\nThat's Scorigami!\nIt's the ${getOrdinal(scorigamiResult.newCount)} unique final score in MLB history.`;

    } else if (isPostseason && playoffBreakdown && playoffBreakdown.total === 0) {
      // 2. Playoffigami
      const [history, playoffCount] = await Promise.all([
        getScoreHistory(supabase, away_score, home_score),
        getUniquePlayoffScoreCount(),
      ]);
      const historyLine = history
        ? `\n\nIt's happened ${formatNum(history.occurrences)} times in MLB history, most recently ${history.last_game_date} (${formatGame(history)}).`
        : '';
      postText = `${header}\n\nThat's Playoffigami!\nIt's the ${getOrdinal(playoffCount + 1)} unique final score in MLB playoff history.${historyLine}`;

    } else {
      // 3. Franchisigami or No Scorigami
      const [isAwayS, isHomeS, history] = await Promise.all([
        isFranchiseScorigami(supabase, franchiseIdsAway, away_score, home_score),
        isFranchiseScorigami(supabase, franchiseIdsHome, home_score, away_score),
        getScoreHistory(supabase, away_score, home_score),
      ]);

      if (isAwayS || isHomeS) {
        const teamName = isAwayS ? away_name : home_name;
        const franchiseIds = isAwayS ? franchiseIdsAway : franchiseIdsHome;
        const franchiseCount = await getFranchiseUniqueScoreCount(franchiseIds);
        const historyLine = history
          ? `\n\nIt's happened ${formatNum(history.occurrences)} times in MLB history, most recently ${history.last_game_date} (${formatGame(history)}).`
          : '';
        postText = `${header}\n\nThat's Franchisigami!\nIt's the ${getOrdinal(franchiseCount + 1)} unique final score in ${teamName} history.${historyLine}`;
      } else {
        postText = `${header}\n\nNo Scorigami. This score has happened ${formatNum(history?.occurrences ?? 0)} times in MLB history, most recently ${history?.last_game_date}${history ? ` (${formatGame(history)})` : ''}.`;
      }
    }

    await postTweet(twitterClient, postText, null);

    await supabase.from('posted_updates').insert({
      game_id,
      post_type: 'Final',
      details: 'Final Score',
      score_snapshot: `${away_score}-${home_score}`,
    });
  }

  return NextResponse.json({ success: true });
}
