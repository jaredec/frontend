"use client";

import { useState } from "react";
import { ArrowUpRight, ChevronLeft, ChevronRight } from "lucide-react";
import type { ArchiveRow } from "./page";

function formatDate(raw: string): string {
  const d = new Date(raw);
  return d.toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const SHORT_NAME_MAP: Record<string, string> = {
  "Arizona Diamondbacks": "D-backs",
  "Boston Red Sox": "Red Sox",
  "Chicago White Sox": "White Sox",
  "Toronto Blue Jays": "Blue Jays",
  "Worcester Ruby Legs": "Ruby Legs",
  "Boston Red Stockings": "Red Stockings",
  "St. Louis Brown Stockings": "Brown Stockings",
  "Philadelphia White Stockings": "White Stockings",
  "Cincinnati Red Stockings": "Red Stockings",
  "Chicago White Stockings": "White Stockings",
};

function shortName(name: string): string {
  if (SHORT_NAME_MAP[name]) return SHORT_NAME_MAP[name];
  const words = name.trim().split(" ");
  return words[words.length - 1];
}

export default function ArchiveTable({
  rows: initialRows,
  total: initialTotal,
  currentPage: initialPage,
  totalPages: initialTotalPages,
}: {
  rows: ArchiveRow[];
  total: number;
  currentPage: number;
  totalPages: number;
}) {
  const [rows, setRows] = useState<ArchiveRow[]>(initialRows);
  const [total, setTotal] = useState(initialTotal);
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [totalPages, setTotalPages] = useState(initialTotalPages);
  const [isLoading, setIsLoading] = useState(false);

  async function fetchData(p: number) {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p) });
      const res = await fetch(`/api/archive?${params}`);
      const data = await res.json();
      setRows(data.rows);
      setTotal(data.total);
      setTotalPages(data.totalPages);
      setCurrentPage(p);
      const url = p === 1 ? "/archive" : `/archive?page=${p}`;
      window.history.pushState({}, "", url);
    } finally {
      setIsLoading(false);
    }
  }

  function goToPage(p: number) {
    window.scrollTo({ top: 0, behavior: "smooth" });
    fetchData(p);
  }

  return (
    <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-8 space-y-4">
      {/* Title + count row */}
      <div className="flex items-end justify-between">
        <h1 className="text-[9px] sm:text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Scorigami Archive
        </h1>
        <span className="text-xs text-slate-400 dark:text-slate-500 tabular-nums">
          {total.toLocaleString()} score{total !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-slate-200 dark:border-[#2d2d30] relative">
        {isLoading && (
          <div className="absolute top-0 left-0 right-0 h-[2px] overflow-hidden z-50">
            <div className="h-full w-full bg-gradient-to-r from-transparent via-blue-500/40 to-transparent animate-shimmer" />
          </div>
        )}
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-slate-200 dark:border-[#2d2d30] bg-slate-100/70 dark:bg-[#252526]">
              <th className="px-1.5 sm:px-4 py-3 text-left font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[9px] sm:text-xs whitespace-nowrap">Date</th>
              <th className="px-1.5 sm:px-4 py-3 text-left font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[9px] sm:text-xs whitespace-nowrap">Score</th>
              <th className="px-1.5 sm:px-4 py-3 text-left font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[9px] sm:text-xs whitespace-nowrap">Teams</th>
              <th className="px-1.5 sm:px-4 py-3 text-right font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[9px] sm:text-xs whitespace-nowrap">Times</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-[#2d2d30]">
            {rows.map((row, i) => {
              const visitorWon = row.visitor_score > row.home_score;
              const winner = visitorWon ? row.visitor_team : row.home_team;
              const loser = visitorWon ? row.home_team : row.visitor_team;
              const occurrences = Number(row.occurrences);
              const boxScoreUrl =
                row.game_id && row.source === "mlb_api"
                  ? `https://www.mlb.com/gameday/${row.game_id}`
                  : null;

              const rowContent = (
                <>
                  <td className="px-1.5 sm:px-4 py-2 sm:py-2.5 text-[9px] sm:text-sm text-slate-500 dark:text-slate-400 tabular-nums whitespace-nowrap">
                    {formatDate(row.date)}
                  </td>
                  <td className="px-1.5 sm:px-4 py-2 sm:py-2.5 text-[9px] sm:text-sm text-slate-900 dark:text-slate-100 font-medium tabular-nums whitespace-nowrap">
                    {row.win}–{row.lose}
                  </td>
                  <td className="px-1.5 sm:px-4 py-2 sm:py-2.5 text-[9px] sm:text-sm text-slate-500 dark:text-slate-400 whitespace-nowrap">
                    <span className="sm:hidden">{shortName(winner)} vs. {shortName(loser)}</span>
                    <span className="hidden sm:inline">{winner} vs. {loser}</span>
                    {boxScoreUrl && (
                      <ArrowUpRight className="inline-block ml-0.5 sm:ml-1 w-2.5 h-2.5 sm:w-3 sm:h-3 text-slate-300 dark:text-slate-600 flex-shrink-0" />
                    )}
                  </td>
                  <td className="px-1.5 sm:px-4 py-2 sm:py-2.5 text-[9px] sm:text-sm text-right tabular-nums text-slate-500 dark:text-slate-400 whitespace-nowrap">
                    {occurrences.toLocaleString()}
                  </td>
                </>
              );

              if (boxScoreUrl) {
                return (
                  <tr
                    key={i}
                    onClick={() => window.open(boxScoreUrl, "_blank")}
                    className="hover:bg-slate-50 dark:hover:bg-[#252526] transition-colors cursor-pointer"
                  >
                    {rowContent}
                  </tr>
                );
              }

              return (
                <tr key={i} className="hover:bg-slate-50 dark:hover:bg-[#252526] transition-colors">
                  {rowContent}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage === 1 || isLoading}
            className="p-1.5 rounded text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            aria-label="Previous page"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm text-slate-500 dark:text-slate-400 tabular-nums">
            {currentPage} / {totalPages}
          </span>
          <button
            onClick={() => goToPage(currentPage + 1)}
            disabled={currentPage === totalPages || isLoading}
            className="p-1.5 rounded text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            aria-label="Next page"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </main>
  );
}
