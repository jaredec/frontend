"use client";

import Image from "next/image";
import Link from "next/link";
import { CircleHelp } from "lucide-react";

export default function TopBar() {
  return (
    <header className="border-b border-slate-200/60 dark:border-[#2d2d30] py-4">
      <div className="max-w-5xl mx-auto w-full px-4 flex items-center justify-between">
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
        <Link
          href="/about"
          aria-label="How it works"
          className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
        >
          <CircleHelp className="w-5 h-5" />
        </Link>
      </div>
    </header>
  );
}
