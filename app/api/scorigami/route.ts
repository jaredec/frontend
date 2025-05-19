/**
 * /api/scorigami?team=SDN&year=2023
 * Returns score grid + last-time-seen metadata, optionally filtered by year.
 */
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

// Helper to build the 'eligible' games CTE with an optional date filter
function buildEligibleGamesQuery(
  currentTeamFilter: string, // Added: "ALL" or specific team code
  yearFilter: string | null,
  paramOffset: number // Starting index for date filter parameters
): { query: string; params: (string | number)[] } {
  let dateFilterCondition = "";
  const queryParams: (string | number)[] = [];

  if (yearFilter && yearFilter.toUpperCase() !== "ALL") {
    const year = parseInt(yearFilter, 10);
    if (!isNaN(year)) {
      dateFilterCondition = `AND EXTRACT(YEAR FROM TO_DATE(g.date::text, 'YYYYMMDD')) = $${paramOffset}`;
      queryParams.push(year);
    }
  }

  // --- MODIFICATION: Conditionally apply franchise check ---
  let franchiseNotNullCondition = "AND th.franchise IS NOT NULL AND tv.franchise IS NOT NULL";
  // If "ALL" teams are selected AND a specific year is chosen, relax the franchise constraint.
  if (currentTeamFilter.toUpperCase() === "ALL" && (yearFilter && yearFilter.toUpperCase() !== "ALL")) {
    franchiseNotNullCondition = ""; // Remove the franchise constraint for this specific view
  }

  const whereClauses: string[] = [];
  if (franchiseNotNullCondition) { // Add if not empty
      whereClauses.push(franchiseNotNullCondition.replace(/^AND\s*/, '')); // Remove leading AND if present
  }
  if (dateFilterCondition) { // Add if not empty
      whereClauses.push(dateFilterCondition.replace(/^AND\s*/, '')); // Remove leading AND if present
  }
  
  const whereClauseString = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

  const query = `
    SELECT
      g.date               AS game_date,
      g.home_score,
      g.visitor_score,
      g.home_team,
      g.visitor_team
    FROM   gamelogs g
    JOIN   teams th ON th.team = g.home_team
    JOIN   teams tv ON tv.team = g.visitor_team
    ${whereClauseString} 
  `;
  return { query, params: queryParams };
}

export async function GET(req: NextRequest) {
  const team = (req.nextUrl.searchParams.get("team") ?? "ALL").toUpperCase();
  const year = req.nextUrl.searchParams.get("year"); 

  let finalQuery: string;
  const finalQueryParams: (string | number)[] = [];
  
  let eligibleGamesClause: string;
  let dateParams: (string | number)[];

  if (team === "ALL") {
    // Pass 'team' ("ALL") to buildEligibleGamesQuery
    ({ query: eligibleGamesClause, params: dateParams } = buildEligibleGamesQuery(team, year, 1));
    finalQueryParams.push(...dateParams);

    finalQuery = `
      WITH eligible_games AS (${eligibleGamesClause}),
      ranked AS (
        SELECT
          home_score,
          visitor_score,
          game_date,
          home_team,
          visitor_team,
          ROW_NUMBER() OVER (
            PARTITION BY home_score, visitor_score
            ORDER BY    game_date DESC
          ) AS rn
        FROM eligible_games AS g
      )
      SELECT
        home_score    AS score1,
        visitor_score AS score2,
        COUNT(*)      AS occurrences,
        TO_CHAR( TO_DATE(MAX(game_date)::text,'YYYYMMDD'), 'YYYY-MM-DD') AS last_date,
        MAX(CASE WHEN rn = 1 THEN home_team    END) AS last_home_team,
        MAX(CASE WHEN rn = 1 THEN visitor_team END) AS last_visitor_team
      FROM ranked
      GROUP BY score1, score2;
    `;
  } else {
    finalQueryParams.push(team); // Team is $1
    // Pass specific 'team' to buildEligibleGamesQuery
    ({ query: eligibleGamesClause, params: dateParams } = buildEligibleGamesQuery(team, year, 2));
    finalQueryParams.push(...dateParams);

    finalQuery = `
      WITH eligible_games AS (${eligibleGamesClause}),
      oriented AS (
        SELECT
          CASE WHEN home_team = $1 THEN home_score   ELSE visitor_score END AS score1,
          CASE WHEN home_team = $1 THEN visitor_score ELSE home_score   END AS score2,
          game_date,
          home_team,
          visitor_team
        FROM eligible_games AS g
        WHERE (home_team = $1 OR visitor_team = $1)
      ),
      ranked AS (
        SELECT *,
               ROW_NUMBER() OVER (
                 PARTITION BY score1, score2
                 ORDER BY    game_date DESC
               ) AS rn
        FROM oriented
      )
      SELECT
        score1,
        score2,
        COUNT(*) AS occurrences,
        TO_CHAR( TO_DATE(MAX(game_date)::text,'YYYYMMDD'), 'YYYY-MM-DD') AS last_date,
        MAX(CASE WHEN rn = 1 THEN home_team    END) AS last_home_team,
        MAX(CASE WHEN rn = 1 THEN visitor_team END) AS last_visitor_team
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
        query: finalQuery, 
        params: finalQueryParams 
    });
    const errorMessage = error instanceof Error ? error.message : "Unknown database error";
    // For debugging, you might want to return the query and params in the error response
    return NextResponse.json({ message: "Error fetching scorigami data", details: errorMessage, query: finalQuery, params: finalQueryParams }, { status: 500 });
  }
}