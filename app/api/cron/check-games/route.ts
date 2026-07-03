import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
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
  'Athletics': "A'sigami",
  'Oakland Athletics': "A'sigami",
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

// Historical names of franchises that still exist today. Used to recognize a
// historical record (e.g., 1986 "Cleveland Indians") as belonging to a current
// MLB franchise so we use the modern abbreviation (CLE) instead of the full name.
const RENAMED_FRANCHISES: Record<string, string> = {
  'Cleveland Indians': 'Cleveland Guardians',
  'Tampa Bay Devil Rays': 'Tampa Bay Rays',
  'Florida Marlins': 'Miami Marlins',
  'Anaheim Angels': 'Los Angeles Angels',
  'California Angels': 'Los Angeles Angels',
  'Los Angeles Angels of Anaheim': 'Los Angeles Angels',
  'Houston Colt .45s': 'Houston Astros',
  'Brooklyn Dodgers': 'Los Angeles Dodgers',
  'New York Giants': 'San Francisco Giants',
  'Montreal Expos': 'Washington Nationals',
  'Philadelphia Athletics': 'Athletics',
  'Kansas City Athletics': 'Athletics',
  'Oakland Athletics': 'Athletics',
  'Seattle Pilots': 'Milwaukee Brewers',
};

function canonicalFranchise(name: string): string {
  return RENAMED_FRANCHISES[name] ?? name;
}

const START_YEAR = 1871;
const MODERN_ERA_YEAR = 1901;

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

async function isModernEraScorigami(supabase: SupabaseClient, s1: number, s2: number): Promise<boolean> {
  const win = Math.max(s1, s2);
  const lose = Math.min(s1, s2);
  const { data } = await supabase.from('gamelogs').select('game_id')
    .or(`and(home_score.eq.${win},visitor_score.eq.${lose}),and(home_score.eq.${lose},visitor_score.eq.${win})`)
    .eq('is_negro_league', false)
    .gte('date', `${MODERN_ERA_YEAR}-01-01`)
    .limit(1);
  return !data || data.length === 0;
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

interface GameSnapshot {
  endedAt: string | null;
  abstractGameState: string | null;
  awayScore: number | null;
  homeScore: number | null;
}

async function fetchGameSnapshot(gamePk: number): Promise<GameSnapshot> {
  const empty: GameSnapshot = { endedAt: null, abstractGameState: null, awayScore: null, homeScore: null };
  try {
    const res = await fetch(`https://statsapi.mlb.com/api/v1.1/game/${gamePk}/feed/live`, { cache: 'no-store' });
    if (!res.ok) return empty;
    const d = await res.json();

    let endedAt: string | null = null;
    const plays = d?.liveData?.plays?.allPlays;
    if (Array.isArray(plays) && plays.length > 0) {
      const endTime = plays[plays.length - 1]?.about?.endTime;
      if (endTime) endedAt = endTime;
    }
    if (!endedAt) {
      const gi = d?.gameData?.gameInfo;
      if (gi?.firstPitch && typeof gi.gameDurationMinutes === 'number') {
        const fp = new Date(gi.firstPitch);
        endedAt = new Date(fp.getTime() + gi.gameDurationMinutes * 60_000).toISOString();
      }
    }

    const abstractGameState = d?.gameData?.status?.abstractGameState ?? null;
    const linescoreTeams = d?.liveData?.linescore?.teams;
    const awayScore = typeof linescoreTeams?.away?.runs === 'number' ? linescoreTeams.away.runs : null;
    const homeScore = typeof linescoreTeams?.home?.runs === 'number' ? linescoreTeams.home.runs : null;

    return { endedAt, abstractGameState, awayScore, homeScore };
  } catch {
    return empty;
  }
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

async function postTweet(twitterClient: TwitterApi, postText: string): Promise<string | null> {
  if (process.env.ENABLE_POSTING === 'true') {
    const tweet = await twitterClient.v2.tweet(postText);
    return tweet.data.id;
  } else {
    console.log("WOULD TWEET:", postText);
    return null;
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
    candidates.map(async (g) => ({ g, snapshot: await fetchGameSnapshot(g.gamePk) }))
  );
  enriched.sort((a, b) => {
    const ta = a.snapshot.endedAt ? new Date(a.snapshot.endedAt).getTime() : Number.MAX_SAFE_INTEGER;
    const tb = b.snapshot.endedAt ? new Date(b.snapshot.endedAt).getTime() : Number.MAX_SAFE_INTEGER;
    return ta - tb;
  });

  for (const { g, snapshot } of enriched) {
    try {
    const game_id = g.gamePk;
    const away_id = g.teams.away.team.id;
    const home_id = g.teams.home.team.id;

    // Trust the live feed over the schedule API. The schedule endpoint can
    // briefly mark a game Final with stale (regulation-end) scores during the
    // flip to extras — the live feed always has the truth. Skip until both
    // endpoints converge.
    if (snapshot.abstractGameState !== 'Final' || snapshot.awayScore === null || snapshot.homeScore === null) {
      continue;
    }
    const away_score = snapshot.awayScore;
    const home_score = snapshot.homeScore;
    const endedAt = snapshot.endedAt;
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
      revalidateTag('archive');

    } else if (isPostseason && playoffBreakdown && playoffBreakdown.total === 0) {
      // 2. Playoffigami
      const playoffCount = await getUniquePlayoffScoreCount();
      postText = `${header}\n\nThat's Playoffigami! It's the ${getOrdinal(playoffCount + 1)} unique final score in MLB playoff history.`;
      revalidateTag('archive');

    } else if (await isModernEraScorigami(supabase, away_score, home_score)) {
      // 3. Modern Era Scorigami — first time this score has occurred since 1901
      // Winner-first ordering to match header convention.
      const homeWon = history.last_home_score > history.last_visitor_score;
      const lastWinner = homeWon ? history.last_home_team : history.last_visitor_team;
      const lastLoser  = homeWon ? history.last_visitor_team : history.last_home_team;
      const winnerCanonical = canonicalFranchise(lastWinner);
      const loserCanonical = canonicalFranchise(lastLoser);
      const winnerModern = winnerCanonical in TEAM_IGAMI_MAP;
      const loserModern = loserCanonical in TEAM_IGAMI_MAP;
      const winnerDisplay = winnerModern && loserModern ? teamAbbr(winnerCanonical) : lastWinner;
      const loserDisplay = winnerModern && loserModern ? teamAbbr(loserCanonical) : lastLoser;
      const occurrencesPhrase = history.occurrences === 1 ? 'only once' : `only ${formatNum(history.occurrences)} times`;
      postText = `${header}\n\nThat's Modern Era Scorigami! It's the first time this score has occurred in MLB's modern era.\n\nIt's happened ${occurrencesPhrase} in MLB history, most recently on ${history.last_game_date} (${winnerDisplay} vs. ${loserDisplay}).`;
      revalidateTag('archive');

    } else {
      // 4. Franchisigami or No Scorigami
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
        .select('score_snapshot, created_at, ended_at, game_id')
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
      // Re-sort by ended_at (when the game actually finished), not created_at
      // (when the cron posted). Those can drift apart when the MLB API lags on
      // flipping a game to Final — and we want sameScoreToday[0] to be the
      // truly most-recently-finished prior for both the recency clause and
      // the (TEAM vs. TEAM) context.
      sameScoreToday.sort((a, b) => {
        const ta = new Date(a.ended_at ?? a.created_at).getTime();
        const tb = new Date(b.ended_at ?? b.created_at).getTime();
        return tb - ta;
      });
      const todayMatchCount = sameScoreToday.length;
      const priorEndedAt = sameScoreToday[0]?.ended_at ?? history?.last_ended_at ?? null;
      const totalOccurrences = (history?.occurrences ?? 0) + todayMatchCount;
      const lastDateRaw = todayMatchCount > 0
        ? new Date(sameScoreToday[0].ended_at ?? sameScoreToday[0].created_at).toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' })
        : (history?.last_game_date_raw?.slice(0, 10) ?? '');
      const mostRecently = formatRecency(priorEndedAt, endedAt, lastDateRaw, yesterdayPT, history?.last_game_date ?? '', todayMatchCount);
      // Doubleheader rematch: a prior same-score post today involves these same
      // two teams. Two teams only play twice on one day in a doubleheader, so this
      // is sufficient — no need to inspect the API's doubleHeader field.
      const isDoubleheaderRematch = sameScoreToday.some((p) => {
        const priorGame = scheduleGames.find((sg) => sg.gamePk === p.game_id);
        if (!priorGame) return false;
        const priorAwayId = priorGame.teams.away.team.id;
        const priorHomeId = priorGame.teams.home.team.id;
        return (priorAwayId === away_id && priorHomeId === home_id)
            || (priorAwayId === home_id && priorHomeId === away_id);
      });
      // Team context for the prior occurrence. Sources, in priority order:
      //   1. Doubleheader rematch — skip; the recency clause is already self-explanatory.
      //   2. Same-day prior — look up the prior game's teams in today's schedule.
      //   3. Older historical prior — use the names stored on the history row.
      // Use 3-letter abbreviations only when both teams are current MLB franchises
      // (TEAM_IGAMI_MAP doubles as the modern-team set). For matchups involving
      // historical teams (Brooklyn Bridegrooms, Cleveland Naps, etc.) the abbr
      // map has gaps, so fall back to full team names — clearer than guessing codes.
      // Winner-first ordering: matches the header ("White Sox 22, Royals 1")
      // and avoids the confusion of naming the loser first as the away team.
      const buildTeamContext = (winnerName: string, loserName: string): string => {
        const winnerCanonical = canonicalFranchise(winnerName);
        const loserCanonical = canonicalFranchise(loserName);
        const winnerModern = winnerCanonical in TEAM_IGAMI_MAP;
        const loserModern = loserCanonical in TEAM_IGAMI_MAP;
        const winnerDisplay = winnerModern && loserModern ? teamAbbr(winnerCanonical) : winnerName;
        const loserDisplay = winnerModern && loserModern ? teamAbbr(loserCanonical) : loserName;
        return ` (${winnerDisplay} vs. ${loserDisplay})`;
      };
      let teamContext = '';
      if (isDoubleheaderRematch) {
        // skip
      } else if (todayMatchCount > 0) {
        const priorGame = scheduleGames.find((sg) => sg.gamePk === sameScoreToday[0].game_id);
        if (priorGame) {
          // score_snapshot is `${away_score}-${home_score}` — decide winner from that.
          const [priorAwayStr, priorHomeStr] = (sameScoreToday[0].score_snapshot ?? '').split('-');
          const priorAwayScore = Number(priorAwayStr);
          const priorHomeScore = Number(priorHomeStr);
          const awayWon = priorAwayScore > priorHomeScore;
          const winner = awayWon ? priorGame.teams.away.team.name : priorGame.teams.home.team.name;
          const loser  = awayWon ? priorGame.teams.home.team.name : priorGame.teams.away.team.name;
          teamContext = buildTeamContext(winner, loser);
        }
      } else if (history) {
        const homeWon = history.last_home_score > history.last_visitor_score;
        const winner = homeWon ? history.last_home_team : history.last_visitor_team;
        const loser  = homeWon ? history.last_visitor_team : history.last_home_team;
        teamContext = buildTeamContext(winner, loser);
      }
      const recencyClause = isDoubleheaderRematch
        ? `, most recently when these same two teams played earlier today`
        : `, most recently ${mostRecently}`;

      if (isAwayS || isHomeS) {
        const occurrenceNumber = totalOccurrences + 1;
        const onlyWord = occurrenceNumber < 26 ? 'only ' : '';
        const historySuffix = history ? ` and ${onlyWord}the ${getOrdinal(occurrenceNumber)} time in MLB history${recencyClause}${teamContext}` : '';

        const awayShort = TEAM_NAME_SHORTENER_MAP[away_name] || away_name.split(' ').pop();
        const homeShort = TEAM_NAME_SHORTENER_MAP[home_name] || home_name.split(' ').pop();

        let franchiseLine: string;
        let igamiLabel: string;
        if (isAwayS && isHomeS) {
          franchiseLine = `It's the first time this score has happened for either franchise${historySuffix}.`;
          igamiLabel = 'Franchisigami';
        } else {
          const teamShort = isAwayS ? awayShort : homeShort;
          const teamFull = isAwayS ? away_name : home_name;
          franchiseLine = `It's the first time in ${teamShort} history this score has happened${historySuffix}.`;
          igamiLabel = teamIgami(teamFull);
        }

        postText = `${header}\n\nThat's ${igamiLabel}!\n\n${franchiseLine}`;
      } else {
        const isRarigami = totalOccurrences < 100;
        if (isRarigami && history) {
          const rarePhrase = totalOccurrences === 1 ? 'only once' : `only ${formatNum(totalOccurrences)} times`;
          postText = `${header}\n\nRarigami. This score has happened ${rarePhrase} in MLB history${recencyClause}${teamContext}.`;
          revalidateTag('archive');
        } else {
          postText = `${header}\n\nNo scorigami. This score has happened ${formatNum(totalOccurrences)} times in MLB history${recencyClause}${teamContext}.`;
        }
      }
    }

    const tweetId = await postTweet(twitterClient, postText);

    await supabase.from('posted_updates').insert({
      game_id,
      post_type: 'Final',
      details: 'Final Score',
      score_snapshot: `${away_score}-${home_score}`,
      tweet_id: tweetId,
      ended_at: endedAt,
    });

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

  return NextResponse.json({ success: true });
}
