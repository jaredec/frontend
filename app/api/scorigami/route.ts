/**
 * GET /api/scorigami?team=SDP
 * Returns JSON rows: [{ score1: 5, score2: 3, occurrences: 27 }, …]
 * - "ALL" (default) → league-wide grid
 * - Any team code (e.g. SDP, LAD) → that club's runs first
 */
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function GET(req: NextRequest) {
  const team = (req.nextUrl.searchParams.get("team") ?? "ALL").toUpperCase();

  const { rows } = await pool.query(
    team === "ALL"
      ? `
        SELECT home_score  AS score1,
               visitor_score AS score2,
               SUM(n)::int     AS occurrences
        FROM   mlb_scorigami
        GROUP  BY score1, score2
      `
      : `
        SELECT CASE WHEN home_team = $1
                     THEN home_score  ELSE visitor_score END AS score1,
               CASE WHEN home_team = $1
                     THEN visitor_score ELSE home_score  END AS score2,
               SUM(n)::int AS occurrences
        FROM   mlb_scorigami
        WHERE  home_team = $1 OR visitor_team = $1
        GROUP  BY score1, score2
      `,
    team === "ALL" ? [] : [team]
  );

  return NextResponse.json(rows, {
    headers: { "Cache-Control": "s-maxage=300, stale-while-revalidate" },
  });
}
