import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function GET(req: NextRequest) {
  const teamParam = req.nextUrl.searchParams.get("team");

  if (!teamParam) {
    return NextResponse.json({ message: "Team parameter is required" }, { status: 400 });
  }

  const franchiseCode = teamParam.toUpperCase();

  const query = `
    SELECT
      display_name,
      years_active,
      start_year
    FROM public.lineage
    WHERE franchise_code = $1
    ORDER BY start_year DESC;
  `;

  try {
    const { rows } = await pool.query(query, [franchiseCode]);

    return NextResponse.json(rows, {
      headers: { "Cache-Control": "s-maxage=86400, stale-while-revalidate" },
    });
  } catch (error) {
    console.error("Database query error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown database error";
    return NextResponse.json({ message: "Error fetching franchise history", details: errorMessage }, { status: 500 });
  }
}
