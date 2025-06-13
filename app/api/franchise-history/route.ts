// File: app/api/franchise-history/route.ts

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
      city, 
      nickname, 
      first, 
      last
    FROM 
      public.teams 
    WHERE 
      franchise = $1 OR team = $1
    ORDER BY 
      first;
  `;

  try {
    const { rows } = await pool.query(query, [franchiseCode]);

    // If the franchise has only existed as one team, there's no history to show.
    if (rows.length <= 1) {
      return NextResponse.json([], {
        headers: { "Cache-Control": "s-maxage=86400, stale-while-revalidate" },
      });
    }

    return NextResponse.json(rows, {
      headers: { "Cache-control": "s-maxage=86400, stale-while-revalidate" },
    });
  } catch (error) {
    console.error("Database query error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown database error";
    return NextResponse.json({ message: "Error fetching franchise history", details: errorMessage }, { status: 500 });
  }
}