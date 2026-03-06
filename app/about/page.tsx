import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "How It Works",
  description:
    "What is Scorigami? Learn what gets posted after every MLB game and why. Scorigami, Franchisigami, and Playoffigami explained.",
};

export default function AboutPage() {
  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-[#1e1e1e]">
      <div className="px-4 pt-4">
        <Link href="/" className="text-sm text-slate-400 dark:text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
          ← Back to heatmap
        </Link>
      </div>

      <div className="flex-1 flex items-center justify-center">
        <div className="max-w-lg w-full mx-auto px-4 py-6 space-y-4 text-slate-700 dark:text-slate-300 leading-normal">
          <div className="flex items-center gap-3">
            <Image
              src="/logo3.svg"
              alt="MLB Scorigami"
              width={36}
              height={48}
              priority
              style={{ width: "auto" }}
              className="h-10 w-auto flex-shrink-0 dark:invert"
            />
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Welcome to MLB Scorigami!
            </h2>
          </div>

          <div className="space-y-1">
            <h3 className="font-semibold text-slate-900 dark:text-slate-100">What is a Scorigami?</h3>
            <p>
              A Scorigami is a final score that has never happened before in MLB history. Jon Bois invented the concept for the NFL and we track it for baseball. In over 150 years of MLB, only 358 unique final scores have ever occurred. In the modern era alone, that number is 289, with just 11 new scores since 2000.
            </p>
          </div>

          <div className="space-y-1">
            <h3 className="font-semibold text-slate-900 dark:text-slate-100">Why start at 1901?</h3>
            <p>
              1901 is when the modern era of baseball began. Pre-1900 baseball had different rules and a completely different run environment, so those scores don&apos;t count against a Scorigami. The 1871-1900 data is still on the site to explore.
            </p>
          </div>

          <div className="space-y-1">
            <h3 className="font-semibold text-slate-900 dark:text-slate-100">What else do we track?</h3>
            <p>
              Because true Scorigamis are so rare, we also track Franchisigami (a score that&apos;s never happened for a specific team) and Playoffigami (a score that&apos;s never appeared in a playoff game). Every regular season and playoff game gets a post.
            </p>
          </div>

          <div className="space-y-1">
            <h3 className="font-semibold text-slate-900 dark:text-slate-100">Where can I explore the data?</h3>
            <p>
              Explore the full heatmap of every score in MLB history at{" "}
              <a href="https://mlbscorigami.com" className="text-blue-600 dark:text-blue-400 hover:underline font-medium">
                mlbscorigami.com
              </a>
              .
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
