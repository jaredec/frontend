"use client";

import Image from "next/image";

interface TopBarProps {
  totalGamesDisplayed: number;
  isLoading: boolean;
}

export default function TopBar({ totalGamesDisplayed, isLoading }: TopBarProps) {
  return (
    <header className="border-b border-slate-200/60 dark:border-[#2c2c2c] py-4">
      <div className="container mx-auto px-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Image
            src="/logo3.svg"
            alt="MLB Scorigami"
            width={36}
            height={48}
            priority
            style={{ width: 'auto' }}
            className="h-10 w-auto flex-shrink-0"
          />
          <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            MLB Scorigami
          </h1>
        </div>
        <div className="text-sm text-slate-500 dark:text-slate-400">
          {isLoading ? (
            <span className="text-slate-400 dark:text-slate-500">Loading...</span>
          ) : totalGamesDisplayed > 0 ? (
            <span>
              <span className="font-medium text-slate-700 dark:text-slate-300">
                {totalGamesDisplayed.toLocaleString()}
              </span>{" "}
              games
            </span>
          ) : null}
        </div>
      </div>
    </header>
  );
}
