import { createHash } from "node:crypto";
import { pool } from "@/lib/db";

/** Per browser, per hour. */
export const HOURLY_LIMIT = Number(process.env.ASK_HOURLY_LIMIT ?? 15);
/** Per IP, per hour. Higher than HOURLY_LIMIT because schools, offices and phone carriers share IPs. */
export const NETWORK_HOURLY_LIMIT = Number(process.env.ASK_NETWORK_HOURLY_LIMIT ?? 60);
/** Whole site, rolling 24 hours. */
export const DAILY_LIMIT = Number(process.env.ASK_DAILY_LIMIT ?? 200);

/** Local testing shouldn't lock the developer out; the site-wide cap still applies. */
const PER_VISITOR_LIMITS = process.env.NODE_ENV !== "development";

export function hashId(value: string): string {
  const salt = process.env.ASK_IP_SALT ?? process.env.CRON_SECRET ?? "";
  return createHash("sha256").update(`${salt}:${value}`).digest("hex").slice(0, 32);
}

export interface RateLimit {
  scope: "user" | "network" | "global";
  retryAfterSec: number;
}

// Fallback for when ask_log is unreachable. Per-instance only, so it's a
// backstop rather than the real limit.
const recent = new Map<string, number[]>();

function memoryLimit(clientHash: string): RateLimit | null {
  if (!PER_VISITOR_LIMITS) return null;
  const now = Date.now();
  const hits = (recent.get(clientHash) ?? []).filter((t) => t > now - 3600_000);
  if (hits.length >= HOURLY_LIMIT) return { scope: "user", retryAfterSec: Math.ceil((hits[0] + 3600_000 - now) / 1000) };
  hits.push(now);
  recent.set(clientHash, hits);
  return null;
}

/**
 * Returns the limit that was hit, or null if the question may proceed. Per-visitor
 * limits only count questions that got an answer, so outages don't use them up.
 */
export async function rateLimited(ipHash: string, clientHash: string): Promise<RateLimit | null> {
  try {
    const { rows } = await pool.query<{
      today: number;
      today_wait: number | null;
      network: number;
      network_wait: number | null;
      mine: number;
      mine_wait: number | null;
    }>(
      `WITH recent AS (
         SELECT ip_hash, client_hash, created_at,
           created_at > now() - interval '1 hour' AND status IN ('answered', 'unverified') AS counts_hourly
         FROM ask_log
         WHERE created_at > now() - interval '24 hours' AND status <> 'rate_limited'
       )
       SELECT
         count(*)::int AS today,
         extract(epoch FROM min(created_at) + interval '24 hours' - now())::int AS today_wait,
         count(*) FILTER (WHERE counts_hourly AND ip_hash = $1)::int AS network,
         extract(epoch FROM min(created_at) FILTER (WHERE counts_hourly AND ip_hash = $1) + interval '1 hour' - now())::int AS network_wait,
         count(*) FILTER (WHERE counts_hourly AND client_hash = $2)::int AS mine,
         extract(epoch FROM min(created_at) FILTER (WHERE counts_hourly AND client_hash = $2) + interval '1 hour' - now())::int AS mine_wait
       FROM recent`,
      [ipHash, clientHash],
    );
    const r = rows[0];
    if (r.today >= DAILY_LIMIT) return { scope: "global", retryAfterSec: r.today_wait ?? 3600 };
    if (PER_VISITOR_LIMITS && r.mine >= HOURLY_LIMIT) return { scope: "user", retryAfterSec: r.mine_wait ?? 3600 };
    if (PER_VISITOR_LIMITS && r.network >= NETWORK_HOURLY_LIMIT) return { scope: "network", retryAfterSec: r.network_wait ?? 3600 };
    return null;
  } catch {
    return memoryLimit(clientHash);
  }
}

export interface AskLogEntry {
  ipHash: string;
  clientHash: string;
  question: string;
  historyTurns: number;
  status: "answered" | "unverified" | "error" | "rate_limited";
  answer?: string;
  draft?: string;
  unverified?: string[];
  steps?: unknown;
  retried?: boolean;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  latencyMs?: number;
}

/** Logging must never break an answer, so failures only warn. Returns the row's public id. */
export async function logAsk(e: AskLogEntry): Promise<string | null> {
  try {
    const { rows } = await pool.query<{ public_id: string }>(
      `INSERT INTO ask_log (ip_hash, client_hash, question, history_turns, status, answer, draft, unverified_numbers,
         steps, retried, model, input_tokens, output_tokens, latency_ms)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10, $11, $12, $13, $14)
       RETURNING public_id`,
      [
        e.ipHash,
        e.clientHash,
        e.question,
        e.historyTurns,
        e.status,
        e.answer ?? null,
        e.draft ?? null,
        e.unverified?.length ? JSON.stringify(e.unverified) : null,
        e.steps ? JSON.stringify(e.steps) : null,
        e.retried ?? false,
        e.model ?? null,
        e.inputTokens ?? null,
        e.outputTokens ?? null,
        e.latencyMs ?? null,
      ],
    );
    return rows[0]?.public_id ?? null;
  } catch (err) {
    console.warn("[ask] log insert failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

export async function recordFeedback(publicId: string, value: 1 | -1): Promise<boolean> {
  try {
    const { rowCount } = await pool.query(`UPDATE ask_log SET feedback = $2 WHERE public_id = $1`, [publicId, value]);
    return (rowCount ?? 0) > 0;
  } catch {
    return false;
  }
}
