// test-scorigami-prob.js
// A standalone script to debug the franchise scorigami probability calculation.
//
// HOW TO USE:
// 1. Make sure you have `node` installed.
// 2. Install the required packages: `npm install @supabase/supabase-js dotenv`
// 3. Create a `.env.local` file in the same directory with your Supabase credentials:
//    NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
//    SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
// 4. Run the script from your terminal: `node test-scorigami-prob.js`

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables from .env.local
dotenv.config({ path: './.env.local' });

// --- REPLICATION OF PRODUCTION CODE ---
// These are copies of the functions and data from your cron job file.

const API_ID_TO_DB_ID_MAP = {
    158: 167, // MIL - Milwaukee Brewers
    138: 249, // SLN - St. Louis Cardinals
    // ... other mappings from your code would be here
};

const FACTORIALS = [1];
function factorial(n) {
    if (n < 0) return NaN;
    if (n >= FACTORIALS.length) {
        for (let i = FACTORIALS.length; i <= n; i++) {
            FACTORIALS[i] = FACTORIALS[i - 1] * i;
        }
    }
    return FACTORIALS[n];
}

function poissonProbability(lambda, k) {
    if (lambda < 0 || k < 0) return 0;
    return (Math.pow(lambda, k) * Math.exp(-lambda)) / factorial(k);
}

async function isFranchiseScorigami(supabase, teamId, s1, s2) {
    const { data, error } = await supabase
        .from('gamelogs')
        .select('game_id')
        .or(`and(home_team_id.eq.${teamId},home_score.eq.${s1},visitor_score.eq.${s2}),and(visitor_team_id.eq.${teamId},visitor_score.eq.${s1},home_score.eq.${s2}),and(home_team_id.eq.${teamId},home_score.eq.${s2},visitor_score.eq.${s1}),and(visitor_team_id.eq.${teamId},visitor_score.eq.${s2},home_score.eq.${s1})`)
        .limit(1);

    if (error) {
        console.error(`Error checking franchise scorigami for team ${teamId} with score ${s1}-${s2}:`, error.message);
        return false;
    }
    // If data.length is 0, it means no game was found, so it IS a scorigami.
    return data.length === 0;
}

async function calculateFranchiseScorigamiProbability(supabase, game, dbAwayId, dbHomeId) {
    const AVG_RUNS_PER_INNING_PER_TEAM = 0.5;
    const MAX_ADDITIONAL_RUNS_TO_CHECK = 20;
    
    // In the 8th inning, there is 1 full inning remaining for each team.
    // However, the home team might not bat in the 9th. We'll estimate 1.5 effective innings left for run scoring.
    // Let's stick to the original code's logic: 9 - game.inning
    const inningsRemaining = 9 - game.inning;
    if (inningsRemaining <= 0) return null;

    // λ (lambda) is the average number of events (runs) in an interval.
    // Interval = remaining innings * avg runs per inning * 2 teams
    const lambda = inningsRemaining * AVG_RUNS_PER_INNING_PER_TEAM * 2;
    console.log(`\n[Calculation Details]`);
    console.log(`Inning: ${game.inning}, Innings Remaining: ${inningsRemaining}`);
    console.log(`Lambda (λ) for Poisson Distribution: ${lambda.toFixed(2)} (Expected total runs for rest of game)`);
    console.log('--------------------------------------------------');


    let totalScorigamiChance = 0;
    let mostLikelyScorigami = { teamName: "", score: "", probability: 0 };
    const scorigamiCheckCache = {};

    // Check up to 20 additional runs scored in the remainder of the game
    for (let k = 0; k <= MAX_ADDITIONAL_RUNS_TO_CHECK; k++) {
        const probOfKMoreRuns = poissonProbability(lambda, k);
        // Optimization: if the chance of this many runs is tiny, stop.
        if (probOfKMoreRuns < 0.00001) break;

        // Iterate through every possible distribution of k runs between the two teams
        for (let awayRuns = 0; awayRuns <= k; awayRuns++) {
            const homeRuns = k - awayRuns;
            const finalAwayScore = game.away_score + awayRuns; // Cardinals
            const finalHomeScore = game.home_score + homeRuns; // Brewers

            // The probability of this specific score outcome
            const individualScoreProbability = probOfKMoreRuns / (k + 1); // Assuming each split of k runs is equally likely

            // Check for Brewers (Home Team)
            const homeKey = `h-${finalHomeScore}-${finalAwayScore}`;
            if (scorigamiCheckCache[homeKey] === undefined) {
                scorigamiCheckCache[homeKey] = await isFranchiseScorigami(supabase, dbHomeId, finalHomeScore, finalAwayScore);
                if(scorigamiCheckCache[homeKey]) {
                    console.log(`  ✅ Potential Scorigami Found: ${game.home_name} ${finalHomeScore}-${finalAwayScore}`);
                }
            }
            if (scorigamiCheckCache[homeKey]) {
                totalScorigamiChance += individualScoreProbability;
                if (individualScoreProbability > mostLikelyScorigami.probability) {
                    mostLikelyScorigami = { teamName: game.home_name, score: `${finalHomeScore}-${finalAwayScore}`, probability: individualScoreProbability };
                }
            }

            // Check for Cardinals (Away Team)
            const awayKey = `a-${finalAwayScore}-${finalHomeScore}`;
            if (scorigamiCheckCache[awayKey] === undefined) {
                 scorigamiCheckCache[awayKey] = await isFranchiseScorigami(supabase, dbAwayId, finalAwayScore, finalHomeScore);
                 if(scorigamiCheckCache[awayKey]) {
                    console.log(`  ✅ Potential Scorigami Found: ${game.away_name} ${finalAwayScore}-${finalHomeScore}`);
                }
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


// --- TEST HARNESS ---

async function runTest() {
  console.log("🚀 Starting Scorigami Probability Test...");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error("🔥 CRITICAL ERROR: Supabase URL or Key is not defined in .env.local");
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // --- ⬇️ DEFINE THE TEST SCENARIO HERE ⬇️ ---
  const mockGame = {
    game_id: 999999, // Test game ID
    status: 'In-Progress',
    // Brewers (Home) vs Cardinals (Away)
    home_name: 'Milwaukee Brewers',
    away_name: 'St. Louis Cardinals',
    home_id: 158, // API ID for Brewers
    away_id: 138, // API ID for Cardinals
    home_score: 16,
    away_score: 4,
    inning: 8,
    inning_state_raw: 'Middle of the 8th',
  };

  const dbHomeId = API_ID_TO_DB_ID_MAP[mockGame.home_id];
  const dbAwayId = API_ID_TO_DB_ID_MAP[mockGame.away_id];

  console.log(`\n[Test Scenario]`);
  console.log(`Game: ${mockGame.away_name} at ${mockGame.home_name}`);
  console.log(`Score: ${mockGame.away_score} - ${mockGame.home_score}`);
  console.log(`Inning: ${mockGame.inning}`);
  console.log(`DB IDs: Away=${dbAwayId}, Home=${dbHomeId}`);

  const result = await calculateFranchiseScorigamiProbability(supabase, mockGame, dbAwayId, dbHomeId);

  console.log('--------------------------------------------------');
  console.log("\n[Final Result]");
  
  if (result) {
    console.log("✅ CALCULATION COMPLETE. A post WOULD have been triggered.");
    console.log(`Total Chance of Franchise Scorigami: ${(result.totalChance * 100).toFixed(4)}%`);
    if (result.mostLikely) {
      console.log(`Most Likely Scorigami Outcome: ${result.mostLikely.score} for the ${result.mostLikely.teamName}`);
      console.log(`  (With a ${(result.mostLikely.probability * 100).toFixed(4)}% chance of happening)`);
    }
  } else {
    console.log("❌ CALCULATION COMPLETE. A post would NOT have been triggered.");
    console.log("Reason: The function returned null, indicating a 0% chance of a franchise scorigami based on the simulated future scores.");
  }
  console.log("\nTest finished. ✨");
}

runTest();