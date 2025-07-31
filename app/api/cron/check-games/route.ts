// /frontend/app/api/cron/check-games/route.ts (PRODUCTION - FINAL VERIFIED CODE)

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import TwitterApi from 'twitter-api-v2';
import { MLBGame } from '@/lib/types';

// --- ✨ TEAM ID MAPPING LAYER ✨ ---
const API_ID_TO_DB_ID_MAP: { [key: number]: number } = {
  108: 8,   // ANA - Los Angeles Angels
  109: 9,   // ARI - Arizona Diamondbacks
  144: 21,  // ATL - Atlanta Braves
  110: 23,  // BAL - Baltimore Orioles
  111: 41,  // BOS - Boston Red Sox
  145: 70,  // CHA - Chicago White Sox
  112: 73,  // CHN - Chicago Cubs
  113: 79,  // CIN - Cincinnati Reds
  114: 86,  // CLE - Cleveland Guardians
  115: 95,  // COL - Colorado Rockies
  116: 114, // DET - Detroit Tigers
  117: 131, // HOU - Houston Astros
  118: 148, // KCA - Kansas City Royals
  119: 157, // LAN - Los Angeles Dodgers
  146: 165, // MIA - Miami Marlins
  158: 167, // MIL - Milwaukee Brewers
  142: 168, // MIN - Minnesota Twins
  147: 199, // NYA - New York Yankees
  121: 201, // NYN - New York Mets
  133: 203, // OAK - Oakland Athletics
  143: 214, // PHI - Philadelphia Phillies
  134: 219, // PIT - Pittsburgh Pirates
  135: 234, // SDN - San Diego Padres
  136: 237, // SEA - Seattle Mariners
  137: 238, // SFN - San Francisco Giants
  138: 249, // SLN - St. Louis Cardinals
  139: 259, // TBA - Tampa Bay Rays
  140: 260, // TEX - Texas Rangers
  141: 265, // TOR - Toronto Blue Jays
  120: 271, // WAS - Washington Nationals
};

// --- ✨ NEW: TEAM NAME SHORTENER MAP ✨ ---
const TEAM_NAME_SHORTENER_MAP: { [key: string]: string } = {
  'Chicago White Sox': 'White Sox',
  'Boston Red Sox': 'Red Sox',
  'Toronto Blue Jays': 'Blue Jays',
  'Arizona Diamondbacks': 'D-backs',
};


// --- TYPE DEFINITIONS ---
interface PostResult {
  success: boolean;
  reason?: 'rate-limit' | 'other-error';
}
interface ScoreHistory {
  occurrences: number;
  last_game_date: string;
}
interface MlbApiGame {
    gamePk: number;
    status: { detailedState: string };
    teams: { away: { team: { name: string; id: number; }; score?: number; }; home: { team: { name: string; id: number; }; score?: number; }; };
    linescore?: { currentInning?: number; currentInningOrdinal?: string; inningState?: string; };
}
interface MlbApiDate {
    games: MlbApiGame[];
}
interface ScorigamiProbabilityResult {
    totalChance: number;
    mostLikely: {
        teamName: string;
        score: string;
        probability: number;
    } | null;
}


// --- HELPER FUNCTIONS ---

function getOrdinal(n: number): string {
    if (n === 0) return "0";
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    const suffix = s[(v - 20) % 10] || s[v] || s[0];
    return formatNumberWithCommas(n) + suffix;
}

function formatNumberWithCommas(n: number): string {
    return n.toLocaleString('en-US');
}

async function fetchLiveGames(): Promise<MLBGame[]> {
  try {
    const response = await fetch('https://statsapi.mlb.com/api/v1/schedule/games/?sportId=1', { cache: 'no-store' });
    if (!response.ok) { console.error("Failed to fetch MLB data:", response.status); return []; }
    const data = await response.json();
    if (!data.dates || data.dates.length === 0) return [];
    return data.dates.flatMap((date: MlbApiDate) => date.games).map((g: MlbApiGame): MLBGame => ({
      game_id: g.gamePk, status: g.status.detailedState, away_name: g.teams.away.team.name,
      home_name: g.teams.home.team.name, away_score: g.teams.away.score ?? 0, home_score: g.teams.home.score ?? 0,
      away_id: g.teams.away.team.id, home_id: g.teams.home.team.id, inning: g.linescore?.currentInning ?? 0,
      inning_state_raw: g.linescore?.currentInningOrdinal ? `${g.linescore.inningState} of the ${g.linescore.currentInningOrdinal}` : "Pre-Game",
    }));
  } catch (error) { console.error("Error in fetchLiveGames:", error); return []; }
}

async function checkIfPosted(supabase: SupabaseClient, game_id: number, details: string): Promise<boolean> {
  const { data, error } = await supabase.from('posted_updates').select('id').eq('game_id', game_id).eq('details', details).limit(1);
  if (error) { console.error("Error checking if posted:", error); return true; } // Fail safe to avoid double posts
  return (data || []).length > 0;
}

async function recordPost(supabase: SupabaseClient, game_id: number, post_type: string, details: string) {
  const { error } = await supabase.from('posted_updates').insert({ game_id, post_type, details });
  if (error) console.error("Error recording post:", error);
}

async function queuePostForLater(supabase: SupabaseClient, postText: string, gameId: number) {
  console.log(`[QUEUE] Adding post for game ${gameId} to the queue due to rate limit.`);
  const { error } = await supabase.from('tweet_queue').insert({
    post_text: postText,
    game_id: gameId,
    status: 'queued',
  });
  if (error) {
    console.error("CRITICAL: Error saving post to queue:", error);
  }
}

async function postToX(twitterClient: TwitterApi, text: string): Promise<PostResult> {
  const isProductionPosting = process.env.ENABLE_POSTING === 'true';
  if (!isProductionPosting) {
    console.log("✅ [POSTING DISABLED] WOULD TWEET:", `\n---\n${text}\n---`);
    return { success: true };
  }
  try {
    const result = await twitterClient.v2.post('tweets', { text });
    console.log("🚀 Post sent to X successfully!");

    if (result.rateLimit) {
      const { limit, remaining, reset } = result.rateLimit;
      const resetTime = new Date(reset * 1000).toLocaleString('en-US', { timeZone: 'America/New_York' });
      console.log(`📊 Rate Limit Status: ${remaining}/${limit} posts remaining. Resets at: ${resetTime}`);
    }

    return { success: true };
  } catch (e) {
    const error = e as { code?: number };
    if (error.code === 429) {
      console.warn("🚫 Rate limit hit. Handing off to the queue system.");
      return { success: false, reason: 'rate-limit' };
    }
    console.error("Failed to post to X for a non-rate-limit reason:", e);
    return { success: false, reason: 'other-error' };
  }
}

async function checkTrueScorigami(supabase: SupabaseClient, s1: number, s2: number): Promise<{ isScorigami: true, newCount: number } | { isScorigami: false }> {
    const winningScore = Math.max(s1, s2);
    const losingScore = Math.min(s1, s2);
    const { data, error } = await supabase.from('gamelogs').select('game_id').or(`and(home_score.eq.${winningScore},visitor_score.eq.${losingScore}),and(home_score.eq.${losingScore},visitor_score.eq.${winningScore})`).limit(1);
    if (error) { console.error("Error checking true scorigami:", error); return { isScorigami: false }; }
    if (data.length > 0) { return { isScorigami: false }; }
    const { count, error: countError } = await supabase.from('gamelogs').select('home_score, visitor_score', { count: 'exact', head: true });
    if (countError) { console.error("Error counting total scorigamis:", countError); return { isScorigami: true, newCount: 0 }; }
    return { isScorigami: true, newCount: (count || 0) + 1 };
}

async function isFranchiseScorigami(supabase: SupabaseClient, teamId: number, s1: number, s2: number): Promise<boolean> {
    const { data, error } = await supabase
        .from('gamelogs')
        .select('game_id')
        .or(`and(home_team_id.eq.${teamId},home_score.eq.${s1},visitor_score.eq.${s2}),and(visitor_team_id.eq.${teamId},visitor_score.eq.${s1},home_score.eq.${s2}),and(home_team_id.eq.${teamId},home_score.eq.${s2},visitor_score.eq.${s1}),and(visitor_team_id.eq.${teamId},visitor_score.eq.${s2},home_score.eq.${s1})`)
        .limit(1);

    if (error) {
        console.error("Error checking franchise scorigami in gamelogs:", error);
        return false;
    }
    return data.length === 0;
}

async function getFranchiseScorigamiCount(supabase: SupabaseClient, teamId: number): Promise<number> {
     const { data, error } = await supabase
        .from('gamelogs')
        .select('home_team_id, visitor_team_id, home_score, visitor_score')
        .or(`home_team_id.eq.${teamId},visitor_team_id.eq.${teamId}`);
    if (error) { return 0; }
    const uniqueScores = new Set();
    data.forEach(game => {
        const score = game.home_team_id === teamId ? `${game.home_score}-${game.visitor_score}` : `${game.visitor_score}-${game.home_score}`;
        uniqueScores.add(score);
    });
    return uniqueScores.size;
}


async function getScoreHistory(supabase: SupabaseClient, s1: number, s2: number): Promise<ScoreHistory | null> {
    const winningScore = Math.max(s1, s2);
    const losingScore = Math.min(s1, s2);
    const { count, data, error } = await supabase
        .from('gamelogs')
        .select('date', { count: 'exact' })
        .or(`and(home_score.eq.${winningScore},visitor_score.eq.${losingScore}),and(home_score.eq.${losingScore},visitor_score.eq.${winningScore})`)
        .order('date', { ascending: false })
        .limit(1);
    if (error || !data || data.length === 0) {
        if (error) console.error("Error fetching score history from gamelogs:", error);
        return null;
    }
    return {
        occurrences: count || 0,
        last_game_date: new Date(data[0].date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    };
}

const FACTORIALS: number[] = [1];
function factorial(n: number): number {
    if (n < 0) return NaN;
    if (n >= FACTORIALS.length) {
        for (let i = FACTORIALS.length; i <= n; i++) {
            FACTORIALS[i] = FACTORIALS[i - 1] * i;
        }
    }
    return FACTORIALS[n];
}

function poissonProbability(lambda: number, k: number): number {
    if (lambda < 0 || k < 0) return 0;
    return (Math.pow(lambda, k) * Math.exp(-lambda)) / factorial(k);
}

async function calculateFranchiseScorigamiProbability(
    supabase: SupabaseClient,
    game: MLBGame,
    dbAwayId: number,
    dbHomeId: number
): Promise<ScorigamiProbabilityResult | null> {
    const AVG_RUNS_PER_INNING_PER_TEAM = 0.5;
    const MAX_ADDITIONAL_RUNS_TO_CHECK = 20;
    const inningsRemaining = 9 - game.inning;
    if (inningsRemaining <= 0) return null;
    const lambda = inningsRemaining * AVG_RUNS_PER_INNING_PER_TEAM * 2;
    let totalScorigamiChance = 0;
    let mostLikelyScorigami = { teamName: "", score: "", probability: 0 };
    const scorigamiCheckCache: { [key: string]: boolean | undefined } = {};

    for (let k = 0; k <= MAX_ADDITIONAL_RUNS_TO_CHECK; k++) {
        const probOfKMoreRuns = poissonProbability(lambda, k);
        if (probOfKMoreRuns < 0.00001) break;

        for (let awayRuns = 0; awayRuns <= k; awayRuns++) {
            const homeRuns = k - awayRuns;
            const finalAwayScore = game.away_score + awayRuns;
            const finalHomeScore = game.home_score + homeRuns;
            
            const individualScoreProbability = probOfKMoreRuns / (k + 1);

            const homeKey = `h-${finalHomeScore}-${finalAwayScore}`;
            if (scorigamiCheckCache[homeKey] === undefined) {
                 scorigamiCheckCache[homeKey] = await isFranchiseScorigami(supabase, dbHomeId, finalHomeScore, finalAwayScore);
            }
            if (scorigamiCheckCache[homeKey]) {
                totalScorigamiChance += individualScoreProbability;
                if (individualScoreProbability > mostLikelyScorigami.probability) {
                    mostLikelyScorigami = { teamName: game.home_name, score: `${finalHomeScore}-${finalAwayScore}`, probability: individualScoreProbability };
                }
            }

            const awayKey = `a-${finalAwayScore}-${finalHomeScore}`;
            if (scorigamiCheckCache[awayKey] === undefined) {
                 scorigamiCheckCache[awayKey] = await isFranchiseScorigami(supabase, dbAwayId, finalAwayScore, finalHomeScore);
            }
            if (scorigamiCheckCache[awayKey]) {
                totalScorigamiChance += individualScoreProbability;
                if (individualScoreProbability > mostLikelyScorigami.probability) {
                    mostLikelyScorigami = { teamName: game.away_name, score: `${finalAwayScore}-${finalHomeScore}`, probability: individualScoreProbability };
                }
            }
        }
    }
    
    if (totalScorigamiChance === 0) return null;
    return { totalChance: totalScorigamiChance, mostLikely: mostLikelyScorigami.probability > 0 ? mostLikelyScorigami : null };
}


// --- MAIN API ROUTE HANDLER ---
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const twitterClient = new TwitterApi({
    appKey: process.env.X_APP_KEY!,
    appSecret: process.env.X_APP_SECRET!,
    accessToken: process.env.X_ACCESS_TOKEN!,
    accessSecret: process.env.X_ACCESS_SECRET!,
  });

  const games = await fetchLiveGames();
  
  const FINAL_STATES = ['Final', 'Game Over', 'Completed Early'];

  for (const game of games) {
    const { away_score, home_score, away_name, home_name, game_id } = game;
    const isFinal = FINAL_STATES.includes(game.status);
    
    const away_team_short_name = TEAM_NAME_SHORTENER_MAP[away_name] || away_name.split(' ').pop() || away_name;
    const home_team_short_name = TEAM_NAME_SHORTENER_MAP[home_name] || home_name.split(' ').pop() || home_name;
    
    const dbAwayId = API_ID_TO_DB_ID_MAP[game.away_id];
    const dbHomeId = API_ID_TO_DB_ID_MAP[game.home_id];
    
    if (!dbAwayId || !dbHomeId) {
        console.warn(`Could not find a DB ID mapping for game between ${game.away_name} (API ID: ${game.away_id}) and ${game.home_name} (API ID: ${game.home_id}). Skipping.`);
        continue;
    }

    if (isFinal) {
        if (await checkIfPosted(supabase, game_id, 'Final')) continue;
        
        let postText = "";
        const trueScorigamiResult = await checkTrueScorigami(supabase, away_score, home_score);
        if (trueScorigamiResult.isScorigami) {
            const newCountOrdinal = getOrdinal(trueScorigamiResult.newCount);
            postText = `${away_team_short_name} ${away_score} - ${home_score} ${home_team_short_name}\nFinal\n\nSCORIGAMI!!! It's the ${newCountOrdinal} unique final score in MLB history.`;
        } else {
            const isAwayScorigami = await isFranchiseScorigami(supabase, dbAwayId, away_score, home_score);
            const isHomeScorigami = await isFranchiseScorigami(supabase, dbHomeId, home_score, away_score);
            
            if (isAwayScorigami || isHomeScorigami) {
                const scorigamiTeamId = isAwayScorigami ? dbAwayId : dbHomeId;
                const scorigamiTeamName = isAwayScorigami ? away_name : home_name;
                const count = await getFranchiseScorigamiCount(supabase, scorigamiTeamId);
                const newCountOrdinal = getOrdinal(count + 1);
                const history = await getScoreHistory(supabase, away_score, home_score);
                const occurrencesFormatted = formatNumberWithCommas(history?.occurrences || 0);
                postText = `${away_team_short_name} ${away_score} - ${home_score} ${home_team_short_name}\nFinal\n\nFranchise Scorigami!! It's the ${newCountOrdinal} unique final score in ${scorigamiTeamName} franchise history.\nThis game has happened ${occurrencesFormatted} times in MLB history, most recently on ${history?.last_game_date || 'an unknown date'}.`;
            }
        }

        if (postText) {
            const postResult = await postToX(twitterClient, postText);
            
            if (postResult.success) {
                await recordPost(supabase, game.game_id, 'Final', 'Final');
            } else if (postResult.reason === 'rate-limit') {
                await queuePostForLater(supabase, postText, game.game_id);
            }
        } else {
            await recordPost(supabase, game_id, 'Processed_No_Post', 'Final');
        }
    } 
    else if (game.inning >= 6 && (game.away_score >= 13 || game.home_score >= 13)) {
        const postDetail = 'In-Progress Scorigami Watch'; 
        if (await checkIfPosted(supabase, game.game_id, postDetail)) continue;
        
        const probabilityResult = await calculateFranchiseScorigamiProbability(supabase, game, dbAwayId, dbHomeId);
        if (probabilityResult && probabilityResult.mostLikely) { 
            let postText = `Score Update:\n${away_team_short_name} ${away_score} - ${home_score} ${home_team_short_name}\n${game.inning_state_raw}\n\n`;
            postText += `This game has a ${(probabilityResult.totalChance * 100).toFixed(2)}% chance of ending in a Franchise Scorigami.\n`;
            postText += `Most likely Franchise Scorigami: ${probabilityResult.mostLikely.score} for the ${probabilityResult.mostLikely.teamName} (${(probabilityResult.mostLikely.probability * 100).toFixed(2)}%)`;
            
            const postResult = await postToX(twitterClient, postText);

            if (postResult.success) {
                await recordPost(supabase, game.game_id, 'In_Progress_Update', postDetail);
            } else if (postResult.reason === 'rate-limit') {
                await queuePostForLater(supabase, postText, game.game_id);
            }
        }
    }
  }

  return NextResponse.json({ success: true, message: `Game check complete. Processed ${games.length} games.` });
}