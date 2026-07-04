// Simulate a sequence of live-game states through the Score Update decision
// rules (mirrors the gate logic in check-games) and print each decision.
// Usage: npx tsx scripts/test-update-sequence.ts
import { config } from "dotenv";
config({ path: ".env.local" });
import { Pool } from "pg";
import {
  calculateScoreProbabilities,
  lambdasFor,
  formatPct,
} from "../lib/scorigami-probability";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const AWAY_ID = 145; // CWS
const HOME_ID = 118; // KC

interface State { away: number; home: number; inning: number; st: string; note: string }

// One fake game engineered to exercise every rule.
const GAME: State[] = [
  { away: 15, home: 0, inning: 3, st: "Top",    note: "hot start, below trigger" },
  { away: 20, home: 1, inning: 3, st: "Bottom", note: "trigger met but only 3rd inning" },
  { away: 20, home: 1, inning: 4, st: "Top",    note: "trigger + window first met" },
  { away: 21, home: 1, inning: 4, st: "Bottom", note: "another run, same inning" },
  { away: 21, home: 1, inning: 5, st: "Top",    note: "one more run, next inning" },
  { away: 21, home: 6, inning: 6, st: "Top",    note: "losing team rallies, score normalizes" },
  { away: 27, home: 6, inning: 7, st: "Top",    note: "6-run explosion" },
  { away: 28, home: 6, inning: 8, st: "Bottom", note: "steady drip" },
  { away: 29, home: 7, inning: 9, st: "Top",    note: "away leads, top 9 allowed" },
  { away: 33, home: 7, inning: 9, st: "Bottom", note: "bottom 9 — window closed" },
];

// Separate one-off: home team leading in the top of the 9th.
const HOME_LEADS_9TH: State = { away: 2, home: 20, inning: 9, st: "Top", note: "home leads, won't bat again" };

async function franchiseIds(teamId: number): Promise<number[]> {
  const { rows } = await pool.query(
    `SELECT team_id FROM teams WHERE franchise = (SELECT franchise FROM teams WHERE team_id = $1)`,
    [teamId]
  );
  return rows.length ? rows.map((r) => Number(r.team_id)) : [teamId];
}

async function odds(s: State) {
  const K = 25;
  const winCur = Math.max(s.away, s.home);
  const loseCur = Math.min(s.away, s.home);
  const [everRes, awayIds, homeIds] = await Promise.all([
    pool.query(
      `SELECT DISTINCT GREATEST(home_score, visitor_score) AS w, LEAST(home_score, visitor_score) AS l
       FROM gamelogs WHERE is_negro_league = false
         AND GREATEST(home_score, visitor_score) BETWEEN $1 AND $2
         AND LEAST(home_score, visitor_score) BETWEEN $3 AND $4`,
      [winCur, winCur + K, loseCur, loseCur + K]
    ),
    franchiseIds(AWAY_ID),
    franchiseIds(HOME_ID),
  ]);
  const sql = `SELECT DISTINCT GREATEST(home_score, visitor_score) AS w, LEAST(home_score, visitor_score) AS l
               FROM gamelogs WHERE home_team_id = ANY($1) OR visitor_team_id = ANY($1)`;
  const [a, h] = await Promise.all([pool.query(sql, [awayIds]), pool.query(sql, [homeIds])]);
  const toSet = (rows: { w: number; l: number }[]) => new Set(rows.map((r) => `${r.w}-${r.l}`));
  const lambdas = lambdasFor(s.inning, s.st, s.home > s.away);
  const p = calculateScoreProbabilities({
    awayScore: s.away, homeScore: s.home,
    awayLambda: lambdas.away, homeLambda: lambdas.home,
    everSet: toSet(everRes.rows), awayFranchiseSet: toSet(a.rows), homeFranchiseSet: toSet(h.rows),
  });
  return { s: p.scorigami * 100, f: p.franchisigami * 100, best: p.mostLikelyScorigami };
}

async function simulate(states: State[], label: string) {
  console.log(`\n########## ${label} ##########`);
  const posted: { inning: number; s: number; f: number }[] = [];
  for (const st of states) {
    const score = `${st.away}-${st.home}`.padEnd(5);
    const where = `${st.st} ${st.inning}`.padEnd(9);
    const prefix = `${score} ${where} | ${st.note.padEnd(38)} |`;

    const trigger = st.away >= 20 || st.home >= 20 || st.away + st.home >= 30;
    if (!trigger) { console.log(`${prefix} SKIP — below 20+/30+ trigger`); continue; }

    const isTop9 = st.inning === 9 && st.st.toLowerCase().startsWith("top");
    const inWindow = st.inning >= 4 && (st.inning <= 8 || (isTop9 && st.home <= st.away));
    if (!inWindow) {
      const why = st.inning < 4 ? "before 4th inning" : isTop9 ? "top 9 but home leads" : "past top 9";
      console.log(`${prefix} SKIP — window (${why})`); continue;
    }

    if (posted.length >= 3) { console.log(`${prefix} SKIP — 3-post cap reached`); continue; }
    if (posted.some((p) => p.inning === st.inning)) { console.log(`${prefix} SKIP — already posted this inning`); continue; }

    const o = await odds(st);
    const oddsStr = `s=${o.s.toFixed(2)}% f=${o.f.toFixed(1)}%`;
    if (o.f < 0.1 && o.s < 0.005) { console.log(`${prefix} SKIP — nothing to say (${oddsStr})`); continue; }

    const last = posted[posted.length - 1];
    if (last) {
      const sJump = o.s >= last.s * 1.5 && o.s >= last.s + 0.05;
      const fJump = o.f >= last.f + 10;
      if (!sJump && !fJump) {
        console.log(`${prefix} SKIP — odds not up enough (${oddsStr} vs s=${last.s.toFixed(2)}% f=${last.f.toFixed(1)}%)`);
        continue;
      }
    }

    posted.push({ inning: st.inning, s: o.s, f: o.f });
    const mostLikely = o.best && o.s >= 0.005 ? ` | most likely ${o.best.win}-${o.best.lose} (${formatPct(o.best.probability)})` : "";
    console.log(`${prefix} ✅ POST #${posted.length} — ${formatPct(o.s / 100)} Scorigami, ${formatPct(o.f / 100)} Franchisigami${mostLikely}`);
  }
}

(async () => {
  await simulate(GAME, "FULL GAME: CWS (away) runs wild vs KC");
  await simulate([HOME_LEADS_9TH], "ONE-OFF: home team leads 20-2 entering top 9");
  await pool.end();
})();
