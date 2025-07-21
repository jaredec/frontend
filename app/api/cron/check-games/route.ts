// /frontend/app/api/cron/check-games/route.ts

import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import TwitterApi from 'twitter-api-v2';
import { MLBGame } from '@/lib/types';

// --- INITIALIZE CLIENTS ---
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

// --- TYPE DEFINITIONS ---
interface ScoreHistory {
  occurrences: number;
  last_game_date: string;
}

// --- HELPER FUNCTIONS ---

/**
 * Formats a number into an ordinal string (e.g., 1 -> 1st, 2 -> 2nd).
 */
function getOrdinal(n: number): string {
    if (n === 0) return "0"; // Handle case for 0 occurrences
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

async function fetchLiveGames(): Promise<MLBGame[]> {
  try {
    const response = await fetch('https://statsapi.mlb.com/api/v1/schedule/games/?sportId=1', { cache: 'no-store' });
    if (!response.ok) {
      console.error("Failed to fetch MLB data:", response.status);
      return [];
    }
    const data = await response.json();
    if (!data.dates || data.dates.length === 0) return [];

    return data.dates.flatMap((date: any) => date.games).map((g: any): MLBGame => ({
      game_id: g.gamePk,
      status: g.status.detailedState,
      away_name: g.teams.away.team.name,
      home_name: g.teams.home.team.name,
      away_score: g.teams.away.score ?? 0,
      home_score: g.teams.home.score ?? 0,
      away_id: g.teams.away.team.id,
      home_id: g.teams.home.team.id,
      inning: g.linescore?.currentInning ?? 0,
      inning_state_raw: g.linescore?.currentInningOrdinal ? `${g.linescore.inningState} of the ${g.linescore.currentInningOrdinal}` : "Pre-Game",
    }));
  } catch (error) {
    console.error("Error in fetchLiveGames:", error);
    return [];
  }
}

async function checkIfPosted(game_id: number, details: string): Promise<boolean> {
  const { data, error } = await supabase.from('posted_updates').select('id').eq('game_id', game_id).eq('details', details).limit(1);
  if (error) {
    console.error("Error checking if posted:", error);
    return true;
  }
  return (data || []).length > 0;
}

async function recordPost(game_id: number, post_type: string, details: string) {
  const { error } = await supabase.from('posted_updates').insert({ game_id, post_type, details });
  if (error) console.error("Error recording post:", error);
}

async function postToX(text: string) {
  // This line checks for a specific "on/off" switch you control in Vercel.
  const isProductionPosting = process.env.ENABLE_POSTING === 'true';

  if (!isProductionPosting) {
    // If the switch is OFF, it will only log to the console, even on Vercel.
    console.log("✅ [POSTING DISABLED] WOULD TWEET:", `\n---\n${text}\n---`);
    return true; // Pretends to succeed
  }

  // This code ONLY runs if you have manually set ENABLE_POSTING to 'true' in Vercel.
  try {
    await twitterClient.v2.tweet(text);
    console.log("🚀 Post sent to X successfully!");
    return true;
  } catch (error) {
    console.error("Failed to post to X:", error);
    return false;
  }
}

// --- SCORIGAMI LOGIC USING SUMMARY TABLE ---

async function checkTrueScorigami(s1: number, s2: number): Promise<{ isScorigami: true, newCount: number } | { isScorigami: false }> {
    const winningScore = Math.max(s1, s2);
    const losingScore = Math.min(s1, s2);

    const { data, error } = await supabase
        .from('scorigami_summary')
        .select('first_game_id')
        .eq('score1', winningScore)
        .eq('score2', losingScore)
        .limit(1);

    if (error) {
        console.error("Error checking true scorigami:", error);
        return { isScorigami: false };
    }

    if (data.length > 0) {
        return { isScorigami: false };
    }

    const { count, error: countError } = await supabase.from('scorigami_summary').select('score1', { count: 'exact', head: true });
    if (countError) {
        console.error("Error counting total scorigamis:", countError);
        return { isScorigami: true, newCount: 0 };
    }

    return { isScorigami: true, newCount: (count || 0) + 1 };
}

async function checkFranchiseScorigami(teamId: number, s1: number, s2: number): Promise<{ isFranchiseScorigami: true, newCount: number } | { isFranchiseScorigami: false }> {
    const winningScore = Math.max(s1, s2);
    const losingScore = Math.min(s1, s2);

    const { data, error } = await supabase
        .from('scorigami_summary')
        .select('first_game_id')
        .eq('team_id', teamId)
        .eq('score1', winningScore)
        .eq('score2', losingScore)
        .limit(1);

    if(error) {
        console.error("Error checking franchise scorigami:", error);
        return { isFranchiseScorigami: false };
    }

    if (data.length > 0) {
        return { isFranchiseScorigami: false };
    }

    const { count, error: countError } = await supabase.from('scorigami_summary').select('score1', { count: 'exact', head: true }).eq('team_id', teamId);
    if(countError) {
        console.error("Error counting franchise scorigamis:", countError);
        return { isFranchiseScorigami: true, newCount: 0 };
    }

    return { isFranchiseScorigami: true, newCount: (count || 0) + 1 };
}

async function getScoreHistory(s1: number, s2: number): Promise<ScoreHistory | null> {
    const winningScore = Math.max(s1, s2);
    const losingScore = Math.min(s1, s2);

    const { data: summary, error: summaryError } = await supabase
        .from('scorigami_summary')
        .select('occurrences, last_game_id')
        .eq('score1', winningScore)
        .eq('score2', losingScore);

    if (summaryError || !summary || summary.length === 0) {
        if (summaryError) console.error("Error fetching score history summary:", summaryError);
        return null;
    }

    const totalOccurrences = summary.reduce((acc, row) => acc + row.occurrences, 0);
    const lastGameId = Math.max(...summary.map(row => row.last_game_id));

    const { data: game, error: gameError } = await supabase.from('gamelogs').select('date').eq('game_id', lastGameId).single();
    if (gameError || !game) {
        if (gameError) console.error("Error fetching last game date:", gameError);
        return null;
    }

    return {
        occurrences: totalOccurrences,
        last_game_date: new Date(game.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    };
}

// --- MAIN API ROUTE HANDLER ---
export async function GET() {
  console.log('Cron job started: Checking MLB games...');
  
  const games = await fetchLiveGames();
  const FINAL_STATES = ['Final', 'Game Over', 'Completed Early'];

  for (const game of games) {
    const { away_score, home_score, away_name, home_name, game_id } = game;
    const isFinal = FINAL_STATES.includes(game.status);

    if (isFinal) {
        if (await checkIfPosted(game_id, 'Final')) continue;

        let postText = "";
        const trueScorigamiResult = await checkTrueScorigami(away_score, home_score);

        if (trueScorigamiResult.isScorigami) {
            const newCountOrdinal = getOrdinal(trueScorigamiResult.newCount);
            postText = `${away_name} ${away_score} - ${home_score} ${home_name}\nFinal\n\nThat's a TRUE Scorigami! It's the ${newCountOrdinal} unique final score in MLB history.`;
        } else {
            const awayFranchiseResult = await checkFranchiseScorigami(game.away_id, away_score, home_score);
            const homeFranchiseResult = await checkFranchiseScorigami(game.home_id, away_score, home_score);

            // CORRECTED LOGIC: Use explicit 'if / else if' to satisfy TypeScript
            if (awayFranchiseResult.isFranchiseScorigami) {
                const teamName = away_name;
                const newCount = awayFranchiseResult.newCount;
                const newCountOrdinal = getOrdinal(newCount);
                const history = await getScoreHistory(away_score, home_score);
                
                postText = `${away_name} ${away_score} - ${home_score} ${home_name}\nFinal\n\nThat's a FRANCHISE Scorigami! It's the ${newCountOrdinal} unique final score in ${teamName} franchise history.\nThis game has happened ${history?.occurrences || 0} times in MLB history, most recently on ${history?.last_game_date || 'an unknown date'}.`;

            } else if (homeFranchiseResult.isFranchiseScorigami) {
                const teamName = home_name;
                const newCount = homeFranchiseResult.newCount; // This is now type-safe
                const newCountOrdinal = getOrdinal(newCount);
                const history = await getScoreHistory(away_score, home_score);

                postText = `${away_name} ${away_score} - ${home_score} ${home_name}\nFinal\n\nThat's a FRANCHISE Scorigami! It's the ${newCountOrdinal} unique final score in ${teamName} franchise history.\nThis game has happened ${history?.occurrences || 0} times in MLB history, most recently on ${history?.last_game_date || 'an unknown date'}.`;

            } else {
                // This block now correctly handles the "No Scorigami" case
                const history = await getScoreHistory(away_score, home_score);
                if (history) {
                    postText = `${away_name} ${away_score} - ${home_score} ${home_name}\nFinal\n\nNo Scorigami. That score has happened ${history.occurrences} times before in MLB history, most recently on ${history.last_game_date}.`;
                }
            }
        }

        if (postText) {
            if (await postToX(postText)) {
                await recordPost(game_id, 'Final', 'Final');
            }
        } else {
            // Log that we've processed it, even if there's no text, to avoid re-checking
            await recordPost(game_id, 'Processed_No_Post', 'Final');
        }
    }
  }

  return NextResponse.json({ success: true, message: `Game check complete. Processed ${games.length} games.` });
}