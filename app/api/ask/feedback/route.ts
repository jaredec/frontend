import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { recordFeedback } from "@/lib/ask/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  id: z.uuid(),
  value: z.union([z.literal(1), z.literal(-1)]),
});

export async function POST(req: NextRequest) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const ok = await recordFeedback(parsed.data.id, parsed.data.value);
  return NextResponse.json({ ok });
}
