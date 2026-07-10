import type { ReactNode } from "react";

const XLogoIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 1200 1227" xmlns="http://www.w3.org/2000/svg" className={className} fill="currentColor" aria-hidden="true">
    <path d="M714.163 519.284L1160.89 0H1055.03L667.137 450.887L357.328 0H0L468.492 681.821L0 1226.37H105.866L515.491 750.218L842.672 1226.37H1200L714.163 519.284ZM569.165 687.828L521.697 619.934L144.011 79.6944H306.615L611.412 515.685L658.88 583.579L1055.08 1150.3H892.476L569.165 687.828Z" />
  </svg>
);

interface Section {
  id: string;
  title: string;
  body: ReactNode;
}

const sections: Section[] = [
  {
    id: "what",
    title: "What is scorigami?",
    body: (
      <p>
        A scorigami is a final score that has never happened before. Jon Bois invented the concept for the NFL. We made one for baseball. In 155+ years, only 358 unique final scores have ever occurred.
      </p>
    ),
  },
  {
    id: "heatmap",
    title: "The heatmap",
    body: (
      <>
        <p>
          Each cell is a possible final score: winner on one axis, loser on the other. Empty cells have never happened. Tap any cell for the count, the most recent occurrence, and a link to that game&apos;s box score. Filter by team, era, or game type.
        </p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/mlb-scorigami-heatmap.png"
          alt="MLB Scorigami heatmap: every final score in MLB history since 1871, common scores in dark blue, rare scores in light blue, never-seen scores in gray"
          width={1200}
          height={630}
          loading="lazy"
          className="w-full h-auto rounded-md border border-slate-200 dark:border-[#3e3e42]"
        />
      </>
    ),
  },
  {
    id: "archive",
    title: "The archive",
    body: (
      <p>
        Every unique score in MLB history: when it first happened, who played it, and how many times it&apos;s happened since.
      </p>
    ),
  },
  {
    id: "data",
    title: "Data & coverage",
    body: (
      <>
        <p>
          We consider 1871 the start of Major League Baseball. The game has changed a lot since then, and so has the recordkeeping. Early box scores were kept by hand and preserved imperfectly; what exists today is the result of decades of historical research, much of it done by volunteers.
        </p>
        <p>
          Historical data comes from{" "}
          <a
            href="https://www.retrosheet.org"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 decoration-slate-400 dark:decoration-slate-500 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
          >
            Retrosheet
          </a>
          . Modern results update daily via the MLB Stats API. Coverage includes every recognized major league: NA (1871–75), NL (1876–), AA (1882–91), UA (1884), PL (1890), AL (1901–), and FL (1914–15).
        </p>
        <p>
          Negro League games are currently excluded. MLB incorporated Negro League statistics into its official record in 2024, but game-level integration is still evolving. We&apos;d rather exclude them cleanly than include them incompletely.
        </p>
      </>
    ),
  },
  {
    id: "bot",
    title: "@MLBgami on X",
    body: (
      <>
        <a
          href="https://x.com/MLBgami"
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-center gap-3 rounded-lg border border-slate-200 dark:border-[#3e3e42] bg-slate-50 dark:bg-[#2d2d30] px-4 py-3 transition-colors hover:border-slate-300 dark:hover:border-slate-500"
        >
          <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-white dark:bg-[#1e1e1e]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo3.svg" alt="" className="h-6 w-auto dark:invert" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-slate-900 dark:text-slate-100">MLB Scorigami</span>
            <span className="block text-xs text-slate-500 dark:text-slate-400 truncate">@MLBgami</span>
          </span>
          <XLogoIcon className="h-4 w-4 flex-none text-slate-400 transition-colors group-hover:text-slate-700 dark:group-hover:text-slate-200" />
        </a>
        <p>
          The bot posts after every MLB game, checked in priority order:
        </p>
        <ul className="space-y-2 pt-1">
          <li><span className="font-semibold text-slate-900 dark:text-slate-100">Scorigami:</span> never happened before, ever.</li>
          <li><span className="font-semibold text-slate-900 dark:text-slate-100">Playoffigami:</span> never happened in a playoff game.</li>
          <li><span className="font-semibold text-slate-900 dark:text-slate-100">Modern Era Scorigami:</span> never happened in the modern era (since 1901).</li>
          <li><span className="font-semibold text-slate-900 dark:text-slate-100">Franchisigami:</span> never happened before for at least one of the two teams.</li>
          <li><span className="font-semibold text-slate-900 dark:text-slate-100">Rarigami:</span> happened fewer than 100 times ever.</li>
          <li><span className="font-semibold text-slate-900 dark:text-slate-100">No scorigami:</span> a common score; the post reports how many times it&apos;s happened and the most recent occurrence.</li>
        </ul>
      </>
    ),
  },
];

export default function AboutContent() {
  return (
    <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-8">
      <h1 className="text-[9px] sm:text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 pb-2">
        About
      </h1>

      <div className="rounded-lg border border-slate-200 dark:border-[#2d2d30] bg-white dark:bg-[#252526] px-5 py-2 sm:px-8 sm:py-3">
        <div className="divide-y divide-slate-100 dark:divide-[#2d2d30] text-sm sm:text-[15px] text-slate-600 dark:text-slate-300 leading-relaxed">
          {sections.map((s) => (
            <section key={s.id} className="py-6">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-3">
                {s.title}
              </h2>
              <div className="space-y-3">{s.body}</div>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
