import { pool } from "@/lib/db";
import type { GameFilter } from "@/lib/mlb-data";

export const FRANCHISE_CODE_TO_ID_MAP: Record<string, number> = {
  LAA: 108, ARI: 109, ATL: 144, BAL: 110, BOS: 111,
  CWS: 145, CHC: 112, CIN: 113, CLE: 114, COL: 115,
  DET: 116, HOU: 117, KC: 118, LAD: 119, MIA: 146,
  MIL: 158, MIN: 142, NYY: 147, NYM: 121, OAK: 133,
  PHI: 143, PIT: 134, SD: 135, SEA: 136, SFG: 137,
  STL: 138, TB: 139, TEX: 140, TOR: 141, WSH: 120,
};

export interface YearlyRow {
  year: number;
  score1: number;
  score2: number;
  occurrences: number;
  last_date: string | null;
  last_home_team: string | null;
  last_visitor_team: string | null;
  last_game_id: number | null;
  source: string | null;
}

const PLAYOFF_TYPES = `('W','L','D','F')`;

function gameTypeClause(gameFilter: GameFilter): string {
  if (gameFilter === "playoffs") return `AND g.game_type IN ${PLAYOFF_TYPES}`;
  if (gameFilter === "regular")  return `AND g.game_type = 'R'`;
  if (gameFilter === "ws")       return `AND g.game_type = 'W'`;
  if (gameFilter === "lcs")      return `AND g.game_type = 'L'`;
  if (gameFilter === "ds")       return `AND g.game_type = 'D'`;
  if (gameFilter === "wc")       return `AND g.game_type = 'F'`;
  return "";
}

export async function getYearlyScorigami(
  team: string,
  type: string,
  gameFilter: GameFilter = "all"
): Promise<YearlyRow[]> {
  const teamId = team === "ALL" ? 0 : (FRANCHISE_CODE_TO_ID_MAP[team] || 0);
  const isTraditional = type === "traditional";

  // All teams, no game filter: use fast materialized views
  if (teamId === 0 && gameFilter === "all") {
    const view = isTraditional ? "scorigami_by_year" : "scorigami_by_year_ha";
    const result = await pool.query(`
      SELECT year, score1, score2, occurrences::int,
             last_date::text, last_home_team, last_visitor_team,
             last_game_id, source
      FROM ${view}
      WHERE team_id = 0
      ORDER BY year, score1, score2
    `);
    return result.rows;
  }

  // All teams + game filter: fall back to direct gamelogs query
  if (teamId === 0) {
    const gameClause = gameTypeClause(gameFilter);
    const scoreSelect = isTraditional
      ? `GREATEST(g.home_score, g.visitor_score) AS score1, LEAST(g.home_score, g.visitor_score) AS score2`
      : `g.home_score AS score1, g.visitor_score AS score2`;

    const result = await pool.query(`
      SELECT
        EXTRACT(YEAR FROM g.date)::int AS year,
        ${scoreSelect},
        COUNT(*)::int AS occurrences,
        MAX(g.date)::text AS last_date,
        (ARRAY_AGG(g.home_team  ORDER BY g.date DESC))[1] AS last_home_team,
        (ARRAY_AGG(g.visitor_team ORDER BY g.date DESC))[1] AS last_visitor_team,
        (ARRAY_AGG(g.game_id    ORDER BY g.date DESC))[1] AS last_game_id,
        (ARRAY_AGG(g.source     ORDER BY g.date DESC))[1] AS source
      FROM gamelogs g
      WHERE g.is_negro_league = false
        ${gameClause}
      GROUP BY year, score1, score2
      ORDER BY year, score1, score2
    `);
    return result.rows;
  }

  // Per-team query
  const gameClause = gameTypeClause(gameFilter);
  const scoreSelect = isTraditional
    ? `GREATEST(g.home_score, g.visitor_score) AS score1, LEAST(g.home_score, g.visitor_score) AS score2`
    : `CASE WHEN g.home_team_id = $1 THEN g.home_score ELSE g.visitor_score END AS score1,
       CASE WHEN g.home_team_id = $1 THEN g.visitor_score ELSE g.home_score END AS score2`;

  const result = await pool.query(`
    SELECT
      EXTRACT(YEAR FROM g.date)::int AS year,
      ${scoreSelect},
      COUNT(*)::int AS occurrences,
      MAX(g.date)::text AS last_date,
      (ARRAY_AGG(g.home_team  ORDER BY g.date DESC))[1] AS last_home_team,
      (ARRAY_AGG(g.visitor_team ORDER BY g.date DESC))[1] AS last_visitor_team,
      (ARRAY_AGG(g.game_id    ORDER BY g.date DESC))[1] AS last_game_id,
      (ARRAY_AGG(g.source     ORDER BY g.date DESC))[1] AS source
    FROM gamelogs g
    WHERE (g.home_team_id = $1 OR g.visitor_team_id = $1)
      ${gameClause}
    GROUP BY year, score1, score2
    ORDER BY year, score1, score2
  `, [teamId]);
  return result.rows;
}
