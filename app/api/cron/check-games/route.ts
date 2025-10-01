import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import TwitterApi from 'twitter-api-v2';
import { MLBGame } from '@/lib/types';

// --- (Team Maps and other type definitions are unchanged) ---
const API_ID_TO_DB_ID_MAP: { [key: number]: number } = {
  108: 8, 109: 9, 144: 21, 110: 23, 111: 41, 145: 70, 112: 73, 113: 79, 114: 86, 115: 95, 116: 114,
  117: 131, 118: 148, 119: 157, 146: 165, 158: 167, 142: 168, 147: 199, 121: 201, 133: 203, 143: 214,
  134: 219, 135: 234, 136: 237, 137: 238, 138: 249, 139: 259, 140: 260, 141: 265, 120: 271,
};
const TEAM_NAME_SHORTENER_MAP: { [key: string]: string } = {
  'Chicago White Sox': 'White Sox', 'Boston Red Sox': 'Red Sox', 'Toronto Blue Jays': 'Blue Jays', 'Arizona Diamondbacks': 'D-backs',
};
// --- NEW --- Added the hashtag map
const TEAM_HASHTAG_MAP: { [key: string]: string } = {
    'Baltimore Orioles': '#Birdland', 'Boston Red Sox': '#DirtyWater', 'New York Yankees': '#RepBX', 'Tampa Bay Rays': '#RaysUp',
    'Toronto Blue Jays': '#LightsUpLetsGo', 'Cleveland Guardians': '#GuardsBall', 'Detroit Tigers': '#RepDetroit', 'Kansas City Royals': '#FountainsUp',
    'Minnesota Twins': '#MNTwins', 'Chicago White Sox': '#WhiteSox', 'Houston Astros': '#BuiltForThis', 'Los Angeles Angels': '#RepTheHalo',
    'Oakland Athletics': '#Athletics', 'Seattle Mariners': '#TridentsUp', 'Texas Rangers': '#AllForTX', 'Atlanta Braves': '#BravesCountry',
    'Miami Marlins': '#MarlinsBeisbol', 'New York Mets': '#LGM', 'Philadelphia Phillies': '#RingTheBell', 'Washington Nationals': '#NATITUDE',
    'Chicago Cubs': '#BeHereForIt', 'Cincinnati Reds': '#ATOBTTR', 'Milwaukee Brewers': '#ThisIsMyCrew', 'Pittsburgh Pirates': '#LetsGoBucs',
    'St. Louis Cardinals': '#ForTheLou', 'Arizona Diamondbacks': '#Dbacks', 'Colorado Rockies': '#Rockies', 'Los Angeles Dodgers': '#LetsGoDodgers',
    'San Diego Padres': '#ForTheFaithful', 'San Francisco Giants': '#SFGiants',
};

interface PostResult { success: boolean; reason?: 'rate-limit' | 'other-error'; }
interface ScoreHistory { occurrences: number; last_game_date: string; }
interface MlbApiGame {
    gamePk: number;
    status: { detailedState: string };
    teams: { away: { team: { name: string; id: number; }; score?: number; }; home: { team: { name: string; id: number; }; score?: number; }; };
    linescore?: { currentInning?: number; currentInningOrdinal?: string; inningState?: string; };
}
interface MlbApiDate { games: MlbApiGame[]; }
interface ScorigamiProbabilityResult {
    totalChance: number;
    mostLikely: { teamName: string; score: string; probability: number; } | null;
}

// --- (Helper functions section is unchanged) ---
const franchiseIdCache: { [key: number]: number[] } = {};
function getOrdinal(n: number): string {
    if (n === 0) return "0"; const s = ["th", "st", "nd", "rd"]; const v = n % 100;
    const suffix = s[(v - 20) % 10] || s[v] || s[0]; return formatNumberWithCommas(n) + suffix;
}
function formatNumberWithCommas(n: number): string { return n.toLocaleString('en-US'); }
function formatOccurrences(count: number): string { const f = formatNumberWithCommas(count); return count === 1 ? `${f} time` : `${f} times`; }
function formatInningState(rawState: string, inning: number): string {
    const l = rawState.toLowerCase(); if (l.startsWith('top')) return `TOP ${inning}`; if (l.startsWith('bot')) return `BOT ${inning}`;
    if (l.startsWith('mid')) return `MID ${inning}`; if (l.startsWith('end')) return `END ${inning}`; return `Inning ${inning}`;
}
async function fetchGameSchedule(): Promise<MLBGame[]> {
  try {
    const res = await fetch('https://statsapi.mlb.com/api/v1/schedule/games/?sportId=1', { cache: 'no-store' });
    if (!res.ok) { console.error("Failed to fetch schedule:", res.status); return []; }
    const data = await res.json(); if (!data.dates || data.dates.length === 0) return [];
    return data.dates.flatMap((d: MlbApiDate) => d.games).map((g: MlbApiGame): MLBGame => ({
      game_id: g.gamePk, status: g.status.detailedState, away_name: g.teams.away.team.name, home_name: g.teams.home.team.name,
      away_score: g.teams.away.score ?? 0, home_score: g.teams.home.score ?? 0, away_id: g.teams.away.team.id, home_id: g.teams.home.team.id,
      inning: g.linescore?.currentInning ?? 0,
      inning_state_raw: g.linescore?.currentInningOrdinal ? `${g.linescore.inningState} of the ${g.linescore.currentInningOrdinal}` : "Pre-Game",
    }));
  } catch (e) { console.error("Error in fetchGameSchedule:", e); return []; }
}
async function fetchDetailedGameData(gamePk: number): Promise<MLBGame | null> {
  try {
    const res = await fetch(`https://statsapi.mlb.com/api/v1.1/game/${gamePk}/feed/live`, { cache: 'no-store' });
    if (!res.ok) { console.error(`Failed to fetch detailed data for ${gamePk}: ${res.status}`); return null; }
    const data = await res.json(); const { liveData, gameData } = data;
    if (!liveData || !gameData || !liveData.linescore) { console.warn(`Live feed for ${gamePk} missing data.`); return null; };
    const { linescore } = liveData; return {
      game_id: gamePk, status: gameData.status.detailedState, away_name: gameData.teams.away.name, home_name: gameData.teams.home.name,
      away_score: linescore.teams.away.runs ?? 0, home_score: linescore.teams.home.runs ?? 0, away_id: gameData.teams.away.id,
      home_id: gameData.teams.home.id, inning: linescore.currentInning ?? 0,
      inning_state_raw: linescore.currentInningOrdinal ? `${linescore.inningState} of the ${linescore.currentInningOrdinal}` : "Pre-Game",
    };
  } catch (e) { console.error(`Error in fetchDetailedGameData for ${gamePk}:`, e); return null; }
}
async function checkIfPosted(supabase: SupabaseClient, game_id: number, details: string): Promise<boolean> {
  const { data, error } = await supabase.from('posted_updates').select('id').eq('game_id', game_id).eq('details', details).limit(1);
  if (error) { console.error("Error checking if posted:", error); return true; } return (data || []).length > 0;
}
async function isGameInQueue(supabase: SupabaseClient, gameId: number): Promise<boolean> {
    const { data, error } = await supabase.from('tweet_queue').select('id').eq('game_id', gameId).eq('status', 'queued').limit(1);
    if (error) { console.error(`Error checking queue for ${gameId}:`, error); return true; } return (data || []).length > 0;
}
async function recordPost(supabase: SupabaseClient, game_id: number, post_type: string, details: string, score: string | null = null): Promise<void> {
  const { error } = await supabase.from('posted_updates').insert({ game_id, post_type, details, score_snapshot: score });
  if (error) console.error("Error recording post:", error);
}
async function fetchLastScoreSnapshot(supabase: SupabaseClient, game_id: number): Promise<string | null> {
  const { data, error } = await supabase.from('posted_updates').select('score_snapshot').eq('game_id', game_id)
    .eq('post_type', 'In_Progress_Update').order('created_at', { ascending: false }).limit(1);
  if (error || !data || !data[0]) { if (error) console.error("Error fetching last score:", error); return null; } return data[0].score_snapshot;
}
async function getFranchiseTeamIds(supabase: SupabaseClient, teamId: number): Promise<number[]> {
    if (franchiseIdCache[teamId]) { return franchiseIdCache[teamId]; }
    const { data: franchiseData, error: franchiseError } = await supabase.from('teams').select('franchise').eq('team_id', teamId).single();
    if (franchiseError || !franchiseData) { console.error(`Could not find franchise for ${teamId}:`, franchiseError); return [teamId]; }
    const franchiseAbbr = franchiseData.franchise;
    const { data: teamIdsData, error: teamIdsError } = await supabase.from('teams').select('team_id').eq('franchise', franchiseAbbr);
    if (teamIdsError || !teamIdsData) { console.error(`Could not find team IDs for ${franchiseAbbr}:`, teamIdsError); return [teamId]; }
    const ids = teamIdsData.map(t => t.team_id); franchiseIdCache[teamId] = ids; return ids;
}
async function queuePostForLater(supabase: SupabaseClient, postText: string, gameId: number): Promise<void> {
  if (await isGameInQueue(supabase, gameId)) { console.log(`[QUEUE] Game ${gameId} is already queued. Skipping.`); return; }
  console.log(`[QUEUE] Adding post for game ${gameId} to queue due to rate limit.`);
  const { error } = await supabase.from('tweet_queue').insert({ post_text: postText, game_id: gameId, status: 'queued' });
  if (error) console.error("CRITICAL: Error saving post to queue:", error);
}
async function postToX(twitterClient: TwitterApi, text: string): Promise<PostResult> {
  const isProd = process.env.ENABLE_POSTING === 'true'; if (!isProd) {
    console.log("✅ [POSTING DISABLED] WOULD TWEET:", `\n---\n${text}\n---`); return { success: true };
  } try { await twitterClient.v2.tweet(text); console.log("🚀 Post sent to X successfully!"); return { success: true };
  } catch (e) { const error = e as { code?: number }; if (error.code === 429) { console.warn("🚫 Rate limit hit."); return { success: false, reason: 'rate-limit' };
    } console.error("Failed to post to X:", e); return { success: false, reason: 'other-error' };
  }
}
async function checkTrueScorigami(supabase: SupabaseClient, s1: number, s2: number): Promise<{ isScorigami: true, newCount: number } | { isScorigami: false }> {
    const winningScore = Math.max(s1, s2); const losingScore = Math.min(s1, s2);
    const { data, error } = await supabase.from('gamelogs').select('game_id').or(`and(home_score.eq.${winningScore},visitor_score.eq.${losingScore}),and(home_score.eq.${losingScore},visitor_score.eq.${winningScore})`).limit(1);
    if (error) { console.error("Error checking true scorigami:", error); return { isScorigami: false }; }
    if (data.length > 0) { return { isScorigami: false }; }
    const { count, error: countError } = await supabase.from('gamelogs').select('home_score, visitor_score', { count: 'exact', head: true });
    if (countError) { console.error("Error counting scorigamis:", countError); return { isScorigami: true, newCount: 0 }; }
    return { isScorigami: true, newCount: (count || 0) + 1 };
}
async function isFranchiseScorigami(supabase: SupabaseClient, franchiseIds: number[], teamScore: number, opponentScore: number): Promise<boolean> {
    const ids = `(${franchiseIds.join(',')})`;
    const { data, error } = await supabase.from('gamelogs').select('game_id').or(
      `and(home_team_id.in.${ids},home_score.eq.${teamScore},visitor_score.eq.${opponentScore}),` +
      `and(visitor_team_id.in.${ids},visitor_score.eq.${teamScore},home_score.eq.${opponentScore}),` +
      `and(home_team_id.in.${ids},home_score.eq.${opponentScore},visitor_score.eq.${teamScore}),` +
      `and(visitor_team_id.in.${ids},visitor_score.eq.${opponentScore},home_score.eq.${teamScore})`
    ).limit(1); if (error) { console.error("Error checking franchise scorigami:", error); return false; } return data.length === 0;
}
async function getScoreHistory(supabase: SupabaseClient, s1: number, s2: number): Promise<ScoreHistory | null> {
    const winningScore = Math.max(s1, s2); const losingScore = Math.min(s1, s2);
    const { count, data, error } = await supabase.from('gamelogs').select('date', { count: 'exact' }).or(`and(home_score.eq.${winningScore},visitor_score.eq.${losingScore}),and(home_score.eq.${losingScore},visitor_score.eq.${winningScore})`).order('date', { ascending: false }).limit(1);
    if (error || !data || data.length === 0) { if (error) console.error("Error fetching score history:", error); return null; }
    return { occurrences: count || 0, last_game_date: new Date(data[0].date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) };
}
const FACTORIALS: number[] = [1];
function factorial(n: number): number {
    if (n < 0) return NaN; if (n >= FACTORIALS.length) { for (let i = FACTORIALS.length; i <= n; i++) { FACTORIALS[i] = FACTORIALS[i - 1] * i; } } return FACTORIALS[n];
}
function poissonProbability(lambda: number, k: number): number {
    if (lambda < 0 || k < 0) return 0; return (Math.pow(lambda, k) * Math.exp(-lambda)) / factorial(k);
}
async function calculateFranchiseScorigamiProbability(supabase: SupabaseClient, game: MLBGame, dbAwayId: number, dbHomeId: number): Promise<ScorigamiProbabilityResult | null> {
    const awayFranchiseIds = await getFranchiseTeamIds(supabase, dbAwayId); const homeFranchiseIds = await getFranchiseTeamIds(supabase, dbHomeId);
    const AVG_RUNS_PER_INNING_PER_TEAM = 0.5; const MAX_ADDITIONAL_RUNS_TO_CHECK = 20; const inningsRemaining = 9 - game.inning;
    if (inningsRemaining <= 0) return null; const lambda = inningsRemaining * AVG_RUNS_PER_INNING_PER_TEAM * 2;
    let totalScorigamiChance = 0; let mostLikelyScorigami = { teamName: "", score: "", probability: 0 };
    const scorigamiCheckCache: { [key: string]: boolean | undefined } = {};
    for (let k = 0; k <= MAX_ADDITIONAL_RUNS_TO_CHECK; k++) {
        const probOfKMoreRuns = poissonProbability(lambda, k); if (probOfKMoreRuns < 0.00001) break;
        for (let awayRuns = 0; awayRuns <= k; awayRuns++) {
            const homeRuns = k - awayRuns; const finalAwayScore = game.away_score + awayRuns; const finalHomeScore = game.home_score + homeRuns;
            const individualScoreProbability = probOfKMoreRuns / (k + 1); const homeKey = `h-${finalHomeScore}-${finalAwayScore}`;
            if (scorigamiCheckCache[homeKey] === undefined) { scorigamiCheckCache[homeKey] = await isFranchiseScorigami(supabase, homeFranchiseIds, finalHomeScore, finalAwayScore); }
            if (scorigamiCheckCache[homeKey]) {
                totalScorigamiChance += individualScoreProbability;
                if (individualScoreProbability > mostLikelyScorigami.probability) { mostLikelyScorigami = { teamName: game.home_name, score: `${finalHomeScore}-${finalAwayScore}`, probability: individualScoreProbability }; }
            }
            const awayKey = `a-${finalAwayScore}-${finalHomeScore}`;
            if (scorigamiCheckCache[awayKey] === undefined) { scorigamiCheckCache[awayKey] = await isFranchiseScorigami(supabase, awayFranchiseIds, finalAwayScore, finalHomeScore); }
            if (scorigamiCheckCache[awayKey]) {
                totalScorigamiChance += individualScoreProbability;
                if (individualScoreProbability > mostLikelyScorigami.probability) { mostLikelyScorigami = { teamName: game.away_name, score: `${finalAwayScore}-${finalHomeScore}`, probability: individualScoreProbability }; }
            }
        }
    }
    if (totalScorigamiChance === 0) return null; return { totalChance: totalScorigamiChance, mostLikely: mostLikelyScorigami.probability > 0 ? mostLikelyScorigami : null };
}

// --- MAIN API ROUTE HANDLER ---
export async function GET(request: NextRequest): Promise<NextResponse> {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const twitterClient = new TwitterApi({
    appKey: process.env.X_APP_KEY!, appSecret: process.env.X_APP_SECRET!,
    accessToken: process.env.X_ACCESS_TOKEN!, accessSecret: process.env.X_ACCESS_SECRET!,
  });

  const scheduleGames = await fetchGameSchedule();

  const FINAL_STATES = ['Final', 'Game Over', 'Completed Early'];
  const IN_PROGRESS_STATES = ['In Progress', 'Live'];

  for (let game of scheduleGames) {
    const isFinal = FINAL_STATES.includes(game.status);
    const isInProgress = IN_PROGRESS_STATES.includes(game.status);

    if (isInProgress) {
      console.log(`[DATA] Game ${game.game_id} is In Progress. Fetching detailed feed...`);
      const detailedGameData = await fetchDetailedGameData(game.game_id);
      if (detailedGameData) {
        game = detailedGameData;
        console.log(`[DATA] Fresh data for ${game.game_id}: Inning ${game.inning}, Score ${game.away_score}-${game.home_score}`);
      } else {
        console.warn(`[DATA] Could not fetch detailed data for live game ${game.game_id}. Skipping for this run.`);
        continue;
      }
    }

    const { away_score, home_score, away_name, home_name, game_id } = game;
    const scoreSnapshot = `${away_score}-${home_score}`;
    const away_team_short_name = TEAM_NAME_SHORTENER_MAP[away_name] || away_name.split(' ').pop() || away_name;
    const home_team_short_name = TEAM_NAME_SHORTENER_MAP[home_name] || home_name.split(' ').pop() || home_name;
    const dbAwayId = API_ID_TO_DB_ID_MAP[game.away_id];
    const dbHomeId = API_ID_TO_DB_ID_MAP[game.home_id];

    if (!dbAwayId || !dbHomeId) {
        console.warn(`Could not find a DB ID mapping for game ${game_id}. Skipping.`);
        continue;
    }

    if (isFinal) {
        if (await checkIfPosted(supabase, game_id, 'Final')) continue;

        const awayFranchiseIds = await getFranchiseTeamIds(supabase, dbAwayId);
        const homeFranchiseIds = await getFranchiseTeamIds(supabase, dbHomeId);

        const isTie = away_score === home_score;

        if (isTie) {
            console.log(`[PROCESS] Game ${game_id} is a tie. Posting as an exception.`);
            const tiePostText = `FINAL/TIE: ${away_team_short_name} ${away_score}, ${home_team_short_name} ${home_score}\n\nA rare tie in MLB!`;
            const postResult = await postToX(twitterClient, tiePostText);
            if (postResult.success) {
                await recordPost(supabase, game.game_id, 'Final_Tie', 'Final', scoreSnapshot);
            } else if (postResult.reason === 'rate-limit') {
                await queuePostForLater(supabase, tiePostText, game.game_id);
            }
            continue;
        }

        // --- REMOVED --- Removed the totalRuns < 8 check
        
        let postText = "";

        // Define winner/loser to use for consistent formatting
        const winnerIsAway = away_score > home_score;
        const winnerName = winnerIsAway ? away_team_short_name : home_team_short_name;
        const loserName = winnerIsAway ? home_team_short_name : away_team_short_name;
        const winnerScore = Math.max(away_score, home_score);
        const loserScore = Math.min(away_score, home_score);

        // --- NEW --- Look up hashtags for winner and loser
        const winnerHashtag = TEAM_HASHTAG_MAP[winnerIsAway ? away_name : home_name] || `#${winnerName.replace(/\s/g, '')}`;
        const loserHashtag = TEAM_HASHTAG_MAP[winnerIsAway ? home_name : away_name] || `#${loserName.replace(/\s/g, '')}`;

        // Always format header with winner first
        const finalScoreHeader = `FINAL: ${winnerName} ${winnerScore}, ${loserName} ${loserScore}`;
        // --- NEW --- Create the hashtag line
        const hashtagLine = `${winnerHashtag} // ${loserHashtag}`;

        const trueScorigamiResult = await checkTrueScorigami(supabase, away_score, home_score);
        if (trueScorigamiResult.isScorigami) {
            const newCountOrdinal = getOrdinal(trueScorigamiResult.newCount);
            // --- UPDATED ---
            postText = `${finalScoreHeader}\n${hashtagLine}\n\n🚨 That's Scorigami!\nThe ${newCountOrdinal} unique score combination in MLB history.`;
        } else {
            const isAwayScorigami = await isFranchiseScorigami(supabase, awayFranchiseIds, away_score, home_score);
            const isHomeScorigami = await isFranchiseScorigami(supabase, homeFranchiseIds, home_score, away_score);

            if (isAwayScorigami || isHomeScorigami) {
                const history = await getScoreHistory(supabase, away_score, home_score);
                const historyLine = history
                    ? `This score has occurred ${formatOccurrences(history.occurrences)} in MLB history, last on ${history.last_game_date}.`
                    : '';

                let descriptionLine = "";
                if (isAwayScorigami && isHomeScorigami) {
                    descriptionLine = `The first ${winnerScore}-${loserScore} score combination in franchise history for both the ${winnerName} and the ${loserName}.`;
                } else {
                    const scorigamiTeamName = isAwayScorigami ? away_team_short_name : home_team_short_name;
                    descriptionLine = `The first ${winnerScore}-${loserScore} score combination in ${scorigamiTeamName} franchise history.`;
                }
                
                // --- UPDATED ---
                postText = `${finalScoreHeader}\n${hashtagLine}\n\n🚨 That's Franchisigami!\n${descriptionLine}\n\n${historyLine}`.trim();

            } else {
                const history = await getScoreHistory(supabase, away_score, home_score);
                if (history) {
                    const historyLine = `This score has occurred ${formatOccurrences(history.occurrences)} in MLB history, last on ${history.last_game_date}.`;
                    // --- UPDATED ---
                    postText = `${finalScoreHeader}\n${hashtagLine}\n\nNo Scorigami. ${historyLine}`.trim();
                }
            }
        }

        if (postText) {
            const postResult = await postToX(twitterClient, postText);
            if (postResult.success) { await recordPost(supabase, game.game_id, 'Final', 'Final', scoreSnapshot); }
            else if (postResult.reason === 'rate-limit') { await queuePostForLater(supabase, postText, game.game_id); }
        } else {
            await recordPost(supabase, game_id, 'Processed_No_Post', 'Final', scoreSnapshot);
        }
    }
    else if (game.inning >= 6 && game.inning < 9 && (game.away_score >= 13 || game.home_score >= 13)) {

        const lastScoreSnapshot = await fetchLastScoreSnapshot(supabase, game.game_id);
        if (lastScoreSnapshot === scoreSnapshot) {
            console.log(`[FILTER] Skipping update for game ${game.game_id}, score is unchanged.`);
            continue;
        }

        const postDetail = `In-Progress Update - Inning ${game.inning}`;
        if (await checkIfPosted(supabase, game.game_id, postDetail)) continue;

        const probabilityResult = await calculateFranchiseScorigamiProbability(supabase, game, dbAwayId, dbHomeId);
        if (!probabilityResult || !probabilityResult.mostLikely) continue;

        // --- NEW --- Look up hashtags for in-progress games
        const awayHashtag = TEAM_HASHTAG_MAP[away_name] || `#${away_team_short_name.replace(/\s/g, '')}`;
        const homeHashtag = TEAM_HASHTAG_MAP[home_name] || `#${home_team_short_name.replace(/\s/g, '')}`;

        const { mostLikely, totalChance } = probabilityResult;
        const formattedInning = formatInningState(game.inning_state_raw, game.inning);
        
        // --- UPDATED --- Rebuild the postText with the new format
        const headerLine = `${formattedInning}: ${away_team_short_name} ${away_score}, ${home_team_short_name} ${home_score}`;
        const hashtagLine = `${awayHashtag} // ${homeHashtag}`;
        const descriptionLine = `There is a ${(totalChance * 100).toFixed(1)}% chance of a franchise scorigami occurring in this game.`;
        const mostLikelyLine = `Most likely outcome: ${mostLikely.score}.`;
        
        const postText = `${headerLine}\n${hashtagLine}\n\n🔎 Franchisigami Watch!\n${descriptionLine}\n\n${mostLikelyLine}`;

        const postResult = await postToX(twitterClient, postText);
        if (postResult.success) {
            await recordPost(supabase, game.game_id, 'In_Progress_Update', postDetail, scoreSnapshot);
        } else if (postResult.reason === 'rate-limit') {
            await queuePostForLater(supabase, postText, game.game_id);
        }
    }
  }

  return NextResponse.json({ success: true, message: `Game check complete. Processed ${scheduleGames.length} games.` });
}