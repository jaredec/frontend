import { pool } from "@/lib/db";

// All ops data is fetched live on request — the dashboard is private and
// low-traffic, so freshness beats caching everywhere except the static-data
// probe (a large file, revalidated half-hourly).

const CRON_API = "https://api.cron-job.org";

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

export async function getRecentPosts(limit = 15): Promise<RecentPost[]> {
  const result = await pool.query(
    `SELECT game_id, post_type, details, score_snapshot, tweet_id, created_at::text
     FROM posted_updates ORDER BY created_at DESC LIMIT $1`,
    [limit]
  );
  return result.rows;
}
