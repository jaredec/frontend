import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath, revalidateTag } from 'next/cache';
import TwitterApi from 'twitter-api-v2';
import { pool } from '@/lib/db';

const TEAM_NAME_SHORTENER_MAP: { [key: string]: string } = {
  'Chicago White Sox': 'White Sox',
  'Boston Red Sox': 'Red Sox',
  'Toronto Blue Jays': 'Blue Jays',
  'Arizona Diamondbacks': 'D-backs',
};

const TEAM_ABBR_MAP: { [key: string]: string } = {
  // Modern
  'Arizona Diamondbacks': 'ARI', 'Atlanta Braves': 'ATL', 'Baltimore Orioles': 'BAL',
  'Boston Red Sox': 'BOS', 'Chicago Cubs': 'CHC', 'Chicago White Sox': 'CWS',
  'Cincinnati Reds': 'CIN', 'Cleveland Guardians': 'CLE', 'Colorado Rockies': 'COL',
  'Detroit Tigers': 'DET', 'Houston Astros': 'HOU', 'Kansas City Royals': 'KC',
  'Los Angeles Angels': 'LAA', 'Los Angeles Dodgers': 'LAD', 'Miami Marlins': 'MIA',
  'Milwaukee Brewers': 'MIL', 'Minnesota Twins': 'MIN', 'New York Mets': 'NYM',
  'New York Yankees': 'NYY', 'Athletics': 'OAK', 'Philadelphia Phillies': 'PHI',
  'Pittsburgh Pirates': 'PIT', 'San Diego Padres': 'SD', 'San Francisco Giants': 'SFG',
  'Seattle Mariners': 'SEA', 'St. Louis Cardinals': 'STL', 'Tampa Bay Rays': 'TB',
  'Texas Rangers': 'TEX', 'Toronto Blue Jays': 'TOR', 'Washington Nationals': 'WSH',
  // Historical
  'Altoona Mountain Citys': 'ALT', 'Baltimore Lord Baltimores': 'BL1', 'Baltimore Marylands': 'BL4',
  'Baltimore Monumentals': 'BLU', 'Baltimore Terrapins': 'BLF', 'Boston Reds': 'BSU',
  'Brooklyn Atlantics': 'BR2', 'Brooklyn Eckfords': 'BR1', 'Brooklyn Gladiators': 'BR4',
  'Brooklyn Tip-Tops': 'BRF', 'Brooklyn Wonders': 'BRP', 'Buffalo Bisons': 'BFN',
  'Buffalo Blues': 'BUF', 'Chicago Pirates': 'CHP', 'Chicago Whales': 'CHF',
  'Cincinnati Outlaw Reds': 'CNU', 'Cleveland Forest Cities': 'CL1', 'Cleveland Infants': 'CLP',
  'Cleveland Spiders': 'CL2', 'Columbus Colts': 'CL5', 'Detroit Wolverines': 'DTN',
  'Elizabeth Resolutes': 'ELI', 'Ft. Wayne Kekiongas': 'FW1', 'Hartford Dark Blues': 'HAR',
  'Indianapolis Hoosiers': 'IND', 'Kansas City Cowboys': 'KCN', 'Kansas City Packers': 'KCF',
  'Keokuk Westerns': 'KEO', 'Louisville Colonels': 'LS2', 'Louisville Grays': 'LS1',
  'Milwaukee Cream Citys': 'ML2', 'Newark Peppers': 'NEW', 'New York Giants': 'NYP',
  'New York Metropolitans': 'NY4', 'New York Mutuals': 'NY2', 'Philadelphia Athletics': 'PH1',
  'Philadelphia Centennials': 'PH3', 'Philadelphia Keystones': 'PHU', 'Philadelphia Quakers': 'PHP',
  'Philadelphia White Stockings': 'PH2', 'Pittsburgh Burghers': 'PTP', 'Pittsburgh Rebels': 'PTF',
  'Providence Grays': 'PRO', 'Richmond Virginias': 'RIC', 'Rochester Hop Bitters': 'RC2',
  'Rockford Forest Citys': 'RC1', 'St. Louis Brown Stockings': 'SL2', 'St. Louis Maroons': 'SLU',
  'St. Louis Red Stockings': 'SL1', 'St.Louis Terriers': 'SLF', 'St. Paul Saints': 'SPU',
  'Syracuse Stars': 'SR1', 'Toledo Blue Stockings': 'TL1', 'Toledo Maumees': 'TL2',
  'Troy Haymakers': 'TRO', 'Troy Trojans': 'TRN', 'Washington Olympics': 'WS3',
  'Washington Senators': 'WSN', 'Wilmington Quicksteps': 'WIL', 'Worcester Ruby Legs': 'WOR',
};

function teamAbbr(name: string): string {
  return TEAM_ABBR_MAP[name] ?? name.split(' ').pop() ?? name;
}

const START_YEAR = 1871;

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
  last_game_date_raw: string;
  last_home_team: string;
  last_visitor_team: string;
  last_home_score: number;
  last_visitor_score: number;
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
    .gte('date', `${START_YEAR}-01-01`)
    .limit(1);

  if (data && data.length > 0) return { isScorigami: false, newCount: 0 };

  const result = await pool.query(`
    SELECT COUNT(DISTINCT CONCAT(GREATEST(home_score, visitor_score), '-', LEAST(home_score, visitor_score)))::int AS count
    FROM gamelogs WHERE is_negro_league = false AND EXTRACT(YEAR FROM date) >= ${START_YEAR}
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
  ).gte('date', `${START_YEAR}-01-01`).limit(1);
  return !data || data.length === 0;
}

async function getScoreHistory(supabase: SupabaseClient, s1: number, s2: number): Promise<ScoreHistory | null> {
  const win = Math.max(s1, s2);
  const lose = Math.min(s1, s2);
  const { count, data } = await supabase.from('gamelogs')
    .select('date, home_team, visitor_team, home_score, visitor_score', { count: 'exact' })
    .or(`and(home_score.eq.${win},visitor_score.eq.${lose}),and(home_score.eq.${lose},visitor_score.eq.${win})`)
    .eq('is_negro_league', false)
    .gte('date', `${START_YEAR}-01-01`)
    .order('date', { ascending: false })
    .limit(1);

  if (!data || data.length === 0) return null;
  return {
    occurrences: count || 0,
    last_game_date: new Date(data[0].date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }),
    last_game_date_raw: data[0].date,
    last_home_team: data[0].home_team,
    last_visitor_team: data[0].visitor_team,
    last_home_score: data[0].home_score,
    last_visitor_score: data[0].visitor_score,
  };
}

async function getPlayoffBreakdown(supabase: SupabaseClient, s1: number, s2: number): Promise<PlayoffBreakdown> {
  const win = Math.max(s1, s2);
  const lose = Math.min(s1, s2);
  const { data } = await supabase.from('gamelogs')
    .select('game_type, date')
    .or(`and(home_score.eq.${win},visitor_score.eq.${lose}),and(home_score.eq.${lose},visitor_score.eq.${win})`)
    .in('game_type', ['W', 'L', 'D', 'F'])
    .gte('date', `${START_YEAR}-01-01`)
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
    FROM gamelogs WHERE game_type IN ('W', 'L', 'D', 'F') AND EXTRACT(YEAR FROM date) >= ${START_YEAR}
  `);
  return result.rows[0]?.count ?? 0;
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
    if (!['R', 'F', 'D', 'L', 'W'].includes(g.gameType)) continue;

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

    const hashtag = isPostseason ? '\n#Postseason' : '';
    const header = `FINAL: ${winnerName} ${Math.max(away_score, home_score)}, ${loserName} ${Math.min(away_score, home_score)}${hashtag}`;

    const [franchiseIdsAway, franchiseIdsHome, scorigamiResult, playoffBreakdown] = await Promise.all([
      getFranchiseTeamIds(supabase, away_id),
      getFranchiseTeamIds(supabase, home_id),
      checkTrueScorigami(supabase, away_score, home_score),
      isPostseason ? getPlayoffBreakdown(supabase, away_score, home_score) : Promise.resolve(null),
    ]);

    let postText = "";

    if (scorigamiResult.isScorigami) {
      // 1. True Scorigami
      postText = `${header}\n\nThat's Scorigami! It's the ${getOrdinal(scorigamiResult.newCount)} unique final score in MLB history.`;
      revalidatePath('/history');

    } else if (isPostseason && playoffBreakdown && playoffBreakdown.total === 0) {
      // 2. Playoffigami
      const playoffCount = await getUniquePlayoffScoreCount();
      postText = `${header}\n\nThat's Playoffigami! It's the ${getOrdinal(playoffCount + 1)} unique final score in MLB playoff history.`;
      revalidatePath('/history');

    } else {
      // 3. Franchisigami or No Scorigami
      const [isAwayS, isHomeS, history] = await Promise.all([
        isFranchiseScorigami(supabase, franchiseIdsAway, away_score, home_score),
        isFranchiseScorigami(supabase, franchiseIdsHome, home_score, away_score),
        getScoreHistory(supabase, away_score, home_score),
      ]);

      if (isAwayS || isHomeS) {
        const onlyWord = history && history.occurrences < 25 ? 'only ' : '';
        const historyLine = history ? ` It's ${onlyWord}happened ${formatNum(history.occurrences)} times in MLB history.` : '';

        const awayShort = TEAM_NAME_SHORTENER_MAP[away_name] || away_name.split(' ').pop();
        const homeShort = TEAM_NAME_SHORTENER_MAP[home_name] || home_name.split(' ').pop();

        let franchiseLine: string;
        if (isAwayS && isHomeS) {
          franchiseLine = `It's the first time in both ${awayShort} and ${homeShort} history this score has occurred.`;
        } else {
          const teamShort = isAwayS ? awayShort : homeShort;
          franchiseLine = `It's the first time in ${teamShort} history this score has occurred.`;
        }

        postText = `${header}\n\nThat's Franchisigami! ${franchiseLine}${historyLine}`;
      } else {
        const win = Math.max(away_score, home_score);
        const lose = Math.min(away_score, home_score);
        // Use PT dates: cron can cross midnight UTC during US evening, so UTC midnight
        // cutoff misses same-PT-day games posted before midnight UTC.
        const todayPT = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
        const yesterdayPT = new Date(Date.now() - 86400000).toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
        // Look back 30h so we never miss same-day games regardless of UTC rollover
        const { data: recentPosts } = await supabase
          .from('posted_updates')
          .select('score_snapshot, created_at')
          .gte('created_at', new Date(Date.now() - 30 * 3600000).toISOString())
          .neq('game_id', game_id);
        const todayMatchCount = recentPosts?.filter(p => {
          const postDatePT = new Date(p.created_at).toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
          return postDatePT === todayPT && (
            p.score_snapshot === `${win}-${lose}` ||
            p.score_snapshot === `${lose}-${win}` ||
            p.score_snapshot === `${away_score}-${home_score}` ||
            p.score_snapshot === `${home_score}-${away_score}`
          );
        }).length ?? 0;
        const totalOccurrences = (history?.occurrences ?? 0) + todayMatchCount;
        const lastDateStr = history?.last_game_date_raw?.slice(0, 10) ?? '';
        const mostRecently = todayMatchCount === 0 ? (lastDateStr === yesterdayPT ? 'yesterday' : `on ${history?.last_game_date}`)
          : todayMatchCount === 1 ? 'earlier today'
          : todayMatchCount === 2 ? 'twice earlier today'
          : `${todayMatchCount} times earlier today`;
        const isRarigami = totalOccurrences < 100;
        const teamContext = mostRecently !== 'earlier today' && mostRecently !== 'twice earlier today' && !mostRecently?.includes('times earlier today') && history
          ? ` (${teamAbbr(history.last_visitor_team)} vs. ${teamAbbr(history.last_home_team)})`
          : '';
        const recencyClause = `, most recently ${mostRecently}`;
        if (isRarigami && history) {
          postText = `${header}\n\nRarigami. This score has happened only ${formatNum(totalOccurrences)} times in MLB history${recencyClause}${teamContext}.`;
          revalidatePath('/history');
        } else {
          postText = `${header}\n\nNo scorigami. This score has happened ${formatNum(totalOccurrences)} times in MLB history${recencyClause}${teamContext}.`;
        }
      }
    }

    await postTweet(twitterClient, postText, null);

    await supabase.from('posted_updates').insert({
      game_id,
      post_type: 'Final',
      details: 'Final Score',
      score_snapshot: `${away_score}-${home_score}`,
    });

    revalidateTag('scorigami');
  }

  return NextResponse.json({ success: true });
}
