import type { ReactNode } from "react";

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
        <p>
          The{" "}
          <a
            href="https://x.com/MLBgami"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 decoration-slate-400 dark:decoration-slate-500 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
          >
            bot
          </a>{" "}
          posts after every MLB game, checked in priority order:
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
