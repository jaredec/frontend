import { createClient } from '@supabase/supabase-js';
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
  const year = searchParams.get('year') || 'ALL';
  const type = searchParams.get('type') || 'traditional';
  const yearStart = searchParams.get('yearStart');
  const yearEnd = searchParams.get('yearEnd');

  const teamId = team === 'ALL' ? 0 : (FRANCHISE_CODE_TO_ID_MAP[team] || 0);

  // Use year-range SQL path when yearStart/yearEnd are provided
  if (yearStart && yearEnd) {
    try {
      const start = parseInt(yearStart, 10);
      const end = parseInt(yearEnd, 10);
      if (isNaN(start) || isNaN(end) || start < 1871 || end > 2100 || start > end) {
        return NextResponse.json({ error: 'Invalid year range' }, { status: 400 });
      }

      const isTraditional = type === 'traditional';

      // Build score columns based on type
      const scoreSelect = isTraditional
        ? `GREATEST(g.home_score, g.visitor_score) AS score1, LEAST(g.home_score, g.visitor_score) AS score2`
        : `g.home_score AS score1, g.visitor_score AS score2`;

      // Build team filter
      let teamFilter = '';
      const params: (number | string)[] = [start, end];
      if (teamId > 0) {
        teamFilter = ` AND (g.home_team_id = $3 OR g.visitor_team_id = $3)`;
        params.push(teamId);
      }

      // Exclude negro league games unless filtering by a specific team (matches RPC behavior)
      const negroLeagueFilter = teamId > 0 ? '' : ' AND (g.is_negro_league = false)';

      const query = `
        WITH scored AS (
          SELECT
            ${scoreSelect},
            g.date,
            g.home_team,
            g.visitor_team,
            g.game_id,
            g.source,
            COUNT(*) OVER (
              PARTITION BY ${isTraditional
                ? 'GREATEST(g.home_score, g.visitor_score), LEAST(g.home_score, g.visitor_score)'
                : 'g.home_score, g.visitor_score'}
            ) AS occurrences,
            ROW_NUMBER() OVER (
              PARTITION BY ${isTraditional
                ? 'GREATEST(g.home_score, g.visitor_score), LEAST(g.home_score, g.visitor_score)'
                : 'g.home_score, g.visitor_score'}
              ORDER BY g.date DESC
            ) AS rn
          FROM gamelogs g
          WHERE EXTRACT(YEAR FROM g.date) BETWEEN $1 AND $2${teamFilter}${negroLeagueFilter}
        )
        SELECT
          score1,
          score2,
          occurrences,
          date AS last_date,
          home_team AS last_home_team,
          visitor_team AS last_visitor_team,
          game_id AS last_game_id,
          source
        FROM scored
        WHERE rn = 1
        ORDER BY score1, score2
      `;

      const result = await pool.query(query, params);
      return NextResponse.json(result.rows, { headers: CACHE_HEADERS });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  // Existing single-year RPC path
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabase.rpc('get_scorigami_data', {
    p_year: year,
    p_team_id: teamId,
    p_type: type,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data, { headers: CACHE_HEADERS });
}
