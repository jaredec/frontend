import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "How It Works",
  description:
    "What is MLB Scorigami? Learn how to use the heatmap and explore every final score in baseball history.",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
        {title}
      </h2>
      <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed">
        {children}
      </p>
    </div>
  );
}

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#1e1e1e] flex flex-col">
      <div className="flex-1 flex items-start justify-center px-6 py-10">
        <div className="w-full max-w-xl space-y-8">

          {/* Header */}
          <div className="flex items-center gap-4 pb-2 border-b border-slate-200 dark:border-[#2d2d30]">
            <Image
              src="/logo3.svg"
              alt="MLB Scorigami"
              width={36}
              height={48}
              priority
              style={{ width: "auto" }}
              className="h-9 w-auto flex-shrink-0 dark:invert"
            />
            <div>
              <h1 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                MLB Scorigami
              </h1>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                How it works
              </p>
            </div>
            <Link
              href="/"
              className="ml-auto inline-flex items-center gap-1.5 text-sm text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back
            </Link>
          </div>

          {/* Sections */}
          <div className="space-y-6">
            <Section title="What is Scorigami?">
              A Scorigami is a final score that has never happened before in MLB history,
              a concept originally created by Jon Bois for the NFL. In over 150 years of
              baseball, only 358 unique final scores have ever occurred.
            </Section>

            <Section title="Reading the heatmap">
              Each cell is a possible final score. One team score on each axis. Cells
              that have never occurred appear empty. The more saturated the color, the
              more times that score has happened. Click any cell to see the count, when
              it last occurred, and a link to that box score.
            </Section>

            <Section title="Filters">
              Use the team dropdown to view a single franchise. The year slider zooms into
              any era and supports a range. The game type filter narrows to regular season,
              postseason, or a specific round.
            </Section>

            <Section title="View options">
              The arrows icon toggles between Home vs. Away and Winning vs. Losing score
              views. The expand icon increases the grid to show higher scoring games.
            </Section>

            <Section title="@MLBgami on X">
              The{" "}
              <a
                href="https://x.com/MLBgami"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 dark:text-blue-400 hover:underline"
              >
                @MLBgami
              </a>{" "}
              page posts after every MLB game, calling out new Scorigamis as they happen.
            </Section>
          </div>

          {/* Footer */}
          <div className="pt-4 border-t border-slate-200 dark:border-[#2d2d30] flex items-center gap-6">
            <Link
              href="/"
              className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
            >
              Explore the heatmap
            </Link>
            <a
              href="https://x.com/MLBgami"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 hover:underline transition-colors"
            >
              Follow on X
            </a>
          </div>

        </div>
      </div>
    </div>
  );
}
