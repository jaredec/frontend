// Dump the scorigami materialized views to static JSON files.
//
// Output layout:
//   public/scorigami-data/manifest.json                 — index + version stamp
//   public/scorigami-data/traditional/ALL.json
//   public/scorigami-data/traditional/<CODE>.json       — per franchise
//   public/scorigami-data/homeaway/ALL.json
//   public/scorigami-data/homeaway/<CODE>.json
//
// Each file matches the shape of YearlyRow[] returned by /api/scorigami?mode=yearly.
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

async function fetchView(view, teamId) {
  const { rows } = await pool.query(
    `SELECT year, score1, score2, occurrences::int,
            last_date::text, last_home_team, last_visitor_team,
            last_game_id, source
     FROM ${view}
     WHERE team_id = $1
     ORDER BY year, score1, score2`,
    [teamId]
  );
  return rows;
}

function writeJson(relPath, data) {
  const full = path.join(OUT_DIR, relPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  const json = JSON.stringify(data);
  fs.writeFileSync(full, json);
  const gz = zlib.gzipSync(json).length;
  return { rows: data.length, raw: json.length, gz };
}

(async () => {
  const t0 = Date.now();
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const targets = [
    { type: "traditional", view: "scorigami_by_year" },
    { type: "homeaway", view: "scorigami_by_year_ha" },
  ];

  const summary = [];
  for (const { type, view } of targets) {
    // ALL teams
    const allRows = await fetchView(view, 0);
    const allStats = writeJson(`${type}/ALL.json`, allRows);
    summary.push({ file: `${type}/ALL.json`, ...allStats });

    // Each franchise
    for (const [code, teamId] of Object.entries(FRANCHISE_CODE_TO_ID_MAP)) {
      const rows = await fetchView(view, teamId);
      const stats = writeJson(`${type}/${code}.json`, rows);
      summary.push({ file: `${type}/${code}.json`, ...stats });
    }
  }

  // Manifest — used by the frontend to check freshness and confirm files exist
  const manifest = {
    generated_at: new Date().toISOString(),
    types: targets.map((t) => t.type),
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
