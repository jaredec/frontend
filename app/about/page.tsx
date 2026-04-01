import type { Metadata } from "next";
import Link from "next/link";
import NavBar from "@/components/nav-bar";

export const metadata: Metadata = {
  title: "About",
  description:
    "What is MLB Scorigami? Learn about the project, the heatmap, the @MLBgami bot, and how data is sourced going back to 1871.",
};

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#1e1e1e] flex flex-col">
      <NavBar />
      <div className="flex-1 max-w-5xl mx-auto w-full px-4 py-12 space-y-10">

        <div className="space-y-1.5">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">What is Scorigami?</h2>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed">
            A scorigami is a final score that has never happened before. The concept was originally created by Jon Bois for the NFL. We made one for baseball. In over 155 years of games, only 358 unique final scores have ever occurred.
          </p>
        </div>

        <div className="space-y-1.5">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">The Heatmap</h2>
          <div className="space-y-2 text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed">
            <p>
              Every cell in the grid represents a possible final score, with winning score on one axis and losing score
              on the other. Empty cells are scores that have never happened. Filled cells are colored by frequency:
              the deeper the color, the more often that score has occurred. Click any cell to see the count,
              the last time it happened, and a link to that game&apos;s box score.
            </p>
            <p>
              Use the team filter to view the grid for a specific franchise.
              The year slider isolates any era or range of seasons.
              The game type filter narrows to regular season, postseason, or a specific playoff round.
            </p>
          </div>
        </div>

        <div className="space-y-1.5">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">The Archive</h2>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed">
            The <Link href="/history" className="underline underline-offset-2 decoration-slate-400 dark:decoration-slate-500 hover:text-slate-900 dark:hover:text-slate-100 transition-colors">Archive</Link> logs
            every unique score in MLB history: when it first occurred, the teams involved, and total occurrences since.
            Filter by Rarigami to see every game played with a rare score, or by Playoffigami to browse postseason firsts.
          </p>
        </div>

        <div className="space-y-1.5">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">Data & Coverage</h2>
          <div className="space-y-2 text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed">
            <p>
              We consider 1871 the start of Major League Baseball. That year saw the founding of the National Association, the first professional baseball league. The game has changed enormously since then, and so has the recordkeeping. Early box scores were kept by hand and preserved imperfectly; what exists today is the result of decades of historical research, much of it done by volunteers.
            </p>
            <p>
              Historical data is sourced from <a href="https://www.retrosheet.org" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 decoration-slate-400 dark:decoration-slate-500 hover:text-slate-900 dark:hover:text-slate-100 transition-colors">Retrosheet</a>,
              a nonprofit that has digitized an extraordinary amount of baseball history. Modern results are updated
              daily via the MLB Stats API. The database covers all recognized major leagues: the National Association (1871–75),
              National League (1876–present), American Association (1882–91), Union Association (1884), Players&apos; League (1890),
              American League (1901–present), and Federal League (1914–15).
            </p>
            <p>
              Negro League games are excluded from scorigami calculations. MLB officially incorporated Negro League statistics
              into its historical record in 2024, but the integration of game-level results is still evolving.
              We&apos;d rather exclude them cleanly than include them incompletely.
            </p>
          </div>
        </div>

        <div className="space-y-1.5">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">@MLBgami on X</h2>
          <div className="space-y-2 text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed">
            <p>
              <a href="https://x.com/MLBgami" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 decoration-slate-400 dark:decoration-slate-500 hover:text-slate-900 dark:hover:text-slate-100 transition-colors">@MLBgami</a> posts
              automatically after every MLB game, noting what (if anything) makes that final score notable.
              Posts are checked in priority order:
            </p>
            <ul className="list-disc list-outside ml-4 space-y-1 text-sm sm:text-base">
              <li>Scorigami: never happened before.</li>
              <li>Playoffigami: never happened in a playoff game.</li>
              <li>Franchisigami: a franchise has never played this exact score before.</li>
              <li>Rarigami: fewer than 100 occurrences all time.</li>
              <li>No scorigami: the score is common. The post reports how many times it has occurred and when it last happened.</li>
            </ul>
          </div>
        </div>

        <div className="pt-2 border-t border-slate-200 dark:border-[#2d2d30] flex items-center gap-6">
          <Link href="/" className="text-sm text-slate-500 dark:text-slate-400 underline underline-offset-2 decoration-slate-300 dark:decoration-slate-600 hover:text-slate-800 dark:hover:text-slate-100 transition-colors">
            Explore the heatmap
          </Link>
          <Link href="/history" className="text-sm text-slate-500 dark:text-slate-400 underline underline-offset-2 decoration-slate-300 dark:decoration-slate-600 hover:text-slate-800 dark:hover:text-slate-100 transition-colors">
            Browse the Archive
          </Link>
          <a href="https://x.com/MLBgami" target="_blank" rel="noopener noreferrer" className="text-sm text-slate-500 dark:text-slate-400 underline underline-offset-2 decoration-slate-300 dark:decoration-slate-600 hover:text-slate-800 dark:hover:text-slate-100 transition-colors">
            Follow @MLBgami
          </a>
        </div>

      </div>
    </div>
  );
}
