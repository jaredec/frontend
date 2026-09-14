import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import type {
  CronJobHealth,
  CronRun,
  DayVolume,
  PipelineHealth,
  RecentPost,
  StaticFreshness,
  SupabaseApiHealth,
  UnpostedFinal,
} from "@/lib/ops-queries";

const INK = "#343434";
const NAVY = "#0b162a";
const BLUE = "#2d91ff";
const GREEN = "#2d7a4f";
const RED = "#8a4a4a";
const MUTED = "#5a6a7a";
const LINE = "#d9dee7";
const DEEP = "#0c248d";
const PALE = "#dbeafe";

const ui: CSSProperties = {
  fontFamily: "var(--v2-ui-font), system-ui, sans-serif",
  color: INK,
};
const titleFont: CSSProperties = {
  fontFamily: "var(--v2-title-font)",
  fontWeight: 700,
  color: INK,
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

function tone(ok: boolean, warn = false) {
  if (ok) return GREEN;
  if (warn) return MUTED;
  return RED;
}

function StatusDot({ ok, warn = false }: { ok: boolean; warn?: boolean }) {
  return (
    <span
      className="inline-block w-2 h-2 rounded-full mr-2 align-middle"
      style={{ backgroundColor: tone(ok, warn) }}
    />
  );
}

function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`bg-white ${className}`} style={{ border: `0.5px solid ${LINE}` }}>
      {children}
    </div>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div
      className="px-4 pt-4 pb-2 text-[11px] uppercase tracking-[0.14em]"
      style={{ color: MUTED, fontWeight: 600 }}
    >
      {children}
    </div>
  );
}

function StackedBars({
  days,
}: {
  days: DayVolume[];
}) {
  const max = Math.max(1, ...days.map((d) => d.finals + d.updates));
  const w = 560;
  const h = 112;
  const padL = 2;
  const padR = 2;
  const padT = 8;
  const padB = 22;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;
  const gap = 3;
  const bw = (innerW - gap * (days.length - 1)) / days.length;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-[112px]" role="img" aria-label="Posts per day">
      {days.map((d, i) => {
        const x = padL + i * (bw + gap);
        const total = d.finals + d.updates;
        const th = (total / max) * innerH;
        const fh = (d.finals / max) * innerH;
        const uh = th - fh;
        const yBase = padT + innerH;
        const label = new Date(`${d.day}T12:00:00Z`).toLocaleDateString("en-US", {
          month: "numeric",
          day: "numeric",
          timeZone: "UTC",
        });
        const showLabel = i % 2 === 0 || i === days.length - 1;
        return (
          <g key={d.day}>
            <title>{`${d.day}: ${d.finals} Finals, ${d.updates} score updates`}</title>
            {uh > 0 && (
              <rect x={x} y={yBase - th} width={bw} height={uh} fill={PALE} />
            )}
            <rect x={x} y={yBase - fh} width={bw} height={Math.max(fh, total === 0 ? 0 : 1.5)} fill={DEEP} />
            {showLabel && (
              <text
                x={x + bw / 2}
                y={h - 6}
                textAnchor="middle"
                fill={MUTED}
                fontSize="9"
                fontFamily="var(--v2-ui-font), system-ui, sans-serif"
              >
                {label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function CronPulse({ runs }: { runs: CronRun[] }) {
  if (runs.length === 0) {
    return <div className="px-4 pb-4 text-sm" style={{ color: MUTED }}>No cron history.</div>;
  }
  const w = 560;
  const h = 112;
  const padT = 8;
  const padB = 8;
  const innerH = h - padT - padB;
  const maxMs = Math.max(400, ...runs.map((r) => r.durationMs));
  const gap = 1.5;
  const bw = (w - gap * (runs.length - 1)) / runs.length;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-[112px]" role="img" aria-label="Cron run durations">
      {runs.map((r, i) => {
        const x = i * (bw + gap);
        const bh = Math.max(3, (r.durationMs / maxMs) * innerH);
        const y = padT + innerH - bh;
        const when = new Date(r.at * 1000).toLocaleString("en-US", {
          timeZone: "America/Los_Angeles",
          hour: "numeric",
          minute: "2-digit",
        });
        return (
          <g key={`${r.at}-${i}`}>
            <title>{`${when} PT · ${Math.round(r.durationMs)}ms · ${r.ok ? "OK" : r.statusText || "fail"}${r.httpStatus ? ` (${r.httpStatus})` : ""}`}</title>
            <rect x={x} y={y} width={bw} height={bh} fill={r.ok ? BLUE : RED} />
          </g>
        );
      })}
    </svg>
  );
}

function Meter({
  label,
  rate,
  detail,
  ok,
  warn,
}: {
  label: string;
  rate: number | null;
  detail: string;
  ok: boolean;
  warn?: boolean;
}) {
  const pct = rate == null ? 0 : Math.max(0, Math.min(100, rate * 100));
  const fill = rate == null ? LINE : tone(ok, warn);
  return (
    <div className="px-4 py-3">
      <div className="flex items-baseline justify-between gap-3 mb-2">
        <span className="text-[11px] uppercase tracking-[0.14em]" style={{ color: MUTED, fontWeight: 600 }}>
          {label}
        </span>
        <span className="text-sm tabular-nums font-semibold" style={{ color: fill === LINE ? MUTED : fill }}>
          {rate == null ? "idle" : `${pct.toFixed(1)}%`}
        </span>
      </div>
      <div className="h-2 w-full" style={{ backgroundColor: LINE }}>
        <div className="h-full" style={{ width: `${rate == null ? 0 : pct}%`, backgroundColor: fill }} />
      </div>
      <div className="mt-1.5 text-[12px] tabular-nums" style={{ color: MUTED }}>
        {detail}
      </div>
    </div>
  );
}

type Stat = {
  label: string;
  value: string;
  ok: boolean;
  warn?: boolean;
  sub?: string;
};

export default function OpsDashboard({
  now,
  pipeline,
  staticData,
  stats,
  stuckFinals,
  pendingFinals,
  unpostedFinals,
  cronJobs,
  botCron,
  volume,
  posts,
  apiHour,
  apiDay,
  overall,
}: {
  now: number;
  pipeline: PipelineHealth;
  staticData: StaticFreshness;
  stats: Stat[];
  stuckFinals: UnpostedFinal[];
  pendingFinals: UnpostedFinal[];
  unpostedFinals: UnpostedFinal[];
  cronJobs: CronJobHealth[];
  botCron: CronJobHealth | undefined;
  volume: DayVolume[];
  posts: RecentPost[];
  apiHour: SupabaseApiHealth;
  apiDay: SupabaseApiHealth;
  overall: { label: string; ok: boolean; warn?: boolean };
}) {
  const stamp = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(now);

  const apiPct = (h: SupabaseApiHealth) =>
    !h.available ? "no token" : h.successRate === null ? "idle" : `${(h.successRate * 100).toFixed(1)}%`;

  return (
    <div className="min-h-screen flex flex-col" style={{ ...ui, backgroundColor: "#f2f2f2" }}>
      <header className="max-w-[1150px] mx-auto w-full px-3 sm:px-4 pt-8 sm:pt-10 pb-5 text-center">
        <Link href="/" className="inline-flex flex-col sm:flex-row items-center justify-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo3.svg" alt="" className="h-14 w-14 sm:h-16 sm:w-16 object-contain" />
          <span
            className="text-[36px] sm:text-[44px] tracking-tight leading-tight px-1"
            style={{ ...titleFont, WebkitTextStroke: `0.4px ${INK}` }}
          >
            Ops
          </span>
        </Link>
        <div className="mt-3 text-[16px] sm:text-[17px] leading-snug" style={{ color: INK }}>
          <StatusDot ok={overall.ok} warn={overall.warn} />
          <span className="font-bold" style={{ color: tone(overall.ok, overall.warn) }}>
            {overall.label}
          </span>
          <span style={{ color: MUTED }}> · {stamp} PT</span>
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[15px] sm:text-[16px]">
          <span>
            <span style={{ color: INK }}>Games: </span>
            <span className="font-bold tabular-nums">{pipeline.totalGames.toLocaleString()}</span>
          </span>
          <span>
            <span style={{ color: NAVY }}>Unique scores: </span>
            <span className="font-bold tabular-nums">{pipeline.uniqueScores.toLocaleString()}</span>
          </span>
          <span>
            <span style={{ color: DEEP }}>Posts 7d: </span>
            <span className="font-bold tabular-nums">{pipeline.postsLast7d.toLocaleString()}</span>
          </span>
        </div>
      </header>

      <main className="flex-1 max-w-[1150px] mx-auto w-full px-3 sm:px-4 pb-12 space-y-5">
        <div
          className="grid grid-cols-2 md:grid-cols-3"
          style={{ gap: "0.5px", backgroundColor: LINE, border: `0.5px solid ${LINE}` }}
        >
          {stats.map((s) => (
            <div key={s.label} className="bg-white p-4 sm:p-5">
              <div className="text-[11px] uppercase tracking-[0.14em] mb-1.5" style={{ color: MUTED, fontWeight: 600 }}>
                {s.label}
              </div>
              <div className="text-[17px] sm:text-[18px] font-semibold tabular-nums" style={{ color: INK }}>
                <StatusDot ok={s.ok} warn={s.warn} />
                {s.value}
              </div>
              {s.sub && (
                <div className="mt-1 text-[13px] tabular-nums" style={{ color: MUTED }}>
                  {s.sub}
                </div>
              )}
            </div>
          ))}
        </div>

        {unpostedFinals.length > 0 && (
          <Card>
            <SectionLabel>
              {stuckFinals.length > 0 ? "Stuck Finals" : "Just finished"}
            </SectionLabel>
            <div className="divide-y divide-[#d9dee7]">
              {unpostedFinals.map((f) => {
                const stuck = f.minutesSinceFinal === null || f.minutesSinceFinal >= 15;
                const away = f.awayScore ?? 0;
                const home = f.homeScore ?? 0;
                const winnerFirst =
                  f.awayScore == null || f.homeScore == null
                    ? `${f.away} @ ${f.home}`
                    : away >= home
                      ? `${f.away} ${away} - ${home} ${f.home}`
                      : `${f.home} ${home} - ${away} ${f.away}`;
                return (
                  <div key={f.gamePk} className="px-4 py-3 flex flex-wrap items-baseline justify-between gap-2">
                    <div className="text-[15px] font-semibold">
                      <StatusDot ok={false} warn={!stuck} />
                      {winnerFirst}
                    </div>
                    <div className="text-[13px] tabular-nums" style={{ color: MUTED }}>
                      {f.minutesSinceFinal === null ? "end time unknown" : `${f.minutesSinceFinal}m ago`}
                      {" · "}
                      <a
                        href={`https://www.mlb.com/gameday/${f.gamePk}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline underline-offset-2"
                        style={{ color: BLUE }}
                      >
                        Gameday
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
            {pendingFinals.length > 0 && stuckFinals.length === 0 && (
              <div className="px-4 pb-4 text-[13px]" style={{ color: MUTED }}>
                Under 15 minutes. The next cron tick should catch these.
              </div>
            )}
          </Card>
        )}

        <div className="grid md:grid-cols-2 gap-5">
          <Card>
            <SectionLabel>Bot trigger · last {botCron?.runs.length ?? 0} runs</SectionLabel>
            <div className="px-4 pb-1 text-[13px]" style={{ color: MUTED }}>
              Height is duration. Blue is OK, rust is a failed tick.
            </div>
            <div className="px-3 pb-4">
              <CronPulse runs={botCron?.runs ?? []} />
            </div>
          </Card>
          <Card>
            <SectionLabel>Posts · last 14 days PT</SectionLabel>
            <div className="px-4 pb-1 text-[13px]" style={{ color: MUTED }}>
              Navy is Finals. Pale blue is Score Updates.
            </div>
            <div className="px-3 pb-4">
              <StackedBars days={volume} />
            </div>
          </Card>
        </div>

        <div className="grid md:grid-cols-2 gap-5">
          <Card>
            <SectionLabel>Supabase REST</SectionLabel>
            <Meter
              label="Last 60 minutes"
              rate={apiHour.available ? apiHour.successRate : null}
              detail={
                !apiHour.available
                  ? "set SUPABASE_ACCESS_TOKEN"
                  : `${apiHour.total.toLocaleString()} req · ${apiHour.errors} 5xx`
              }
              ok={!apiHour.available || apiHour.successRate === null || apiHour.successRate >= 0.99}
              warn={
                apiHour.available &&
                apiHour.successRate !== null &&
                apiHour.successRate >= 0.95 &&
                apiHour.successRate < 0.99
              }
            />
            <div style={{ borderTop: `0.5px solid ${LINE}` }}>
              <Meter
                label="Last 24 hours"
                rate={apiDay.available ? apiDay.successRate : null}
                detail={
                  !apiDay.available
                    ? apiPct(apiDay)
                    : `${apiDay.total.toLocaleString()} req · ${apiDay.errors} 5xx`
                }
                ok={!apiDay.available || apiDay.successRate === null || apiDay.successRate >= 0.99}
                warn={
                  apiDay.available &&
                  apiDay.successRate !== null &&
                  apiDay.successRate >= 0.95 &&
                  apiDay.successRate < 0.99
                }
              />
            </div>
          </Card>
          <Card>
            <SectionLabel>Cron jobs</SectionLabel>
            <div className="divide-y divide-[#d9dee7]">
              {cronJobs.map((j) => (
                <div key={j.id} className="px-4 py-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <div className="text-[15px] font-semibold">
                      <StatusDot
                        ok={j.enabled && (j.successRate == null || j.successRate >= 0.96)}
                        warn={j.enabled && j.successRate != null && j.successRate >= 0.9 && j.successRate < 0.96}
                      />
                      {j.title}
                    </div>
                    <div className="text-[12px] uppercase tracking-wider" style={{ color: j.enabled ? GREEN : MUTED }}>
                      {j.enabled ? "on" : "off"}
                    </div>
                  </div>
                  <div className="mt-1 text-[13px] tabular-nums" style={{ color: MUTED }}>
                    {j.lastRun ? relTime(new Date(j.lastRun * 1000).toISOString(), now) : "never"}
                    {j.lastStatusText ? ` · ${j.lastStatusText}` : ""}
                    {j.lastHttpStatus ? ` ${j.lastHttpStatus}` : ""}
                    {j.successRate != null ? ` · ${(j.successRate * 100).toFixed(0)}% of last ${j.runs.length || 50}` : ""}
                    {j.avgDurationMs != null ? ` · ${Math.round(j.avgDurationMs)}ms avg` : ""}
                  </div>
                </div>
              ))}
              {cronJobs.length === 0 && (
                <div className="px-4 py-4 text-sm" style={{ color: MUTED }}>
                  cron-job.org unreachable or CRONJOB_API_KEY missing
                </div>
              )}
            </div>
          </Card>
        </div>

        <Card>
          <SectionLabel>Recent posts</SectionLabel>
          <div className="divide-y divide-[#d9dee7]">
            {posts.map((p) => {
              const isFinal = p.post_type === "Final";
              return (
                <div
                  key={`${p.game_id}-${p.created_at}`}
                  className="px-4 py-2.5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1"
                >
                  <div className="flex items-baseline gap-3 min-w-0">
                    <span
                      className="text-[11px] uppercase tracking-[0.12em] font-semibold shrink-0"
                      style={{ color: isFinal ? NAVY : MUTED }}
                    >
                      {isFinal ? "Final" : "Update"}
                    </span>
                    <span className="text-[15px] font-semibold tabular-nums">{p.score_snapshot ?? "—"}</span>
                    <span className="text-[13px] truncate" style={{ color: MUTED }}>
                      {p.details ?? ""}
                    </span>
                  </div>
                  <div className="text-[13px] tabular-nums" style={{ color: MUTED }}>
                    {relTime(p.created_at, now)}
                    {p.tweet_id ? (
                      <>
                        {" · "}
                        <a
                          href={`https://x.com/MLBgami/status/${p.tweet_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline underline-offset-2"
                          style={{ color: BLUE }}
                        >
                          Tweet
                        </a>
                      </>
                    ) : (
                      " · dry run"
                    )}
                  </div>
                </div>
              );
            })}
            {posts.length === 0 && (
              <div className="px-4 py-4 text-sm" style={{ color: MUTED }}>
                No posts recorded.
              </div>
            )}
          </div>
        </Card>

        {staticData.error && (
          <div className="text-center text-[13px]" style={{ color: RED }}>
            Static dump unreachable at {staticData.checkedUrl}
          </div>
        )}
      </main>
      <footer className="text-center pb-10 text-[13px]" style={{ color: MUTED }}>
        <Link href="/" className="underline underline-offset-2" style={{ color: BLUE }}>
          Back to the grid
        </Link>
      </footer>
    </div>
  );
}
