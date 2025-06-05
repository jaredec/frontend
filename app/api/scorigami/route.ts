import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

// Corrected Helper to build the 'eligible' games CTE
function buildEligibleGamesQuery(
  currentTeamParam: string,
  yearFilter: string | null,
  paramIdxStart: number
): { query: string; params: (string | number)[] } {
  const queryParams: (string | number)[] = [];
  let conditions: string[] = [];
  let currentParamIdx = paramIdxStart;

  if (yearFilter && yearFilter.toUpperCase() !== "ALL") {
    const year = parseInt(yearFilter, 10);
    if (!isNaN(year)) {
      conditions.push(
        `g.date >= MAKE_DATE($${currentParamIdx}, 1, 1) AND g.date < MAKE_DATE($${currentParamIdx} + 1, 1, 1)`
      );
      queryParams.push(year); // Push year value ONCE for this parameter $currentParamIdx
      currentParamIdx++; // Increment for the next distinct parameter this function might add
    }
  }

  let applyFranchiseNotNullCondition = true;
  if (currentTeamParam.toUpperCase() === "ALL" && (yearFilter && yearFilter.toUpperCase() !== "ALL")) {
    applyFranchiseNotNullCondition = false;
  }
  if (applyFranchiseNotNullCondition) {
    // Assuming 'teams.franchise' is the column to check.
    // If you meant to ensure the team records themselves exist, INNER JOINs already do that.
    conditions.push("th.franchise IS NOT NULL AND tv.franchise IS NOT NULL");
  }

  const whereClauseString = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const query = `
    SELECT
      g.game_id, 
      g.date AS game_date,
      g.home_score,
      g.visitor_score,
      th.team AS home_team_code,
      tv.team AS visitor_team_code
    FROM gamelogs g
    INNER JOIN teams th ON th.team_id = g.home_team_id
    INNER JOIN teams tv ON tv.team_id = g.visitor_team_id
    ${whereClauseString}
  `;
  return { query, params: queryParams };
}

// The rest of your GET function...
export async function GET(req: NextRequest) {
  const teamParam = (req.nextUrl.searchParams.get("team") ?? "ALL").toUpperCase();
  const yearParam = req.nextUrl.searchParams.get("year");

  let finalQuery: string;
  const finalQueryParams: (string | number)[] = [];
  let queryParamIndex = 1; 

  if (teamParam !== "ALL") {
    finalQueryParams.push(teamParam); 
    queryParamIndex++;
  }

  const { query: eligibleGamesClause, params: dateParams } = buildEligibleGamesQuery(teamParam, yearParam, queryParamIndex);
  finalQueryParams.push(...dateParams);

  if (teamParam === "ALL") {
    finalQuery = `
      WITH eligible_games AS (${eligibleGamesClause}),
      ranked AS (
        SELECT
          home_score,
          visitor_score,
          game_date,
          game_id,
          home_team_code,
          visitor_team_code,
          ROW_NUMBER() OVER (
            PARTITION BY home_score, visitor_score
            ORDER BY game_date DESC, game_id DESC
          ) AS rn
        FROM eligible_games -- Removed AS g here, not strictly needed and can avoid confusion
      )
      SELECT
        home_score AS score1,
        visitor_score AS score2,
        COUNT(*) AS occurrences,
        TO_CHAR(MAX(game_date), 'YYYY-MM-DD') AS last_date,
        MAX(CASE WHEN rn = 1 THEN home_team_code END) AS last_home_team,
        MAX(CASE WHEN rn = 1 THEN visitor_team_code END) AS last_visitor_team
      FROM ranked
      GROUP BY score1, score2;
    `;
  } else {
    finalQuery = `
      WITH eligible_games AS (${eligibleGamesClause}),
      oriented AS (
        SELECT
          el_g.game_date,
          el_g.game_id,
          el_g.home_team_code,
          el_g.visitor_team_code,
          CASE WHEN el_g.home_team_code = $1 THEN el_g.home_score ELSE el_g.visitor_score END AS score1,
          CASE WHEN el_g.home_team_code = $1 THEN el_g.visitor_score ELSE el_g.home_score END AS score2
        FROM eligible_games AS el_g
        WHERE (el_g.home_team_code = $1 OR el_g.visitor_team_code = $1)
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
        MAX(CASE WHEN rn = 1 THEN home_team_code END) AS last_home_team,
        MAX(CASE WHEN rn = 1 THEN visitor_team_code END) AS last_visitor_team
      FROM ranked
      GROUP BY score1, score2;
    `;
  }

  try {
    const { rows } = await pool.query(finalQuery, finalQueryParams);
    return NextResponse.json(rows, {
      headers: { "Cache-Control": "s-maxage=300, stale-while-revalidate" },
    });
  } catch (error) {
    console.error("Database query error:", {
        message: (error as Error).message,
        stack: (error as Error).stack, // Added stack for more details
        query: finalQuery,
        params: finalQueryParams
    });
    const errorMessage = error instanceof Error ? error.message : "Unknown database error";
    return NextResponse.json({ message: "Error fetching scorigami data", details: errorMessage, query: finalQuery, params: finalQueryParams }, { status: 500 });
  }
}