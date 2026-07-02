import { NextRequest, NextResponse } from "next/server";
import { getScorigamiArchive, PAGE_SIZE } from "@/lib/archive-queries";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);

  const data = await getScorigamiArchive(page);

  return NextResponse.json({
    ...data,
    totalPages: Math.ceil(data.total / PAGE_SIZE),
  });
}
