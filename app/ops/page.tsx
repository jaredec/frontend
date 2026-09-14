import { createHash } from "crypto";
import { cookies } from "next/headers";
import type { Metadata } from "next";
import { opsLogin } from "./actions";
import {
  getCronHealth,
  getPipelineHealth,
  getStaticFreshness,
  getRecentPosts,
  getUnpostedFinals,
  getSupabaseApiHealth,
  getPostVolume,
} from "@/lib/ops-queries";
import OpsDashboard from "@/components/ops-dashboard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Ops",
  robots: { index: false, follow: false },
};

const INK = "#343434";
const LINE = "#d9dee7";
const BLUE = "#2d91ff";
const RED = "#8a4a4a";
const MUTED = "#5a6a7a";

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

function unixRel(unix: number | null, nowMs: number): string {
  if (!unix) return "—";
  return relTime(new Date(unix * 1000).toISOString(), nowMs);
}

function LoginForm({ error }: { error: boolean }) {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{
        backgroundColor: "#f2f2f2",
        fontFamily: "var(--v2-ui-font), system-ui, sans-serif",
        color: INK,
      }}
    >
      <form
        action={opsLogin}
        className="w-full max-w-xs bg-white p-7 space-y-4 text-center"
        style={{ border: `0.5px solid ${LINE}` }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo3.svg" alt="" className="h-12 w-12 mx-auto object-contain" />
        <div
          className="text-[28px] tracking-tight"
          style={{
            fontFamily: "var(--v2-title-font)",
            fontWeight: 700,
            WebkitTextStroke: `0.4px ${INK}`,
          }}
        >
          Ops
        </div>
        <input
          type="password"
          name="password"
          autoFocus
          placeholder="Password"
          className="w-full bg-transparent px-3 py-2 text-[15px] text-center focus:outline-none"
          style={{ border: `0.5px solid ${LINE}`, color: INK }}
        />
        {error && (
          <div className="text-[13px]" style={{ color: RED }}>
            Wrong password.
          </div>
        )}
        <button
          type="submit"
          className="w-full text-[15px] font-semibold py-2.5 text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: "#0b162a" }}
        >
          Enter
        </button>
        <a href="/" className="block text-[13px] underline underline-offset-2" style={{ color: BLUE }}>
          Back to the grid
        </a>
      </form>
      <p className="mt-6 text-[12px]" style={{ color: MUTED }}>
        Private monitor. Not indexed.
      </p>
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
  const [pipeline, cronJobs, staticData, posts, unpostedFinals, apiDay, apiHour, volume] = await Promise.all([
    getPipelineHealth(),
    getCronHealth(),
    getStaticFreshness(),
    getRecentPosts(),
    getUnpostedFinals(),
    getSupabaseApiHealth(24),
    getSupabaseApiHealth(1),
    getPostVolume(14),
  ]);

  const stuckFinals = unpostedFinals.filter((f) => f.minutesSinceFinal === null || f.minutesSinceFinal >= 15);
  const pendingFinals = unpostedFinals.filter((f) => f.minutesSinceFinal !== null && f.minutesSinceFinal < 15);

  const ingestAgeH = pipeline.lastGameDate
    ? (now - new Date(`${pipeline.lastGameDate}T00:00:00Z`).getTime()) / 3600000
    : Infinity;
  const ingestOk = ingestAgeH < 60;
  const staticLagDays =
    staticData.staticLastDate && pipeline.lastGameDate
      ? Math.round(
          (new Date(pipeline.lastGameDate).getTime() - new Date(staticData.staticLastDate).getTime()) / 86400000
        )
      : null;
  const staticOk = !staticData.error && staticLagDays !== null && staticLagDays <= 1;
  const botCron =
    cronJobs.find((j) => /bot trigger/i.test(j.title)) ?? cronJobs.find((j) => j.enabled);
  const cronOk =
    !!botCron &&
    botCron.successRate !== null &&
    botCron.successRate >= 0.96 &&
    botCron.lastRun !== null &&
    now / 1000 - botCron.lastRun < 900;

  const restOk = !apiHour.available || apiHour.successRate === null || apiHour.successRate >= 0.99;
  const restWarn =
    apiHour.available &&
    apiHour.successRate !== null &&
    apiHour.successRate >= 0.95 &&
    apiHour.successRate < 0.99;

  const overall =
    stuckFinals.length > 0
      ? { label: "Stuck Final", ok: false as const, warn: false }
      : !cronOk
        ? { label: "Cron needs a look", ok: false as const, warn: false }
        : pendingFinals.length > 0
          ? { label: "Game just finished", ok: true as const, warn: true }
          : restWarn
            ? { label: "REST is flaky", ok: true as const, warn: true }
            : { label: "All clear", ok: true as const, warn: false };

  const apiPct = (h: typeof apiDay) =>
    !h.available ? "no token" : h.successRate === null ? "idle" : `${(h.successRate * 100).toFixed(1)}%`;

  const stats = [
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
      label: "Bot trigger",
      value: unixRel(botCron?.lastRun ?? null, now),
      sub: botCron?.successRate != null ? `${(botCron.successRate * 100).toFixed(0)}% of last ${botCron.runs.length || 50} OK` : undefined,
      ok: cronOk,
    },
    {
      label: "Last Final post",
      value: relTime(pipeline.lastFinalPost, now),
      sub: `${pipeline.postsLast7d} posts in 7d`,
      ok: pipeline.lastFinalPost !== null && stuckFinals.length === 0,
    },
    {
      label: "Unposted Finals",
      value: unpostedFinals.length === 0 ? "none" : String(unpostedFinals.length),
      sub:
        stuckFinals.length > 0
          ? `${stuckFinals.length} stuck >15m`
          : pendingFinals.length > 0
            ? `${pendingFinals.length} just finished`
            : "all Finals posted",
      ok: unpostedFinals.length === 0,
      warn: stuckFinals.length === 0 && pendingFinals.length > 0,
    },
    {
      label: "Supabase REST",
      value: !apiHour.available ? "no token" : `60m ${apiPct(apiHour)}`,
      sub: apiDay.available
        ? `24h ${apiPct(apiDay)} · ${apiDay.total.toLocaleString()} req, ${apiDay.errors} 5xx`
        : "set SUPABASE_ACCESS_TOKEN",
      ok: restOk,
      warn: restWarn,
    },
  ];

  return (
    <OpsDashboard
      now={now}
      pipeline={pipeline}
      staticData={staticData}
      stats={stats}
      stuckFinals={stuckFinals}
      pendingFinals={pendingFinals}
      unpostedFinals={unpostedFinals}
      cronJobs={cronJobs}
      botCron={botCron}
      volume={volume}
      posts={posts}
      apiHour={apiHour}
      apiDay={apiDay}
      overall={overall}
    />
  );
}
