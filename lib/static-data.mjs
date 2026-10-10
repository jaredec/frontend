// Compact format for public/scorigami-data/*.json, shared by the dump script
// (encode), the site and the OG/ops readers (decode). Plain ESM so Node
// scripts can import it without a TS toolchain.
//
// v2 file:
//   { v: 2, teams: [name...], sources: [name...],
//     rows: [[year, score1, score2, type, occurrences, mmdd, homeIdx, visitorIdx,
//             homeScore, visitorScore, gameId, sourceIdx, box], ...],
//     records?: [[year, type, wins, losses, ties], ...] }   // franchise files only
// type is the game_type letter (R, W, L, D, F); rows are split by it so every
// game filter can be served from one file. box is the Retrosheet file name
// when it follows the usual boxesetc/<year>/ path, otherwise the full URL.
// Legacy files are a plain YearlyRow[] without game_type.

const BOX_PREFIX = "https://www.retrosheet.org/boxesetc/";

/** @type {Record<string, string>} */
const TYPE_DIR = { traditional: "traditional", home_away: "homeaway" };

/**
 * Public URL of a static data file, or null for unknown types.
 * @param {string} club franchise code or "ALL"
 * @param {string} scorigamiType "traditional" | "home_away"
 */
export function staticDataUrl(club, scorigamiType) {
  const dir = TYPE_DIR[scorigamiType];
  return dir ? `/scorigami-data/${dir}/${club}.json` : null;
}

/** @type {Record<string, string[] | null>} */
export const GAME_FILTER_TYPES = {
  all: null,
  regular: ["R"],
  playoffs: ["W", "L", "D", "F"],
  ws: ["W"],
  lcs: ["L"],
  ds: ["D"],
  wc: ["F"],
};

/**
 * @typedef {{
 *   year: number; score1: number; score2: number; occurrences: number;
 *   last_date: string | null; last_home_team: string | null; last_visitor_team: string | null;
 *   last_home_score: number | null; last_visitor_score: number | null;
 *   last_game_id: string | null; source: string | null; box_url: string | null;
 *   game_type?: string;
 * }} StaticRow
 * @typedef {{ year: number; game_type: string; wins: number; losses: number; ties: number }} RecordRow
 * @typedef {{ rows: StaticRow[]; records: RecordRow[] | null; typed: boolean }} StaticData
 */

/**
 * @param {StaticRow[]} rows  rows carrying game_type
 * @param {RecordRow[] | null} [records]
 */
export function encodeYearly(rows, records = null) {
  const teams = [];
  const teamIdx = new Map();
  const sources = [];
  const sourceIdx = new Map();
  const idx = (map, list, v) => {
    if (v == null) return -1;
    let i = map.get(v);
    if (i === undefined) {
      i = list.length;
      list.push(v);
      map.set(v, i);
    }
    return i;
  };
  const out = rows.map((r) => {
    let box = r.box_url ?? null;
    const yearPrefix = `${BOX_PREFIX}${r.year}/`;
    if (box && box.startsWith(yearPrefix)) box = box.slice(yearPrefix.length);
    const mmdd = r.last_date && r.last_date.startsWith(`${r.year}-`)
      ? Number(r.last_date.slice(5, 7)) * 100 + Number(r.last_date.slice(8, 10))
      : r.last_date;
    return [
      r.year, r.score1, r.score2, r.game_type, Number(r.occurrences), mmdd,
      idx(teamIdx, teams, r.last_home_team), idx(teamIdx, teams, r.last_visitor_team),
      r.last_home_score ?? null, r.last_visitor_score ?? null,
      r.last_game_id == null ? null : String(r.last_game_id),
      idx(sourceIdx, sources, r.source), box,
    ];
  });
  const file = { v: 2, teams, sources, rows: out };
  if (records) file.records = records.map((r) => [r.year, r.game_type, r.wins, r.losses, r.ties]);
  return file;
}

/**
 * @param {unknown} json parsed file body (v2 object or legacy row array)
 * @returns {StaticData}
 */
export function decodeYearly(json) {
  if (Array.isArray(json)) return { rows: json, records: null, typed: false };
  const f = /** @type {any} */ (json);
  if (!f || f.v !== 2) throw new Error("Unknown scorigami data format");
  const pad = (n) => String(n).padStart(2, "0");
  const rows = f.rows.map((r) => {
    const [year, score1, score2, type, occurrences, mmdd, h, v, hs, vs, gameId, src, box] = r;
    return {
      year, score1, score2, occurrences,
      last_date: typeof mmdd === "number" ? `${year}-${pad(Math.floor(mmdd / 100))}-${pad(mmdd % 100)}` : mmdd,
      last_home_team: h >= 0 ? f.teams[h] : null,
      last_visitor_team: v >= 0 ? f.teams[v] : null,
      last_home_score: hs, last_visitor_score: vs,
      last_game_id: gameId,
      source: src >= 0 ? f.sources[src] : null,
      box_url: box == null ? null : box.startsWith("http") ? box : `${BOX_PREFIX}${year}/${box}`,
      game_type: type,
    };
  });
  const records = f.records
    ? f.records.map(([year, game_type, wins, losses, ties]) => ({ year, game_type, wins, losses, ties }))
    : null;
  return { rows, records, typed: true };
}

/**
 * One row per (year, score) for a game filter — the shape the scorigami_by_year
 * views and the API return. Untyped (legacy/API) rows are returned as-is:
 * those sources are already filtered server-side.
 * @template {{ year: number; score1: number; score2: number; occurrences: number; game_type?: string; last_date: string | null; last_game_id: number | string | null }} T
 * @param {T[]} rows
 * @param {string} gameFilter
 * @returns {T[]}
 */
export function yearlyForFilter(rows, gameFilter) {
  if (rows.length === 0 || rows[0].game_type === undefined) return rows;
  const types = GAME_FILTER_TYPES[gameFilter];
  const merged = new Map();
  for (const r of rows) {
    if (types && !types.includes(/** @type {string} */ (r.game_type))) continue;
    const k = `${r.year}-${r.score1}-${r.score2}`;
    const e = merged.get(k);
    if (!e) {
      merged.set(k, { ...r });
      continue;
    }
    e.occurrences += r.occurrences;
    // Latest game wins; same-day ties break on game id, like the views.
    if (
      (r.last_date ?? "") > (e.last_date ?? "") ||
      (r.last_date === e.last_date && String(r.last_game_id) > String(e.last_game_id))
    ) {
      Object.assign(e, { ...r, occurrences: e.occurrences });
    }
  }
  return [...merged.values()];
}

/**
 * @param {RecordRow[] | null} records
 * @param {string} gameFilter
 */
export function recordsForFilter(records, gameFilter) {
  const types = GAME_FILTER_TYPES[gameFilter];
  if (!records || !types) return records;
  return records.filter((r) => types.includes(r.game_type));
}
