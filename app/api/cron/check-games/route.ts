// /frontend/app/api/cron/check-games/route.ts (Final, Corrected Version)

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


// --- TYPE DEFINITIONS ---
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

// --- HELPER FUNCTIONS ---

function getOrdinal(n: number): string {
    if (n === 0) return "0";
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
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
  if (error) { console.error("Error checking if posted:", error); return true; }
  return (data || []).length > 0;
}

async function recordPost(supabase: SupabaseClient, game_id: number, post_type: string, details: string) {
  const { error } = await supabase.from('posted_updates').insert({ game_id, post_type, details });
  if (error) console.error("Error recording post:", error);
}

async function postToX(twitterClient: TwitterApi, text: string) {
  const isProductionPosting = process.env.ENABLE_POSTING === 'true';
  if (!isProductionPosting) {
    console.log("✅ [POSTING DISABLED] WOULD TWEET:", `\n---\n${text}\n---`);
    return true;
  }
  try {
    await twitterClient.v2.tweet(text);
    console.log("🚀 Post sent to X successfully!");
    return true;
  } catch (error) {
    console.error("Failed to post to X:", error);
    return false;
  }
}

async function checkTrueScorigami(supabase: SupabaseClient, s1: number, s2: number): Promise<{ isScorigami: true, newCount: number } | { isScorigami: false }> {
    const winningScore = Math.max(s1, s2);
    const losingScore = Math.min(s1, s2);
    const { data, error } = await supabase.from('scorigami_summary').select('first_game_id').eq('score1', winningScore).eq('score2', losingScore).limit(1);
    if (error) { console.error("Error checking true scorigami:", error); return { isScorigami: false }; }
    if (data.length > 0) { return { isScorigami: false }; }
    const { count, error: countError } = await supabase.from('scorigami_summary').select('score1', { count: 'exact', head: true });
    if (countError) { console.error("Error counting total scorigamis:", countError); return { isScorigami: true, newCount: 0 }; }
    return { isScorigami: true, newCount: (count || 0) + 1 };
}

async function checkFranchiseScorigami(supabase: SupabaseClient, teamId: number, s1: number, s2: number): Promise<{ isFranchiseScorigami: true, newCount: number } | { isFranchiseScorigami: false }> {
    const winningScore = Math.max(s1, s2);
    const losingScore = Math.min(s1, s2);
    const { data, error } = await supabase.from('scorigami_summary').select('first_game_id').eq('team_id', teamId).eq('score1', winningScore).eq('score2', losingScore).limit(1);
    if(error) { console.error("Error checking franchise scorigami:", error); return { isFranchiseScorigami: false }; }
    if (data.length > 0) { return { isFranchiseScorigami: false }; }
    const { count, error: countError } = await supabase.from('scorigami_summary').select('score1', { count: 'exact', head: true }).eq('team_id', teamId);
    if(countError) { console.error("Error counting franchise scorigamis:", countError); return { isFranchiseScorigami: true, newCount: 0 }; }
    return { isFranchiseScorigami: true, newCount: (count || 0) + 1 };
}

async function getScoreHistory(supabase: SupabaseClient, s1: number, s2: number): Promise<ScoreHistory | null> {
    const winningScore = Math.max(s1, s2);
    const losingScore = Math.min(s1, s2);

    const { count, data, error } = await supabase
        .from('gamelogs')
        .select('date', { count: 'exact' })
        .or(`and(home_score.eq.${winningScore},visitor_score.eq.${losingScore}),and(home_score.eq.${losingScore},visitor_score.eq.${winningScore})`)
        // --- THIS IS THE KEY TO THE FIX ---
        // It explicitly sorts the results by the 'date' column.
        .order('date', { ascending: false })
        // --- AND THEN TAKES THE VERY FIRST ROW ---
        // This first row is guaranteed to be the one with the latest date.
        .limit(1);

    if (error || !data || data.length === 0) {
        if (error) console.error("Error fetching score history:", error);
        return null;
    }

    // data[0] is now the correct, most recent game, regardless of its game_id.
    // count is the accurate total from the entire query.
    return {
        occurrences: count || 0,
        last_game_date: new Date(data[0].date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    };
}

// --- MAIN API ROUTE HANDLER ---
export async function GET(request: NextRequest) {
  // --- 🔒 Security Check ---
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  // --- ✨ INITIALIZE CLIENTS AT RUNTIME, NOT BUILD TIME ---
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
  // --- END INITIALIZATION ---

  console.log('Cron job started by external trigger: Checking MLB games...');
  
  const games = await fetchLiveGames();
  const FINAL_STATES = ['Final', 'Game Over', 'Completed Early'];

  for (const game of games) {
    const { away_score, home_score, away_name, home_name, game_id } = game;
    const isFinal = FINAL_STATES.includes(game.status);

    if (isFinal) {
        // --- ✨ APPLY THE TRANSLATION ✨ ---
        const dbAwayId = API_ID_TO_DB_ID_MAP[game.away_id];
        const dbHomeId = API_ID_TO_DB_ID_MAP[game.home_id];

        if (!dbAwayId || !dbHomeId) {
            console.warn(`Could not find a DB ID mapping for game between ${game.away_name} (API ID: ${game.away_id}) and ${game.home_name} (API ID: ${game.home_id}). Skipping.`);
            continue;
        }

        if (await checkIfPosted(supabase, game_id, 'Final')) continue;

        let postText = "";
        const trueScorigamiResult = await checkTrueScorigami(supabase, away_score, home_score);

        if (trueScorigamiResult.isScorigami) {
            const newCountOrdinal = getOrdinal(trueScorigamiResult.newCount);
            postText = `${away_name} ${away_score} - ${home_score} ${home_name}\nFinal\n\nThat's a TRUE Scorigami! It's the ${newCountOrdinal} unique final score in MLB history.`;
        } else {
            const awayFranchiseResult = await checkFranchiseScorigami(supabase, dbAwayId, away_score, home_score);
            const homeFranchiseResult = await checkFranchiseScorigami(supabase, dbHomeId, away_score, home_score);

            if (awayFranchiseResult.isFranchiseScorigami) {
                const teamName = away_name;
                const newCount = awayFranchiseResult.newCount;
                const newCountOrdinal = getOrdinal(newCount);
                const history = await getScoreHistory(supabase, away_score, home_score);
                postText = `${away_name} ${away_score} - ${home_score} ${home_name}\nFinal\n\nThat's a FRANCHISE Scorigami! It's the ${newCountOrdinal} unique final score in ${teamName} franchise history.\nThis game has happened ${history?.occurrences || 0} times in MLB history, most recently on ${history?.last_game_date || 'an unknown date'}.`;
            } else if (homeFranchiseResult.isFranchiseScorigami) {
                const teamName = home_name;
                const newCount = homeFranchiseResult.newCount;
                const newCountOrdinal = getOrdinal(newCount);
                const history = await getScoreHistory(supabase, away_score, home_score);
                postText = `${away_name} ${away_score} - ${home_score} ${home_name}\nFinal\n\nThat's a FRANCHISE Scorigami! It's the ${newCountOrdinal} unique final score in ${teamName} franchise history.\nThis game has happened ${history?.occurrences || 0} times in MLB history, most recently on ${history?.last_game_date || 'an unknown date'}.`;
            } else {
                const history = await getScoreHistory(supabase, away_score, home_score);
                if (history) {
                    postText = `${away_name} ${away_score} - ${home_score} ${home_name}\nFinal\n\nNo Scorigami. That score has happened ${history.occurrences} times before in MLB history, most recently on ${history.last_game_date}.`;
                }
            }
        }

        if (postText) {
            if (await postToX(twitterClient, postText)) {
                await recordPost(supabase, game_id, 'Final', 'Final');
            }
        } else {
            await recordPost(supabase, game_id, 'Processed_No_Post', 'Final');
        }
    }
  }

  return NextResponse.json({ success: true, message: `Game check complete. Processed ${games.length} games.` });
}