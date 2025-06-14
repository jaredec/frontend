import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

// This helper is now used by both query paths
function buildEligibleGamesQuery(
  yearFilter: string | null,
  paramIdxStart: number
): { query: string; params: (string | number)[] } {
  const queryParams: (string | number)[] = [];
  // ▼▼▼ CORRECTED: Changed 'let' to 'const' as it's not reassigned ▼▼▼
  const conditions: string[] = [];
  let currentParamIdx = paramIdxStart;

  if (yearFilter && yearFilter.toUpperCase() !== "ALL") {
    const year = parseInt(yearFilter, 10);
    if (!isNaN(year)) {
      conditions.push(
        `g.date >= MAKE_DATE($${currentParamIdx}, 1, 1) AND g.date < MAKE_DATE($${currentParamIdx} + 1, 1, 1)`
      );
      queryParams.push(year);
      currentParamIdx++;
    }
  }
  
  const whereClauseString = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const query = `
    SELECT
      g.game_id, 
      g.date AS game_date,
      g.home_score,
      g.visitor_score,
      th.team AS home_team_code,
      tv.team AS visitor_team_code,
      th.franchise AS home_franchise_code,
      tv.franchise AS visitor_franchise_code,
      th.city || ' ' || th.nickname AS home_team_name,
      tv.city || ' ' || tv.nickname AS visitor_team_name
    FROM gamelogs g
    INNER JOIN teams th ON th.team_id = g.home_team_id
    INNER JOIN teams tv ON tv.team_id = g.visitor_team_id
    ${whereClauseString}
  `;
  return { query, params: queryParams };
}

export async function GET(req: NextRequest) {
  const teamParam = (req.nextUrl.searchParams.get("team") ?? "ALL").toUpperCase();
  const yearParam = req.nextUrl.searchParams.get("year");
  const scorigamiType = req.nextUrl.searchParams.get("type") ?? "oriented"; // Default to 'oriented'

  let finalQuery: string;
  const finalQueryParams: (string | number)[] = [];
  let queryParamIndex = 1;

  finalQueryParams.push(teamParam);
  queryParamIndex++;

  const { query: eligibleGamesClause, params: dateParams } = buildEligibleGamesQuery(yearParam, queryParamIndex);
  finalQueryParams.push(...dateParams);


  if (scorigamiType === 'traditional') {
    finalQuery = `
      WITH eligible_games AS (${eligibleGamesClause}),
      scores AS (
        SELECT
          el_g.game_date,
          el_g.game_id,
          el_g.home_team_name,
          el_g.visitor_team_name,
          LEAST(el_g.home_score, el_g.visitor_score) AS score1,
          GREATEST(el_g.home_score, el_g.visitor_score) AS score2
        FROM eligible_games el_g
        WHERE ($1 = 'ALL' 
           OR COALESCE(el_g.home_franchise_code, el_g.home_team_code) = $1 
           OR COALESCE(el_g.visitor_franchise_code, el_g.visitor_team_code) = $1)
      ),
      ranked AS (
        SELECT *,
               ROW_NUMBER() OVER (
                 PARTITION BY score1, score2
                 ORDER BY game_date DESC, game_id DESC
               ) AS rn
        FROM scores
      )
      SELECT
        score1,
        score2,
        COUNT(*) AS occurrences,
        TO_CHAR(MAX(game_date), 'YYYY-MM-DD') AS last_date,
        MAX(CASE WHEN rn = 1 THEN home_team_name END) AS last_home_team,
        MAX(CASE WHEN rn = 1 THEN visitor_team_name END) AS last_visitor_team
      FROM ranked
      GROUP BY score1, score2;
    `;

  } else { // 'oriented' scorigami
    if (teamParam === "ALL") {
      // ▼▼▼ CORRECTED: Removed the unused 'orientedParams' variable ▼▼▼
      finalQuery = `
        WITH eligible_games AS (${buildEligibleGamesQuery(yearParam, 1).query}),
        ranked AS (
          SELECT
            home_score,
            visitor_score,
            game_date,
            game_id,
            home_team_name,
            visitor_team_name,
            ROW_NUMBER() OVER (
              PARTITION BY home_score, visitor_score
              ORDER BY game_date DESC, game_id DESC
            ) AS rn
          FROM eligible_games
        )
        SELECT
          visitor_score AS score1,
          home_score AS score2,
          COUNT(*) AS occurrences,
          TO_CHAR(MAX(game_date), 'YYYY-MM-DD') AS last_date,
          MAX(CASE WHEN rn = 1 THEN home_team_name END) AS last_home_team,
          MAX(CASE WHEN rn = 1 THEN visitor_team_name END) AS last_visitor_team
        FROM ranked
        GROUP BY score1, score2;
      `;
      finalQueryParams.length = 0;
      finalQueryParams.push(...dateParams);
      
    } else {
      finalQuery = `
        WITH eligible_games AS (${eligibleGamesClause}),
        oriented AS (
          SELECT
            el_g.game_date,
            el_g.game_id,
            el_g.home_team_name,
            el_g.visitor_team_name,
            CASE WHEN COALESCE(el_g.home_franchise_code, el_g.home_team_code) = $1 THEN el_g.visitor_score ELSE el_g.home_score END AS score1,
            CASE WHEN COALESCE(el_g.home_franchise_code, el_g.home_team_code) = $1 THEN el_g.home_score ELSE el_g.visitor_score END AS score2
          FROM eligible_games AS el_g
          WHERE (COALESCE(el_g.home_franchise_code, el_g.home_team_code) = $1 OR COALESCE(el_g.visitor_franchise_code, el_g.visitor_team_code) = $1)
        ),
        ranked AS (
          SELECT *,
                 ROW_NUMBER() OVER (
                   PARTITION BY score1, score2
                   ORDER BY game_date DESC, game_id DESC
                 ) AS rn
          FROM oriented
        )
        SELECT
          score1,
          score2,
          COUNT(*) AS occurrences,
          TO_CHAR(MAX(game_date), 'YYYY-MM-DD') AS last_date,
          MAX(CASE WHEN rn = 1 THEN home_team_name END) AS last_home_team,
          MAX(CASE WHEN rn = 1 THEN visitor_team_name END) AS last_visitor_team
        FROM ranked
        GROUP BY score1, score2;
      `;
    }
  }

  try {
    const { rows } = await pool.query(finalQuery, finalQueryParams);
    return NextResponse.json(rows, {
      headers: { "Cache-Control": "s-maxage=300, stale-while-revalidate" },
    });
  } catch (error) {
    console.error("Database query error:", {
        message: (error as Error).message,
        stack: (error as Error).stack,
        query: finalQuery,
        params: finalQueryParams
    });
    const errorMessage = error instanceof Error ? error.message : "Unknown database error";
    return NextResponse.json({ message: "Error fetching scorigami data", details: errorMessage }, { status: 500 });
  }
}