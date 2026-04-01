"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavBarProps {
  totalGames?: number;
  uniqueScores?: number;
}

export default function NavBar({ totalGames, uniqueScores }: NavBarProps) {
  const hasStats = totalGames !== undefined && uniqueScores !== undefined;
  const pathname = usePathname();

  const navLink = (href: string, label: string) => {
    const active = pathname === href;
    return (
      <Link
        href={href}
        className={`text-xs sm:text-sm font-medium transition-colors ${
          active
            ? "text-slate-900 dark:text-slate-100"
            : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100"
        }`}
      >
        {label}
      </Link>
    );
  };

  return (
    <header className="border-b border-slate-200/60 dark:border-[#2d2d30] py-3">
      <div className="max-w-5xl mx-auto w-full px-4">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 sm:gap-3">
            <Image
              src="/logo3.svg"
              alt="MLB Scorigami"
              width={36}
              height={48}
              priority
              style={{ width: "auto" }}
              className="h-7 sm:h-10 w-auto flex-shrink-0 dark:invert"
            />
            <span className="text-base sm:text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
              MLB Scorigami
            </span>
          </Link>

          <div className="flex items-center gap-3">
            {hasStats && (
              <div className="hidden sm:flex items-center gap-1.5 text-sm text-slate-400 dark:text-slate-500">
                <span className="tabular-nums text-slate-600 dark:text-slate-300">{totalGames!.toLocaleString()}</span>
                <span>games</span>
                <span className="text-slate-300 dark:text-[#3e3e42]">·</span>
                <span className="tabular-nums text-slate-600 dark:text-slate-300">{uniqueScores!.toLocaleString()}</span>
                <span>scores</span>
              </div>
            )}
            {hasStats && <div className="hidden sm:block w-px h-4 bg-slate-200 dark:bg-[#3e3e42]" />}
            {navLink("/history", "Archive")}
            <span className="text-slate-300 dark:text-[#3e3e42]">·</span>
            {navLink("/about", "About")}
          </div>
        </div>
      </div>
    </header>
  );
}
