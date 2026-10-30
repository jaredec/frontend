import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ASK_MODEL, askConfigured, askScorigami } from "@/lib/ask/agent";
import { DAILY_LIMIT, HOURLY_LIMIT, hashId, logAsk, rateLimited, type RateLimit } from "@/lib/ask/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_QUESTION = 300;
const MAX_TURNS = 6;

const bodySchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().trim().min(1).max(2000),
      }),
    )
    .min(1)
    .max(20),
});

function clientIp(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || "unknown";
}

const CLIENT_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function waitText(seconds: number): string {
  const minutes = Math.ceil(seconds / 60);
  if (minutes <= 1) return "in about a minute";
  if (minutes < 90) return `in about ${minutes} minutes`;
  return `in about ${Math.round(minutes / 60)} hours`;
}

function limitMessage({ scope, retryAfterSec }: RateLimit): string {
  const wait = waitText(retryAfterSec);
  if (scope === "global") {
    return `Ask Scorigami has used up its ${DAILY_LIMIT} questions for today across all visitors. It'll be back ${wait}.`;
  }
  if (scope === "network") return `A lot of questions are coming from your network right now. Try again ${wait}.`;
  return `You've reached the limit of ${HOURLY_LIMIT} questions an hour. You can ask again ${wait}.`;
}

export async function POST(req: NextRequest) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const history = parsed.data.messages.slice(-MAX_TURNS);
  const last = history[history.length - 1];
  if (last.role !== "user") return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  if (last.content.length > MAX_QUESTION) {
    return NextResponse.json({ error: `Questions can be up to ${MAX_QUESTION} characters.` }, { status: 400 });
  }
  if (!askConfigured()) {
    return NextResponse.json({ error: "Ask Scorigami isn't switched on yet." }, { status: 503 });
  }

  const ipHash = hashId(clientIp(req));
  // Requests without a browser id (scripts) fall back to being limited per IP.
  const clientId = req.headers.get("x-ask-client");
  const clientHash = clientId && CLIENT_ID_RE.test(clientId) ? hashId(`client:${clientId}`) : ipHash;
  const base = { ipHash, clientHash, question: last.content, historyTurns: history.length - 1 };

  const limit = await rateLimited(ipHash, clientHash);
  if (limit) {
    await logAsk({ ...base, status: "rate_limited" });
    return NextResponse.json(
      { error: limitMessage(limit), limited: true },
      { status: 429, headers: { "Retry-After": String(Math.max(1, limit.retryAfterSec)) } },
    );
  }

  const started = Date.now();
  try {
    const result = await askScorigami(history);
    const id = await logAsk({
      ...base,
      status: result.status,
      answer: result.answer,
      draft: result.draft,
      unverified: result.unverified,
      steps: result.steps,
      retried: result.retried,
      model: ASK_MODEL,
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
      latencyMs: Date.now() - started,
    });
    return NextResponse.json({
      id,
      status: result.status,
      answer: result.answer,
      games: result.games,
      steps: result.steps,
    });
  } catch (err) {
    console.error("[ask] failed:", err);
    await logAsk({ ...base, status: "error", model: ASK_MODEL, latencyMs: Date.now() - started });
    const message = err instanceof Error ? err.message : "";
    if (/quota|rate limit|high demand|overloaded/i.test(message)) {
      return NextResponse.json({ error: "Ask Scorigami is busy right now. Try again in a minute." }, { status: 503 });
    }
    return NextResponse.json({ error: "Something went wrong answering that. Please try again." }, { status: 500 });
  }
}
