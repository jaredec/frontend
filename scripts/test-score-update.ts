// Dry-run the in-game Score Update post against real data.
// Usage: npx tsx scripts/test-score-update.ts [awayScore] [homeScore] [inning] [Top|Bottom|Mid|End]
// Defaults to the CWS 22 - 1 KC, Top 8th scenario.
import { config } from "dotenv";
config({ path: ".env.local" });
import { Pool } from "pg";
import {
  calculateScoreProbabilities,
  lambdasFor,
  formatPct,
  articleForPct,
} from "../lib/scorigami-probability";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// CWS and KC franchise team_ids (CWS=145, KC=118 per lib/mlb-data)
const AWAY_FRANCHISE_ID = 145; // White Sox (away in the example)
const HOME_FRANCHISE_ID = 118; // Royals

(async () => {
  const awayScore = Number(process.argv[2] ?? 22);
  const homeScore = Number(process.argv[3] ?? 1);
  const inning = Number(process.argv[4] ?? 8);
  const state = process.argv[5] ?? "Top";

  const K = 25;
  const winCur = Math.max(awayScore, homeScore);
  const loseCur = Math.min(awayScore, homeScore);

  const franchiseIds = async (teamId: number) => {
    const { rows } = await pool.query(
      `SELECT team_id FROM teams WHERE franchise = (SELECT franchise FROM teams WHERE team_id = $1)`,
      [teamId]
    );
    return rows.length ? rows.map((r) => Number(r.team_id)) : [teamId];
  };

  const [everRes, awayIds, homeIds] = await Promise.all([
    pool.query(
      `SELECT DISTINCT GREATEST(home_score, visitor_score) AS w, LEAST(home_score, visitor_score) AS l
       FROM gamelogs WHERE is_negro_league = false
         AND GREATEST(home_score, visitor_score) BETWEEN $1 AND $2
         AND LEAST(home_score, visitor_score) BETWEEN $3 AND $4`,
      [winCur, winCur + K, loseCur, loseCur + K]
    ),
    franchiseIds(AWAY_FRANCHISE_ID),
    franchiseIds(HOME_FRANCHISE_ID),
  ]);
  const franchisePairsSql = `
    SELECT DISTINCT GREATEST(home_score, visitor_score) AS w, LEAST(home_score, visitor_score) AS l
    FROM gamelogs WHERE home_team_id = ANY($1) OR visitor_team_id = ANY($1)`;
  const [awayRes, homeRes] = await Promise.all([
    pool.query(franchisePairsSql, [awayIds]),
    pool.query(franchisePairsSql, [homeIds]),
  ]);
  const toSet = (rows: { w: number; l: number }[]) => new Set(rows.map((r) => `${r.w}-${r.l}`));

  const lambdas = lambdasFor(inning, state, homeScore > awayScore);
  console.log(`Scenario: away ${awayScore} - ${homeScore} home, ${state} ${inning}`);
  console.log(`Lambdas: away +${lambdas.away.toFixed(2)}, home +${lambdas.home.toFixed(2)} expected runs`);
  console.log(`Known score pairs in candidate window: ${everRes.rows.length}`);

  const prob = calculateScoreProbabilities({
    awayScore, homeScore,
    awayLambda: lambdas.away, homeLambda: lambdas.home,
    everSet: toSet(everRes.rows),
    awayFranchiseSet: toSet(awayRes.rows),
    homeFranchiseSet: toSet(homeRes.rows),
  });

  const fStr = formatPct(prob.franchisigami);
  const sStr = formatPct(prob.scorigami);
  let sentence: string;
  if (prob.scorigami * 100 >= 0.005) {
    sentence = `This game has ${articleForPct(sStr)} ${sStr} chance of ending in Scorigami and ${articleForPct(fStr)} ${fStr} chance of ending in Franchisigami.`;
  } else {
    sentence = `This game has ${articleForPct(fStr)} ${fStr} chance of ending in Franchisigami.`;
  }
  let postText = `Score Update\nCWS ${awayScore} - ${homeScore} KC\n${state} ${inning}th\n\n${sentence}`;
  if (prob.mostLikelyScorigami && prob.scorigami * 100 >= 0.005) {
    const m = prob.mostLikelyScorigami;
    postText += `\nMost likely Scorigami: ${m.win}-${m.lose} (${formatPct(m.probability)})`;
  }

  console.log("\n--- WOULD POST ---\n" + postText + "\n------------------");
  console.log(`\nraw: scorigami=${(prob.scorigami * 100).toFixed(4)}%  franchisigami=${(prob.franchisigami * 100).toFixed(4)}%`);
  await pool.end();
})();
