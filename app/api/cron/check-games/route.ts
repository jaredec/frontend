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

// Per-team Franchisigami labels. "Diamondbacksigami" reads clunky, so D-backs
// drops the hyphen for "Dbacksigami". Two-word nicknames keep the space
// (e.g., "Red Soxigami") since "Redsoxigami" reads worse than the spaced form.
const TEAM_IGAMI_MAP: { [key: string]: string } = {
  'Arizona Diamondbacks': 'Dbacksigami',
  'Atlanta Braves': 'Bravesigami',
  'Baltimore Orioles': 'Oriolesigami',
  'Boston Red Sox': 'Red Soxigami',
  'Chicago Cubs': 'Cubsigami',
  'Chicago White Sox': 'White Soxigami',
  'Cincinnati Reds': 'Redsigami',
  'Cleveland Guardians': 'Guardiansigami',
  'Colorado Rockies': 'Rockiesigami',
  'Detroit Tigers': 'Tigersigami',
  'Houston Astros': 'Astrosigami',
  'Kansas City Royals': 'Royalsigami',
  'Los Angeles Angels': 'Angelsigami',
  'Los Angeles Dodgers': 'Dodgersigami',
  'Miami Marlins': 'Marlinsigami',
  'Milwaukee Brewers': 'Brewersigami',
  'Minnesota Twins': 'Twinsigami',
  'New York Mets': 'Metsigami',
  'New York Yankees': 'Yankeesigami',
  'Athletics': 'Athleticsigami',
  'Oakland Athletics': 'Athleticsigami',
  'Philadelphia Phillies': 'Philliesigami',
  'Pittsburgh Pirates': 'Piratesigami',
  'San Diego Padres': 'Padresigami',
  'San Francisco Giants': 'Giantsigami',
  'Seattle Mariners': 'Marinersigami',
  'St. Louis Cardinals': 'Cardinalsigami',
  'Tampa Bay Rays': 'Raysigami',
  'Texas Rangers': 'Rangersigami',
  'Toronto Blue Jays': 'Blue Jaysigami',
  'Washington Nationals': 'Nationalsigami',
};

function teamIgami(name: string): string {
  if (TEAM_IGAMI_MAP[name]) return TEAM_IGAMI_MAP[name];
  // Fallback for unmapped (e.g., historical) teams: shorten then suffix.
  const short = TEAM_NAME_SHORTENER_MAP[name] ?? name.split(' ').pop() ?? name;
  return `${short}igami`;
}

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
  last_ended_at: string | null;
}

// --- DATABASE HELPERS ---

async function getFranchiseTeamIds(supabase: SupabaseClient, teamId: number): Promise<number[]> {
  const { data: franchiseData } = await supabase.from('teams').select('franchise').eq('team_id', teamId).single();
  if (!franchiseData || !franchiseData.franchise) return [teamId];
  const { data: teamIdsData } = await supabase.from('teams').select('team_id').eq('franchise', franchiseData.franchise);
  return teamIdsData?.map(t => Number(t.team_id)) || [teamId];
}

async function getUniqueScoreCount(): Promise<number> {
  const result = await pool.query(`
    SELECT COUNT(DISTINCT CONCAT(GREATEST(home_score, visitor_score), '-', LEAST(home_score, visitor_score)))::int AS count
    FROM gamelogs WHERE is_negro_league = false AND EXTRACT(YEAR FROM date) >= ${START_YEAR}
  `);
  return result.rows[0]?.count ?? 0;
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
    .select('date, home_team, visitor_team, home_score, visitor_score, ended_at', { count: 'exact' })
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
    last_ended_at: data[0].ended_at ?? null,
  };
}

async function fetchGameEndedAt(gamePk: number): Promise<string | null> {
  try {
    const res = await fetch(`https://statsapi.mlb.com/api/v1.1/game/${gamePk}/feed/live`, { cache: 'no-store' });
    if (!res.ok) return null;
    const d = await res.json();
    const plays = d?.liveData?.plays?.allPlays;
    if (Array.isArray(plays) && plays.length > 0) {
      const endTime = plays[plays.length - 1]?.about?.endTime;
      if (endTime) return endTime;
    }
    const gi = d?.gameData?.gameInfo;
    if (gi?.firstPitch && typeof gi.gameDurationMinutes === 'number') {
      const fp = new Date(gi.firstPitch);
      return new Date(fp.getTime() + gi.gameDurationMinutes * 60_000).toISOString();
    }
  } catch {}
  return null;
}

const COUNT_WORD: Record<number, string> = {
  2: 'twice', 3: 'three times', 4: 'four times', 5: 'five times',
  6: 'six times', 7: 'seven times', 8: 'eight times', 9: 'nine times',
};
function timesEarlierToday(n: number): string {
  return n === 1 ? 'earlier today' : `${COUNT_WORD[n] ?? `${n} times`} earlier today`;
}

function formatRecency(
  priorEndedAtIso: string | null,
  currentEndedAtIso: string | null,
  lastDateRaw: string,
  yesterdayPT: string,
  lastGameDate: string,
  todayMatchCount: number,
): string {
  // Sub-hour precision only for the most recent prior occurrence
  if (priorEndedAtIso && currentEndedAtIso) {
    const diffMs = new Date(currentEndedAtIso).getTime() - new Date(priorEndedAtIso).getTime();
    if (diffMs >= 0) {
      const diffSec = Math.floor(diffMs / 1000);
      const diffMin = Math.floor(diffSec / 60);
      if (diffSec < 60) return `about ${diffSec} seconds ago`;
      if (diffMin < 2) return 'less than two minutes ago';
      if (diffMin < 5) return 'less than five minutes ago';
      if (diffMin < 10) return 'less than ten minutes ago';
      // 10-60 min: defer to "twice/three times earlier today" if it'd apply — punchier phrasing.
      if (diffMin < 60 && todayMatchCount < 2) return 'less than an hour ago';
    }
  }
  // 1+ hour, fall back to date phrasing — preserve "twice/three times earlier today" for repeats.
  // Prefer ended_at-derived PT date when available: it reflects when the game *actually finished*,
  // sidestepping MLB's official-date quirks for suspended/resumed games.
  const effectiveDate = priorEndedAtIso
    ? new Date(priorEndedAtIso).toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' })
    : lastDateRaw;
  if (effectiveDate === yesterdayPT) return 'yesterday';
  const todayPT = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
  if (effectiveDate === todayPT) return timesEarlierToday(todayMatchCount > 0 ? todayMatchCount : 1);
  return `on ${lastGameDate}`;
}

async function getPlayoffBreakdown(s1: number, s2: number): Promise<PlayoffBreakdown> {
  const win = Math.max(s1, s2);
  const lose = Math.min(s1, s2);
  const result = await pool.query(`
    SELECT game_type, COUNT(*)::int AS count, MAX(date) AS last_date
    FROM gamelogs
    WHERE ((home_score = $1 AND visitor_score = $2) OR (home_score = $2 AND visitor_score = $1))
      AND game_type IN ('W','L','D','F')
      AND EXTRACT(YEAR FROM date) >= ${START_YEAR}
    GROUP BY game_type
  `, [win, lose]);

  if (result.rows.length === 0) return { total: 0, ws: 0, lcs: 0, ds: 0, wc: 0, last_date: null };

  let ws = 0, lcs = 0, ds = 0, wc = 0, total = 0;
  let maxDate: string | null = null;
  for (const row of result.rows) {
    const c = row.count as number;
    total += c;
    if (row.game_type === 'W') ws = c;
    else if (row.game_type === 'L') lcs = c;
    else if (row.game_type === 'D') ds = c;
    else if (row.game_type === 'F') wc = c;
    const d = row.last_date instanceof Date ? row.last_date.toISOString().slice(0, 10) : String(row.last_date);
    if (!maxDate || d > maxDate) maxDate = d;
  }
  return {
    total, ws, lcs, ds, wc,
    last_date: maxDate ? new Date(maxDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }) : null,
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

function articleFor(n: number): string {
  // "An" before numbers whose first spoken word starts with a vowel sound: 8, 11, 18, 80-89
  return (n === 8 || n === 11 || n === 18 || (n >= 80 && n <= 89)) ? 'An' : 'A';
}

async function postTweet(twitterClient: TwitterApi, postText: string, replyText: string | null): Promise<string | null> {
  if (process.env.ENABLE_POSTING === 'true') {
    const tweet = await twitterClient.v2.tweet(postText);
    if (replyText) {
      await twitterClient.v2.tweet(replyText, { reply: { in_reply_to_tweet_id: tweet.data.id } });
    }
    return tweet.data.id;
  } else {
    console.log("WOULD TWEET:", postText);
    if (replyText) console.log("WOULD REPLY:", replyText);
    return null;
  }
}

async function postQuoteTweet(twitterClient: TwitterApi, text: string, quoteTweetId: string): Promise<void> {
  if (process.env.ENABLE_POSTING === 'true') {
    await twitterClient.v2.tweet(text, { quote_tweet_id: quoteTweetId });
  } else {
    console.log("WOULD QUOTE TWEET:", text, "quoting:", quoteTweetId);
  }
}

async function getTeamStreak(supabase: SupabaseClient, teamName: string, todayWon: boolean): Promise<{ type: 'win' | 'loss'; length: number } | null> {
  // Today's game isn't in gamelogs yet, so we fetch recent history and prepend today's result
  const { data } = await supabase
    .from('gamelogs')
    .select('visitor_team, home_team, visitor_score, home_score')
    .or(`visitor_team.eq.${teamName},home_team.eq.${teamName}`)
    .in('game_type', ['R', 'F', 'D', 'L', 'W'])
    .order('date', { ascending: false })
    .limit(35);

  const todayResult = { won: todayWon };
  const results: boolean[] = [todayResult.won, ...(data ?? []).map(g => {
    const isHome = g.home_team === teamName;
    return isHome ? g.home_score > g.visitor_score : g.visitor_score > g.home_score;
  })];

  const streakType: 'win' | 'loss' = results[0] ? 'win' : 'loss';
  let streak = 0;
  for (const won of results) {
    if ((streakType === 'win') === won) streak++;
    else break;
  }

  if (streak < 12) return null;
  return { type: streakType, length: streak };
}

// Streak counts come from mv_streak_context. Methodology (locked in 2026-04-25):
//   * All-time data (no era cutoff)
//   * No Negro Leagues
//   * All game types: regular season + all postseason rounds (R, F, D, L, W)
//   * Streaks span the offseason — only an actual game outcome breaks a streak
//   * Ties break the streak (a tie ends both win and loss runs)
//   * Doubleheader-aware ordering: date, game_number, game_id
//   * Partition by team_id so franchise renames don't fragment a streak
//   * Counts distinct streaks (not team-seasons)
// Validated: 1903+ RS-only variant of this query yields 139 team-seasons / 151
// distinct 12+ losing streaks (matches ESPN's 138 + active Mets = 139 figure).
async function getStreakContext(supabase: SupabaseClient, streakType: 'win' | 'loss', length: number): Promise<{ count: number; lastTeam: string; lastDate: string } | null> {
  const { data } = await supabase
    .from('mv_streak_context')
    .select('occurrence_count, last_team, last_date')
    .eq('streak_type', streakType)
    .eq('streak_length', length)
    .single();

  if (!data) return null;
  const lastDate = new Date(data.last_date).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const lastTeam = TEAM_NAME_SHORTENER_MAP[data.last_team] || data.last_team.split(' ').pop()!;
  return { count: data.occurrence_count, lastTeam, lastDate };
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

  type ScheduleGame = {
    gamePk: number;
    gameType: string;
    status: { codedGameState: string };
    teams: {
      away: { team: { id: number; name: string }; score: number };
      home: { team: { id: number; name: string }; score: number };
    };
  };
  const scheduleGames: ScheduleGame[] = scheduleData.dates[0].games;

  // Filter to candidates first, then fetch ended_at for each, then sort by ended_at
  // ascending. This guarantees that if multiple games end inside the same cron window,
  // they post in the order they actually finished — so "less than five minutes ago"
  // is always relative to a strictly-earlier-ending game.
  const candidates = scheduleGames.filter((g) =>
    (g.status.codedGameState === 'F' || g.status.codedGameState === 'O') &&
    ['R', 'F', 'D', 'L', 'W'].includes(g.gameType)
  );
  const enriched = await Promise.all(
    candidates.map(async (g) => ({ g, endedAt: await fetchGameEndedAt(g.gamePk) }))
  );
  enriched.sort((a, b) => {
    const ta = a.endedAt ? new Date(a.endedAt).getTime() : Number.MAX_SAFE_INTEGER;
    const tb = b.endedAt ? new Date(b.endedAt).getTime() : Number.MAX_SAFE_INTEGER;
    return ta - tb;
  });

  for (const { g, endedAt } of enriched) {
    try {
    const game_id = g.gamePk;
    const away_id = g.teams.away.team.id;
    const home_id = g.teams.home.team.id;
    const away_score = g.teams.away.score || 0;
    const home_score = g.teams.home.score || 0;
    const away_name = g.teams.away.team.name;
    const home_name = g.teams.home.team.name;

    const { data: alreadyPosted } = await supabase.from('posted_updates').select('id').eq('game_id', game_id).eq('post_type', 'Final').limit(1);
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

    const [franchiseIdsAway, franchiseIdsHome, history, playoffBreakdown] = await Promise.all([
      getFranchiseTeamIds(supabase, away_id),
      getFranchiseTeamIds(supabase, home_id),
      getScoreHistory(supabase, away_score, home_score),
      isPostseason ? getPlayoffBreakdown(away_score, home_score) : Promise.resolve(null),
    ]);

    const isScorigami = history === null;
    let postText = "";

    if (isScorigami) {
      // 1. True Scorigami
      const newCount = (await getUniqueScoreCount()) + 1;
      postText = `${header}\n\nThat's Scorigami! It's the ${getOrdinal(newCount)} unique final score in MLB history.`;
      revalidatePath('/history');

    } else if (isPostseason && playoffBreakdown && playoffBreakdown.total === 0) {
      // 2. Playoffigami
      const playoffCount = await getUniquePlayoffScoreCount();
      postText = `${header}\n\nThat's Playoffigami! It's the ${getOrdinal(playoffCount + 1)} unique final score in MLB playoff history.`;
      revalidatePath('/history');

    } else {
      // 3. Franchisigami or No Scorigami
      const [isAwayS, isHomeS] = await Promise.all([
        isFranchiseScorigami(supabase, franchiseIdsAway, away_score, home_score),
        isFranchiseScorigami(supabase, franchiseIdsHome, home_score, away_score),
      ]);

      // Same-day recency lookup applies to both branches: Franchisigami now also
      // surfaces "most recently …" using the same-PT-day prior + history record.
      const win = Math.max(away_score, home_score);
      const lose = Math.min(away_score, home_score);
      // Use PT dates so cron crossing midnight UTC during US evening doesn't
      // mis-bucket same-PT-day games.
      const yesterdayPT = new Date(Date.now() - 86400000).toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
      // Look back 30h to catch any same-day prior posts regardless of UTC rollover.
      // Also pulls each prior post's ended_at so we can compute precise minute/second
      // recency rather than relying on cron-jittery created_at.
      const { data: recentPosts } = await supabase
        .from('posted_updates')
        .select('score_snapshot, created_at, ended_at')
        .gte('created_at', new Date(Date.now() - 30 * 3600000).toISOString())
        .neq('game_id', game_id)
        .order('created_at', { ascending: false });
      const todayPT = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
      const sameScoreToday = (recentPosts ?? []).filter(p => {
        const scoreMatches =
          p.score_snapshot === `${win}-${lose}` ||
          p.score_snapshot === `${lose}-${win}` ||
          p.score_snapshot === `${away_score}-${home_score}` ||
          p.score_snapshot === `${home_score}-${away_score}`;
        if (!scoreMatches) return false;
        // Confirm the prior post actually happened today in PT — the 30h lookback
        // window catches yesterday too, so without this filter a same-score game
        // from yesterday would inflate today's count.
        const postPT = new Date(p.ended_at ?? p.created_at).toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
        return postPT === todayPT;
      });
      const todayMatchCount = sameScoreToday.length;
      const priorEndedAt = sameScoreToday[0]?.ended_at ?? history?.last_ended_at ?? null;
      const totalOccurrences = (history?.occurrences ?? 0) + todayMatchCount;
      const lastDateRaw = todayMatchCount > 0
        ? new Date(sameScoreToday[0].ended_at ?? sameScoreToday[0].created_at).toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' })
        : (history?.last_game_date_raw?.slice(0, 10) ?? '');
      const mostRecently = formatRecency(priorEndedAt, endedAt, lastDateRaw, yesterdayPT, history?.last_game_date ?? '', todayMatchCount);
      // Only show team context for older (non-same-day) prior occurrences from history
      const showTeamContext = todayMatchCount === 0 && history && !mostRecently.endsWith('earlier today');
      // Use 3-letter abbreviations only when both teams are current MLB franchises
      // (TEAM_IGAMI_MAP doubles as the modern-team set). For matchups involving
      // historical teams (Brooklyn Bridegrooms, Cleveland Naps, etc.) the abbr
      // map has gaps, so fall back to full team names — clearer than guessing codes.
      let teamContext = '';
      if (showTeamContext && history) {
        const visitorModern = history.last_visitor_team in TEAM_IGAMI_MAP;
        const homeModern = history.last_home_team in TEAM_IGAMI_MAP;
        const visitorDisplay = visitorModern && homeModern ? teamAbbr(history.last_visitor_team) : history.last_visitor_team;
        const homeDisplay = visitorModern && homeModern ? teamAbbr(history.last_home_team) : history.last_home_team;
        teamContext = ` (${visitorDisplay} vs. ${homeDisplay})`;
      }
      const recencyClause = `, most recently ${mostRecently}`;

      if (isAwayS || isHomeS) {
        const onlyWord = totalOccurrences < 25 ? 'only ' : '';
        const historyText = history ? `It's ${onlyWord}happened ${formatNum(totalOccurrences)} times in MLB history${recencyClause}${teamContext}.` : '';

        const awayShort = TEAM_NAME_SHORTENER_MAP[away_name] || away_name.split(' ').pop();
        const homeShort = TEAM_NAME_SHORTENER_MAP[home_name] || home_name.split(' ').pop();

        let franchiseLine: string;
        let igamiLabel: string;
        if (isAwayS && isHomeS) {
          franchiseLine = `It's the first time this score has occurred for both franchises.`;
          igamiLabel = `${teamIgami(away_name)} and ${teamIgami(home_name)}`;
        } else {
          const teamShort = isAwayS ? awayShort : homeShort;
          const teamFull = isAwayS ? away_name : home_name;
          franchiseLine = `It's the first time in ${teamShort} history this score has occurred.`;
          igamiLabel = teamIgami(teamFull);
        }

        // Both single and dual Franchisigami posts put the MLB-history line on its own paragraph.
        const historyLine = historyText ? `\n\n${historyText}` : '';
        postText = `${header}\n\nThat's ${igamiLabel}! ${franchiseLine}${historyLine}`;
      } else {
        const isRarigami = totalOccurrences < 100;
        if (isRarigami && history) {
          postText = `${header}\n\nRarigami. This score has happened only ${formatNum(totalOccurrences)} times in MLB history${recencyClause}${teamContext}.`;
          revalidatePath('/history');
        } else {
          postText = `${header}\n\nNo scorigami. This score has happened ${formatNum(totalOccurrences)} times in MLB history${recencyClause}${teamContext}.`;
        }
      }
    }

    const tweetId = await postTweet(twitterClient, postText, null);

    await supabase.from('posted_updates').insert({
      game_id,
      post_type: 'Final',
      details: 'Final Score',
      score_snapshot: `${away_score}-${home_score}`,
      tweet_id: tweetId,
      ended_at: endedAt,
    });

    // Streak check for both teams
    if (tweetId) {
      const teamsToCheck: [string, string, boolean][] = [
        [away_name, TEAM_NAME_SHORTENER_MAP[away_name] || away_name.split(' ').pop()!, away_score > home_score],
        [home_name, TEAM_NAME_SHORTENER_MAP[home_name] || home_name.split(' ').pop()!, home_score > away_score],
      ];
      for (const [teamName, shortName, todayWon] of teamsToCheck) {
        const streak = await getTeamStreak(supabase, teamName, todayWon);
        if (!streak) continue;

        const { count: postedCount } = await supabase
          .from('posted_updates')
          .select('id', { count: 'exact', head: true })
          .eq('game_id', game_id);
        if (postedCount && postedCount >= 2) continue;

        const ctx = await getStreakContext(supabase, streak.type, streak.length);
        const streakWord = streak.type === 'win' ? 'won' : 'lost';
        const streakLabel = streak.type === 'win' ? 'winning' : 'losing';
        let streakText = `The ${shortName} have ${streakWord} ${streak.length} straight.`;
        if (ctx) {
          streakText += ` ${articleFor(streak.length)} ${streak.length}-game ${streakLabel} streak has happened ${ctx.count.toLocaleString('en-US')} times in MLB history, most recently the ${ctx.lastTeam} in ${ctx.lastDate}.`;
        }

        await postQuoteTweet(twitterClient, streakText, tweetId);
        await supabase.from('posted_updates').insert({
          game_id,
          post_type: 'Streak',
          details: `${streak.length}-game ${streakLabel} streak`,
          tweet_id: tweetId,
        });
      }
    }

    // Bust per-team yearly caches only for the teams that actually played, plus
    // the ALL view (team_id=0). The 'scorigami' tag handles the aggregated blobs
    // that contain all teams in one cached payload.
    revalidateTag(`team-${away_id}`);
    revalidateTag(`team-${home_id}`);
    revalidateTag('team-0');
    revalidateTag('scorigami');
    } catch (err) {
      console.error(`Error processing game ${g.gamePk}:`, err);
    }
  }

  await pool.query('REFRESH MATERIALIZED VIEW CONCURRENTLY mv_scorigami_summary_ha');
  await pool.query('REFRESH MATERIALIZED VIEW CONCURRENTLY mv_streak_context');

  return NextResponse.json({ success: true });
}
