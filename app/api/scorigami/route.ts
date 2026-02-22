import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { FRANCHISE_CODE_TO_ID_MAP, getYearlyScorigami } from '@/lib/scorigami-queries';

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
    // Yearly mode: delegate to shared function
    if (mode === 'yearly') {
      const rows = await getYearlyScorigami(team, type);
      return NextResponse.json(rows, { headers: CACHE_HEADERS });
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
