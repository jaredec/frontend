// Dump yearly scorigami data to static JSON files.
//
// Output layout:
//   public/scorigami-data/manifest.json                 — index + version stamp
//   public/scorigami-data/traditional/ALL.json
//   public/scorigami-data/traditional/<CODE>.json       — per franchise
//   public/scorigami-data/homeaway/ALL.json
//   public/scorigami-data/homeaway/<CODE>.json
//
// Files use the compact v2 format in lib/static-data.mjs. Rows are split by
// game_type so the site can apply every game filter (regular, postseason
// rounds) client-side without hitting /api/scorigami. Franchise traditional
// files also carry per-year W/L/T records so the header doesn't need the
// home/away file.
// Run locally: node scripts/dump-scorigami-data.js
require("dotenv").config({ path: ".env.local" });
const { Pool } = require("pg");
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const FRANCHISE_CODE_TO_ID_MAP = {
  LAA: 108, ARI: 109, ATL: 144, BAL: 110, BOS: 111,
  CWS: 145, CHC: 112, CIN: 113, CLE: 114, COL: 115,
  DET: 116, HOU: 117, KC: 118, LAD: 119, MIA: 146,
  MIL: 158, MIN: 142, NYY: 147, NYM: 121, OAK: 133,
  PHI: 143, PIT: 134, SD: 135, SEA: 136, SFG: 137,
  STL: 138, TB: 139, TEX: 140, TOR: 141, WSH: 120,
};

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const OUT_DIR = path.resolve(__dirname, "../public/scorigami-data");

function fmtBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

// Same grouping and "last game" tiebreak as the scorigami_by_year(_ha) views
// and /api/scorigami, plus game_type.
const LAST = (col) =>
  `(ARRAY_AGG(g.${col} ORDER BY g.date DESC, g.ended_at DESC NULLS LAST, g.game_id DESC))[1]`;

async function fetchRows(type, teamId) {
  const isAll = teamId === 0;
  const scoreSelect = type === "traditional"
    ? `GREATEST(g.home_score, g.visitor_score) AS score1, LEAST(g.home_score, g.visitor_score) AS score2`
    : isAll
      ? `g.home_score AS score1, g.visitor_score AS score2`
      : `CASE WHEN g.home_team_id = $1 THEN g.home_score ELSE g.visitor_score END AS score1,
         CASE WHEN g.home_team_id = $1 THEN g.visitor_score ELSE g.home_score END AS score2`;
  const where = isAll
    ? `g.is_negro_league = false`
    : `(g.home_team_id = $1 OR g.visitor_team_id = $1)`;
  const { rows } = await pool.query(
    `SELECT EXTRACT(YEAR FROM g.date)::int AS year, ${scoreSelect}, g.game_type,
            COUNT(*)::int AS occurrences, MAX(g.date)::text AS last_date,
            ${LAST("home_team")} AS last_home_team, ${LAST("visitor_team")} AS last_visitor_team,
            ${LAST("home_score")} AS last_home_score, ${LAST("visitor_score")} AS last_visitor_score,
            ${LAST("game_id")} AS last_game_id, ${LAST("source")} AS source, ${LAST("box_url")} AS box_url
     FROM gamelogs g
     WHERE ${where}
     GROUP BY 1, 2, 3, g.game_type
     ORDER BY 1, 2, 3, g.game_type`,
    isAll ? [] : [teamId]
  );
  return rows;
}

// Per-year W/L/T by game type, from a franchise's home/away rows (score1 = team).
function recordsFrom(haRows) {
  const byKey = new Map();
  for (const r of haRows) {
    const k = `${r.year}|${r.game_type}`;
    let rec = byKey.get(k);
    if (!rec) byKey.set(k, (rec = { year: r.year, game_type: r.game_type, wins: 0, losses: 0, ties: 0 }));
    if (r.score1 > r.score2) rec.wins += r.occurrences;
    else if (r.score1 < r.score2) rec.losses += r.occurrences;
    else rec.ties += r.occurrences;
  }
  return [...byKey.values()];
}

function writeJson(relPath, rows, records, encodeYearly) {
  const full = path.join(OUT_DIR, relPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  const json = JSON.stringify(encodeYearly(rows, records));
  fs.writeFileSync(full, json);
  const gz = zlib.gzipSync(json).length;
  return { rows: rows.length, raw: json.length, gz };
}

(async () => {
  const t0 = Date.now();
  const { encodeYearly } = await import("../lib/static-data.mjs");
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const summary = [];
  const teams = [["ALL", 0], ...Object.entries(FRANCHISE_CODE_TO_ID_MAP)];
  for (const [code, teamId] of teams) {
    const [trad, ha] = await Promise.all([fetchRows("traditional", teamId), fetchRows("homeaway", teamId)]);
    const records = teamId === 0 ? null : recordsFrom(ha);
    summary.push({ file: `traditional/${code}.json`, ...writeJson(`traditional/${code}.json`, trad, records, encodeYearly) });
    summary.push({ file: `homeaway/${code}.json`, ...writeJson(`homeaway/${code}.json`, ha, null, encodeYearly) });
  }

  // Manifest — used by the frontend to check freshness and confirm files exist
  const manifest = {
    generated_at: new Date().toISOString(),
    format: 2,
    types: ["traditional", "homeaway"],
    teams: ["ALL", ...Object.keys(FRANCHISE_CODE_TO_ID_MAP)],
    files: summary.map((s) => ({ file: s.file, rows: s.rows, gzipped_bytes: s.gz })),
  };
  const manifestPath = path.join(OUT_DIR, "manifest.json");
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  // Report
  const totalRaw = summary.reduce((s, x) => s + x.raw, 0);
  const totalGz = summary.reduce((s, x) => s + x.gz, 0);
  console.log(`\nWrote ${summary.length + 1} files to ${OUT_DIR}`);
  console.log(`Total raw:  ${fmtBytes(totalRaw)}`);
  console.log(`Total gzip: ${fmtBytes(totalGz)}`);
  console.log(`Elapsed:    ${((Date.now() - t0) / 1000).toFixed(1)}s\n`);

  console.log("File sizes (gzipped):");
  for (const s of summary.slice(0, 6)) {
    console.log(`  ${s.file.padEnd(28)} ${String(s.rows).padStart(6)} rows   ${fmtBytes(s.gz).padStart(10)}`);
  }
  console.log("  ...");
  for (const s of summary.slice(-3)) {
    console.log(`  ${s.file.padEnd(28)} ${String(s.rows).padStart(6)} rows   ${fmtBytes(s.gz).padStart(10)}`);
  }

  await pool.end();
})().catch(async (e) => { console.error(e); await pool.end(); process.exit(1); });
