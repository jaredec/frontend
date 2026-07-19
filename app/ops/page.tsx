import { createHash } from "crypto";
import { cookies } from "next/headers";
import type { Metadata } from "next";
import { opsLogin } from "./actions";
import {
  getCronHealth,
  getPipelineHealth,
  getStaticFreshness,
  getRecentPosts,
} from "@/lib/ops-queries";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Ops",
  robots: { index: false, follow: false },
};

function relTime(iso: string | null, nowMs: number): string {
  if (!iso) return "never";
  const then = new Date(iso.includes("T") || iso.includes(" ") ? iso : `${iso}T00:00:00Z`).getTime();
  const mins = Math.floor((nowMs - then) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function Dot({ ok, warn = false }: { ok: boolean; warn?: boolean }) {
  const color = ok ? "bg-emerald-500" : warn ? "bg-amber-500" : "bg-red-500";
  return <span className={`inline-block w-2 h-2 ${color} mr-2 align-middle`} />;
}

const box = "border border-slate-200 dark:border-[#3e3e42] bg-white dark:bg-[#252526]";
const th =
  "px-3 py-2.5 text-left font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[10px] sm:text-xs whitespace-nowrap";
const td = "px-3 py-2 text-[11px] sm:text-sm text-slate-600 dark:text-slate-300";

function LoginForm({ error }: { error: boolean }) {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#1e1e1e] flex items-center justify-center px-4">
      <form action={opsLogin} className="w-full max-w-xs border border-slate-200 dark:border-[#3e3e42] bg-white dark:bg-[#252526] p-6 space-y-3">
        <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">Ops</div>
        <input
          type="password"
          name="password"
          autoFocus
          placeholder="Password"
          className="w-full border border-slate-300 dark:border-[#3e3e42] bg-transparent px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
        />
        {error && <div className="text-xs text-red-500">Wrong password.</div>}
        <button
          type="submit"
          className="w-full bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-sm font-medium py-2 hover:opacity-90 transition-opacity"
        >
          Enter
        </button>
      </form>
    </div>
  );
}

export default async function OpsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const secret = process.env.OPS_SECRET;
  const token = (await cookies()).get("ops_auth")?.value;
  const expected = secret ? createHash("sha256").update(secret).digest("hex") : null;
  if (!expected || token !== expected) {
    return <LoginForm error={error === "1"} />;
  }

  const now = Date.now();
  const [pipeline, cronJobs, staticData, posts] = await Promise.all([
    getPipelineHealth(),
    getCronHealth(),
    getStaticFreshness(),
    getRecentPosts(),
  ]);

  // Health judgments. Ingest: nightly job means data should never trail by
  // more than ~36h during the season. Static: should match the DB's max date
  // within a day (it refreshes the morning after ingest).
  const ingestAgeH = pipeline.lastGameDate
    ? (now - new Date(`${pipeline.lastGameDate}T00:00:00Z`).getTime()) / 3600000
    : Infinity;
  const ingestOk = ingestAgeH < 60; // date-only granularity: "yesterday" ≈ fresh
  const staticLagDays =
    staticData.staticLastDate && pipeline.lastGameDate
      ? Math.round(
          (new Date(pipeline.lastGameDate).getTime() - new Date(staticData.staticLastDate).getTime()) / 86400000
        )
      : null;
  const staticOk = !staticData.error && staticLagDays !== null && staticLagDays <= 1;
  const botCron = cronJobs.find((j) => j.enabled);
  const cronOk =
    !!botCron &&
    botCron.successRate !== null &&
    botCron.successRate >= 0.96 &&
    botCron.lastRun !== null &&
    now / 1000 - botCron.lastRun < 900;

  const stats: { label: string; value: string; ok: boolean; sub?: string }[] = [
    {
      label: "DB ingest",
      value: pipeline.lastGameDate ?? "—",
      sub: `${pipeline.totalGames.toLocaleString()} games · ${pipeline.uniqueScores} scores`,
      ok: ingestOk,
    },
    {
      label: "Static data + OG",
      value: staticData.staticLastDate ?? "unreachable",
      sub: staticLagDays === null ? undefined : staticLagDays <= 0 ? "in sync with DB" : `${staticLagDays}d behind DB`,
      ok: staticOk,
    },
    {
      label: "Bot trigger (cron)",
      value: botCron?.lastRun ? relTime(new Date(botCron.lastRun * 1000).toISOString(), now) : "—",
      sub: botCron?.successRate != null ? `${(botCron.successRate * 100).toFixed(0)}% of last 50 runs OK` : undefined,
      ok: cronOk,
    },
    {
      label: "Last Final post",
      value: relTime(pipeline.lastFinalPost, now),
      sub: `${pipeline.postsLast7d} posts in 7d`,
      ok: pipeline.lastFinalPost !== null,
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#1e1e1e]">
      <main className="max-w-5xl mx-auto w-full px-4 py-8 space-y-6">
        <h1 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          MLB Scorigami · Ops
          <span className="ml-3 font-normal text-slate-400 dark:text-slate-500 text-xs">
            {new Intl.DateTimeFormat("en-CA", {
              timeZone: "America/Los_Angeles",
              year: "numeric", month: "2-digit", day: "2-digit",
              hour: "2-digit", minute: "2-digit", hour12: false,
            }).format(now).replace(",", "")} PT
          </span>
        </h1>

        {/* Health summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-slate-200 dark:bg-[#3e3e42] border border-slate-200 dark:border-[#3e3e42]">
          {stats.map((s) => (
            <div key={s.label} className="bg-white dark:bg-[#252526] p-4">
              <div className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                {s.label}
              </div>
              <div className="text-sm font-medium text-slate-900 dark:text-slate-100 tabular-nums">
                <Dot ok={s.ok} />
                {s.value}
              </div>
              {s.sub && (
                <div className="text-[11px] text-slate-500 dark:text-slate-300 mt-1 tabular-nums">{s.sub}</div>
              )}
            </div>
          ))}
        </div>

        {/* Cron jobs */}
        <div className={box}>
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-slate-300 dark:border-[#3e3e42]">
                <th className={th}>Cron job</th>
                <th className={th}>Enabled</th>
                <th className={th}>Last run</th>
                <th className={th}>Last status</th>
                <th className={th}>Success (50)</th>
                <th className={`${th} text-right`}>Avg ms</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#2d2d30]">
              {cronJobs.map((j) => (
                <tr key={j.id}>
                  <td className={`${td} font-medium text-slate-900 dark:text-slate-100`}>{j.title}</td>
                  <td className={td}>{j.enabled ? "yes" : "no"}</td>
                  <td className={`${td} tabular-nums`}>
                    {j.lastRun ? relTime(new Date(j.lastRun * 1000).toISOString(), now) : "—"}
                  </td>
                  <td className={td}>
                    {j.lastStatusText || "—"}
                    {j.lastHttpStatus ? ` (${j.lastHttpStatus})` : ""}
                  </td>
                  <td className={`${td} tabular-nums`}>
                    {j.successRate == null ? "—" : (
                      <>
                        <Dot ok={j.successRate >= 0.96} warn={j.successRate >= 0.9} />
                        {(j.successRate * 100).toFixed(0)}%{j.failures > 0 ? ` (${j.failures} fail)` : ""}
                      </>
                    )}
                  </td>
                  <td className={`${td} text-right tabular-nums`}>
                    {j.avgDurationMs == null ? "—" : Math.round(j.avgDurationMs)}
                  </td>
                </tr>
              ))}
              {cronJobs.length === 0 && (
                <tr>
                  <td className={td} colSpan={6}>
                    cron-job.org unreachable or CRONJOB_API_KEY missing
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Recent bot posts */}
        <div className={box}>
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-slate-300 dark:border-[#3e3e42]">
                <th className={th}>Posted</th>
                <th className={th}>Type</th>
                <th className={th}>Score</th>
                <th className={th}>Details</th>
                <th className={th}>Tweet</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#2d2d30]">
              {posts.map((p) => (
                <tr key={`${p.game_id}-${p.created_at}`}>
                  <td className={`${td} tabular-nums whitespace-nowrap`}>{relTime(p.created_at, now)}</td>
                  <td className={td}>{p.post_type}</td>
                  <td className={`${td} tabular-nums`}>{p.score_snapshot ?? "—"}</td>
                  <td className={td}>{p.details ?? "—"}</td>
                  <td className={td}>
                    {p.tweet_id ? (
                      <a
                        href={`https://x.com/MLBgami/status/${p.tweet_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        view ↗
                      </a>
                    ) : (
                      "dry run"
                    )}
                  </td>
                </tr>
              ))}
              {posts.length === 0 && (
                <tr>
                  <td className={td} colSpan={5}>
                    no posts recorded
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
