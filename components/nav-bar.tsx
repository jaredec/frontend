"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

interface NavBarProps {
  totalGames?: number;
  uniqueScores?: number;
}

const MENU_ITEMS = [
  { href: "/archive", label: "Archive" },
  { href: "/about", label: "About" },
];

export default function NavBar({ totalGames, uniqueScores }: NavBarProps) {
  const hasStats = totalGames !== undefined && uniqueScores !== undefined;
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

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

            <div ref={menuRef} className="relative">
              <button
                type="button"
                aria-label="Open menu"
                aria-expanded={open}
                aria-haspopup="menu"
                onClick={() => setOpen((v) => !v)}
                className="p-1.5 rounded text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-[#2d2d30] transition-colors"
              >
                <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor" aria-hidden="true">
                  <circle cx="3" cy="3" r="1.5" />
                  <circle cx="9" cy="3" r="1.5" />
                  <circle cx="15" cy="3" r="1.5" />
                  <circle cx="3" cy="9" r="1.5" />
                  <circle cx="9" cy="9" r="1.5" />
                  <circle cx="15" cy="9" r="1.5" />
                  <circle cx="3" cy="15" r="1.5" />
                  <circle cx="9" cy="15" r="1.5" />
                  <circle cx="15" cy="15" r="1.5" />
                </svg>
              </button>

              {open && (
                <div
                  role="menu"
                  className="absolute right-0 mt-2 w-40 rounded-md border border-slate-200 dark:border-[#3e3e42] bg-white dark:bg-[#252526] shadow-lg py-1 z-50"
                >
                  {MENU_ITEMS.map((item) => {
                    const active = pathname === item.href;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        role="menuitem"
                        className={`block px-3 py-2 text-sm transition-colors ${
                          active
                            ? "text-slate-900 dark:text-slate-100 bg-slate-50 dark:bg-[#2d2d30]"
                            : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#2d2d30] hover:text-slate-900 dark:hover:text-slate-100"
                        }`}
                      >
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
