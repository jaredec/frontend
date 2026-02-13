import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';

const FRANCHISE_CODE_TO_ID_MAP: Record<string, number> = {
    "LAA": 108, "ARI": 109, "ATL": 144, "BAL": 110, "BOS": 111,
    "CWS": 145, "CHC": 112, "CIN": 113, "CLE": 114, "COL": 115,
    "DET": 116, "HOU": 117, "KC":  118, "LAD": 119, "MIA": 146,
    "MIL": 158, "MIN": 142, "NYY": 147, "NYM": 121, "OAK": 133,
    "PHI": 143, "PIT": 134, "SD":  135, "SEA": 136, "SFG": 137,
    "STL": 138, "TB":  139, "TEX": 140, "TOR": 141, "WSH": 120,
};

const CACHE_HEADERS = {
  'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const team = searchParams.get('team') || 'ALL';
  const type = searchParams.get('type') || 'traditional';
  const mode = searchParams.get('mode') || 'aggregated';

  const teamId = team === 'ALL' ? 0 : (FRANCHISE_CODE_TO_ID_MAP[team] || 0);
  const isTraditional = type === 'traditional';

  try {
    // Yearly mode: return per-year breakdown for client-side filtering
    if (mode === 'yearly') {
      // All teams: use materialized views
      if (teamId === 0) {
        const view = isTraditional ? 'scorigami_by_year' : 'scorigami_by_year_ha';
        const query = `
          SELECT year, score1, score2, occurrences::int,
                 last_date, last_home_team, last_visitor_team,
                 last_game_id, source
          FROM ${view}
          WHERE team_id = 0
          ORDER BY year, score1, score2
        `;
        const result = await pool.query(query);
        return NextResponse.json(result.rows, { headers: CACHE_HEADERS });
      }

      // Per-team: query gamelogs grouped by year
      const scoreSelect = isTraditional
        ? `GREATEST(g.home_score, g.visitor_score) AS score1, LEAST(g.home_score, g.visitor_score) AS score2`
        : `g.home_score AS score1, g.visitor_score AS score2`;

      const query = `
        SELECT
          EXTRACT(YEAR FROM g.date)::int AS year,
          ${scoreSelect},
          COUNT(*)::int AS occurrences,
          MAX(g.date) AS last_date,
          (ARRAY_AGG(g.home_team ORDER BY g.date DESC))[1] AS last_home_team,
          (ARRAY_AGG(g.visitor_team ORDER BY g.date DESC))[1] AS last_visitor_team,
          (ARRAY_AGG(g.game_id ORDER BY g.date DESC))[1] AS last_game_id,
          (ARRAY_AGG(g.source ORDER BY g.date DESC))[1] AS source
        FROM gamelogs g
        WHERE (g.home_team_id = $1 OR g.visitor_team_id = $1)
        GROUP BY year, score1, score2
        ORDER BY year, score1, score2
      `;
      const result = await pool.query(query, [teamId]);
      return NextResponse.json(result.rows, { headers: CACHE_HEADERS });
    }

    // Aggregated mode (legacy): return pre-aggregated summary
    if (isTraditional) {
      const query = `
        SELECT score1, score2, occurrences,
               last_date, last_home_team, last_visitor_team,
               last_game_id, source
        FROM scorigami_summary
        WHERE team_id = $1
        ORDER BY score1, score2
      `;
      const result = await pool.query(query, [teamId]);
      return NextResponse.json(result.rows, { headers: CACHE_HEADERS });
    }

    // Home/away aggregated fallback
    const scoreSelect = `g.home_score AS score1, g.visitor_score AS score2`;
    let teamFilter = '';
    const params: number[] = [];
    if (teamId > 0) {
      teamFilter = ` WHERE (g.home_team_id = $1 OR g.visitor_team_id = $1)`;
      params.push(teamId);
    }
    const negroLeagueFilter = teamId > 0 ? '' : ' WHERE g.is_negro_league = false';

    const query = `
      WITH scored AS (
        SELECT
          ${scoreSelect},
          g.date, g.home_team, g.visitor_team, g.game_id, g.source,
          COUNT(*) OVER (PARTITION BY g.home_score, g.visitor_score) AS occurrences,
          ROW_NUMBER() OVER (PARTITION BY g.home_score, g.visitor_score ORDER BY g.date DESC) AS rn
        FROM gamelogs g
        ${teamFilter || negroLeagueFilter}
      )
      SELECT score1, score2, occurrences,
             date AS last_date, home_team AS last_home_team,
             visitor_team AS last_visitor_team, game_id AS last_game_id, source
      FROM scored WHERE rn = 1
      ORDER BY score1, score2
    `;
    const result = await pool.query(query, params);
    return NextResponse.json(result.rows, { headers: CACHE_HEADERS });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
