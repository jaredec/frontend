"use client";

import Image from "next/image";
import Link from "next/link";
import { CircleHelp } from "lucide-react";

interface TopBarProps {
  totalGames?: number;
  uniqueScores?: number;
}

export default function TopBar({ totalGames, uniqueScores }: TopBarProps) {
  const hasStats = totalGames !== undefined && uniqueScores !== undefined;

  return (
    <header className="border-b border-slate-200/60 dark:border-[#2d2d30] py-3">
      <div className="max-w-5xl mx-auto w-full px-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image
              src="/logo3.svg"
              alt="MLB Scorigami"
              width={36}
              height={48}
              priority
              style={{ width: 'auto' }}
              className="h-10 w-auto flex-shrink-0 dark:invert"
            />
            <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
              MLB Scorigami
            </h1>
          </div>

          <div className="flex items-center gap-4">
            {hasStats && (
              <div className="hidden sm:flex items-center gap-1.5 text-sm text-slate-400 dark:text-slate-500">
                <span className="tabular-nums text-slate-600 dark:text-slate-300">{totalGames!.toLocaleString()}</span>
                <span>games</span>
                <span className="text-slate-300 dark:text-[#3e3e42]">·</span>
                <span className="tabular-nums text-slate-600 dark:text-slate-300">{uniqueScores!.toLocaleString()}</span>
                <span>scores</span>
              </div>
            )}
            <Link
              href="/about"
              aria-label="How it works"
              className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
            >
              <CircleHelp className="w-5 h-5" />
            </Link>
          </div>
        </div>

      </div>
    </header>
  );
}
