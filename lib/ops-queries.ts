import { pool } from "@/lib/db";

// All ops data is fetched live on request — the dashboard is private and
// low-traffic, so freshness beats caching everywhere except the static-data
// probe (a large file, revalidated half-hourly).

const CRON_API = "https://api.cron-job.org";

export interface CronRun {
  at: number; // unix seconds
  ok: boolean;
  durationMs: number;
  httpStatus: number;
  statusText: string;
}

export interface CronJobHealth {
  id: number;
  title: string;
  enabled: boolean;
  lastRun: number | null; // unix seconds
  lastStatusText: string;
  lastHttpStatus: number | null;
  successRate: number | null; // over the last ~50 executions
  failures: number;
  avgDurationMs: number | null;
  runs: CronRun[];
}

interface CronHistoryEntry {
  date: number;
  status: number;
  statusText: string;
  httpStatus: number;
  duration: number;
}

export async function getCronHealth(): Promise<CronJobHealth[]> {
  const key = process.env.CRONJOB_API_KEY;
  if (!key) return [];
  const headers = { Authorization: `Bearer ${key}` };
  try {
    const res = await fetch(`${CRON_API}/jobs`, { headers, cache: "no-store" });
    if (!res.ok) return [];
    const { jobs } = (await res.json()) as {
      jobs: { jobId: number; title: string; enabled: boolean; lastExecution: number | null }[];
    };
    return await Promise.all(
      jobs.map(async (j) => {
        const out: CronJobHealth = {
          id: j.jobId,
          title: j.title || `Job ${j.jobId}`,
          enabled: j.enabled,
          lastRun: j.lastExecution ?? null,
          lastStatusText: "",
          lastHttpStatus: null,
          successRate: null,
          failures: 0,
          avgDurationMs: null,
          runs: [],
        };
        try {
          const h = await fetch(`${CRON_API}/jobs/${j.jobId}/history`, { headers, cache: "no-store" });
          if (!h.ok) return out;
          const { history } = (await h.json()) as { history: CronHistoryEntry[] };
          if (history?.length) {
            const ok = history.filter((x) => x.status === 1).length;
            out.successRate = ok / history.length;
            out.failures = history.length - ok;
            out.avgDurationMs = history.reduce((s, x) => s + (x.duration || 0), 0) / history.length;
            out.lastRun = history[0].date;
            out.lastStatusText = history[0].statusText;
            out.lastHttpStatus = history[0].httpStatus;
            // History arrives newest-first; charts want oldest-first.
            out.runs = [...history].reverse().map((x) => ({
              at: x.date,
              ok: x.status === 1,
              durationMs: x.duration || 0,
              httpStatus: x.httpStatus,
              statusText: x.statusText,
            }));
          }
        } catch {
          // history fetch failed — job row still renders with lastExecution
        }
        return out;
      })
    );
  } catch {
    return [];
  }
}

export interface PipelineHealth {
  totalGames: number;
  uniqueScores: number;
  lastGameDate: string | null; // ISO date of newest ingested game
  lastFinalPost: string | null; // ISO timestamp of newest Final post
  lastScoreUpdatePost: string | null;
  postsLast7d: number;
}

export async function getPipelineHealth(): Promise<PipelineHealth> {
  const result = await pool.query(`
    SELECT
      (SELECT COUNT(*)::int FROM gamelogs WHERE is_negro_league = false) AS total_games,
      (SELECT COUNT(DISTINCT CONCAT(GREATEST(home_score, visitor_score), '-', LEAST(home_score, visitor_score)))::int
         FROM gamelogs WHERE is_negro_league = false) AS unique_scores,
      (SELECT MAX(date)::text FROM gamelogs WHERE is_negro_league = false) AS last_game_date,
      (SELECT MAX(created_at)::text FROM posted_updates WHERE post_type = 'Final') AS last_final_post,
      (SELECT MAX(created_at)::text FROM posted_updates WHERE post_type = 'Score_Update') AS last_score_update,
      (SELECT COUNT(*)::int FROM posted_updates WHERE created_at > NOW() - INTERVAL '7 days') AS posts_7d
  `);
  const r = result.rows[0];
  return {
    totalGames: r.total_games,
    uniqueScores: r.unique_scores,
    lastGameDate: r.last_game_date,
    lastFinalPost: r.last_final_post,
    lastScoreUpdatePost: r.last_score_update,
    postsLast7d: r.posts_7d,
  };
}

export interface UnpostedFinal {
  gamePk: number;
  away: string;
  home: string;
  awayScore: number | null;
  homeScore: number | null;
  minutesSinceFinal: number | null; // null = couldn't read end time (treat as stuck)
}

interface ScheduleGameLite {
  gamePk: number;
  gameType: string;
  status: { codedGameState: string };
  teams: {
    away: { team: { name: string }; score?: number };
    home: { team: { name: string }; score?: number };
  };
}

// The truest health check: does every game the MLB API considers Final actually
// have a Final post? This catches a stuck game regardless of *why* it stuck —
// REST timeout, cron down, broken deploy, logic bug — because it compares the
// real-world outcome (schedule says Final) against our record (posted_updates),
// not the cron's own success signal (which stays 200 even when a game errors).
export async function getUnpostedFinals(): Promise<UnpostedFinal[]> {
  try {
    const res = await fetch("https://statsapi.mlb.com/api/v1/schedule/games/?sportId=1", { cache: "no-store" });
    if (!res.ok) return [];
    const data = (await res.json()) as { dates?: { games: ScheduleGameLite[] }[] };
    const games = data.dates?.[0]?.games ?? [];
    const finals = games.filter(
      (g) =>
        (g.status?.codedGameState === "F" || g.status?.codedGameState === "O") &&
        ["R", "F", "D", "L", "W"].includes(g.gameType)
    );
    if (finals.length === 0) return [];

    const { rows } = await pool.query(
      `SELECT game_id FROM posted_updates WHERE post_type = 'Final' AND game_id = ANY($1)`,
      [finals.map((g) => g.gamePk)]
    );
    const posted = new Set(rows.map((r) => Number(r.game_id)));
    const missing = finals.filter((g) => !posted.has(g.gamePk));

    // Healthy case is zero missing → zero extra fetches. Only probe the live
    // feed for the stragglers, to learn how long each has actually been Final.
    return await Promise.all(
      missing.map(async (g) => {
        let minutesSinceFinal: number | null = null;
        try {
          const f = await fetch(`https://statsapi.mlb.com/api/v1.1/game/${g.gamePk}/feed/live`, { cache: "no-store" });
          if (f.ok) {
            const d = (await f.json()) as {
              liveData?: { plays?: { allPlays?: { about?: { endTime?: string } }[] } };
            };
            const plays = d.liveData?.plays?.allPlays;
            const endTime = plays && plays.length ? plays[plays.length - 1]?.about?.endTime : undefined;
            if (endTime) minutesSinceFinal = Math.floor((Date.now() - new Date(endTime).getTime()) / 60000);
          }
        } catch {
          // feed probe failed — leave null, surfaced as stuck rather than hidden
        }
        return {
          gamePk: g.gamePk,
          away: g.teams?.away?.team?.name ?? "?",
          home: g.teams?.home?.team?.name ?? "?",
          awayScore: g.teams?.away?.score ?? null,
          homeScore: g.teams?.home?.score ?? null,
          minutesSinceFinal,
        };
      })
    );
  } catch {
    return [];
  }
}

export interface SupabaseApiHealth {
  available: boolean; // false when no token / endpoint unreachable
  windowHours: number;
  total: number;
  errors: number; // 5xx responses (the 504s live here)
  successRate: number | null; // (total - errors) / total
}

// Reads the platform-level REST success rate straight from Supabase's own logs
// (the "84.6%" number the dashboard shows) via the Management API. Needs a
// personal access token in SUPABASE_ACCESS_TOKEN; degrades gracefully to
// "unavailable" without one, mirroring how getCronHealth handles a missing key.
export async function getSupabaseApiHealth(windowHours = 6): Promise<SupabaseApiHealth> {
  const empty: SupabaseApiHealth = { available: false, windowHours, total: 0, errors: 0, successRate: null };
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!token || !projectUrl) return empty;
  const ref = projectUrl.match(/https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1];
  if (!ref) return empty;

  // BigQuery over the edge (API gateway) logs. Nested arrays must be unnested.
  // The time window is controlled by the iso_timestamp_start/end query params,
  // NOT a WHERE clause — a timestamp filter in the SQL is silently ignored and
  // returns zero rows.
  const sql = `
    select
      count(*) as total,
      countif(cast(response.status_code as int64) >= 500) as errors
    from edge_logs
    cross join unnest(metadata) as m
    cross join unnest(m.request) as request
    cross join unnest(m.response) as response
    where request.path like '/rest/v1/%'
  `;
  const end = new Date();
  const start = new Date(end.getTime() - windowHours * 3600000);
  try {
    const res = await fetch(
      `https://api.supabase.com/v1/projects/${ref}/analytics/endpoints/logs.all` +
        `?sql=${encodeURIComponent(sql)}` +
        `&iso_timestamp_start=${encodeURIComponent(start.toISOString())}` +
        `&iso_timestamp_end=${encodeURIComponent(end.toISOString())}`,
      { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }
    );
    if (!res.ok) return empty;
    const json = (await res.json()) as { result?: { total?: number; errors?: number }[] };
    const row = json.result?.[0];
    if (!row) return { ...empty, available: true };
    const total = Number(row.total ?? 0);
    const errors = Number(row.errors ?? 0);
    return {
      available: true,
      windowHours,
      total,
      errors,
      successRate: total > 0 ? (total - errors) / total : null,
    };
  } catch {
    return empty;
  }
}

export interface StaticFreshness {
  staticLastDate: string | null; // newest last_date present in the deployed ALL.json
  checkedUrl: string;
  error: boolean;
}

// The nightly workflow commits fresh JSON + OG image together, so the age of
// ALL.json is a proxy for the whole static artifact set.
export async function getStaticFreshness(): Promise<StaticFreshness> {
  const url = "https://mlbscorigami.com/scorigami-data/traditional/ALL.json";
  try {
    const res = await fetch(url, { next: { revalidate: 1800 } });
    if (!res.ok) return { staticLastDate: null, checkedUrl: url, error: true };
    const rows = (await res.json()) as { last_date: string | null }[];
    let max: string | null = null;
    for (const r of rows) {
      if (r.last_date && (!max || r.last_date > max)) max = r.last_date;
    }
    return { staticLastDate: max, checkedUrl: url, error: false };
  } catch {
    return { staticLastDate: null, checkedUrl: url, error: true };
  }
}

export interface RecentPost {
  game_id: number;
  post_type: string;
  details: string | null;
  score_snapshot: string | null;
  tweet_id: string | null;
  created_at: string;
}

export async function getRecentPosts(limit = 24): Promise<RecentPost[]> {
  const result = await pool.query(
    `SELECT game_id, post_type, details, score_snapshot, tweet_id, created_at::text
     FROM posted_updates ORDER BY created_at DESC LIMIT $1`,
    [limit]
  );
  return result.rows;
}

export interface DayVolume {
  day: string; // YYYY-MM-DD in America/Los_Angeles
  finals: number;
  updates: number;
}

export async function getPostVolume(days = 14): Promise<DayVolume[]> {
  const { rows } = await pool.query(
    `SELECT
       (created_at AT TIME ZONE 'America/Los_Angeles')::date::text AS day,
       COUNT(*) FILTER (WHERE post_type = 'Final')::int AS finals,
       COUNT(*) FILTER (WHERE post_type = 'Score_Update')::int AS updates
     FROM posted_updates
     WHERE created_at > NOW() - ($1 * INTERVAL '1 day')
     GROUP BY 1
     ORDER BY 1`,
    [days]
  );
  const byDay = new Map(rows.map((r) => [r.day as string, r]));
  const out: DayVolume[] = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86400000);
    const key = d.toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
    const hit = byDay.get(key);
    out.push({
      day: key,
      finals: hit?.finals ?? 0,
      updates: hit?.updates ?? 0,
    });
  }
  return out;
}
