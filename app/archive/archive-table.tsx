"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowUpRight, ChevronLeft, ChevronRight } from "lucide-react";
import type { ArchiveRow } from "@/lib/archive-queries";

const PAGE_SIZE = 100;

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

// Compact page list: 1 … 4 5 6 … 13. Strings are ellipsis placeholders.
function getPageItems(current: number, total: number): (number | string)[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const items: (number | string)[] = [1];
  const lo = Math.max(2, current - 1);
  const hi = Math.min(total - 1, current + 1);
  if (lo > 2) items.push("gap-l");
  for (let p = lo; p <= hi; p++) items.push(p);
  if (hi < total - 1) items.push("gap-r");
  items.push(total);
  return items;
}

export default function ArchiveTable({
  className = "",
  rows: initialRows,
  total: initialTotal,
  currentPage: initialPage,
  totalPages: initialTotalPages,
}: {
  className?: string;
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
  // Distance from page bottom at click time. Page 4 is shorter than the rest,
  // so when the table height changes we re-pin the scroll to keep the
  // pagination controls exactly where they were under the cursor.
  const pinFromBottomRef = useRef<number | null>(null);

  useLayoutEffect(() => {
    if (pinFromBottomRef.current === null) return;
    const target = document.documentElement.scrollHeight - pinFromBottomRef.current;
    pinFromBottomRef.current = null;
    window.scrollTo({ top: Math.max(0, target), behavior: "instant" });
  }, [rows]);

  const fetchData = useCallback(async (p: number, pushUrl = true) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/archive?page=${p}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setRows(data.rows);
      setTotal(data.total);
      setTotalPages(data.totalPages);
      setCurrentPage(p);
      if (pushUrl) {
        window.history.pushState({}, "", p === 1 ? "/archive" : `/archive?page=${p}`);
      }
    } catch {
      // Fetch failed — keep showing the current page rather than blanking the table.
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Keep the table in sync with browser back/forward.
  useEffect(() => {
    const onPop = () => {
      const params = new URLSearchParams(window.location.search);
      const p = Math.max(1, parseInt(params.get("page") ?? "1", 10) || 1);
      fetchData(p, false);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [fetchData]);

  function goToPage(p: number) {
    if (p < 1 || p > totalPages || p === currentPage || isLoading) return;
    pinFromBottomRef.current =
      document.documentElement.scrollHeight - window.scrollY;
    fetchData(p);
  }

  const rangeStart = (currentPage - 1) * PAGE_SIZE + 1;
  const rangeEnd = rangeStart + rows.length - 1;
  const thisYear = new Date().getFullYear();

  const navBtn =
    "p-1.5 rounded-md text-[var(--ink-3)] hover:text-[var(--ink)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors";

  return (
    <main className={className}>
      <h1 className="sr-only">Scorigami Archive</h1>

      {/* Table */}
      <div className="@container border border-[var(--line)] bg-[var(--surface)] relative overflow-hidden">
        {isLoading && (
          <div className="absolute top-0 left-0 right-0 h-[2px] overflow-hidden z-50">
            <div className="h-full w-full bg-[linear-gradient(90deg,transparent,color-mix(in_srgb,var(--team-accent)_45%,transparent),transparent)] animate-shimmer" />
          </div>
        )}
        <table
          className={`w-full border-collapse transition-opacity duration-150 ${
            isLoading ? "opacity-60" : ""
          }`}
        >
          <thead>
            <tr className="border-b border-[var(--line)]">
              <th className="px-2 sm:px-4 py-3 text-left font-semibold text-[var(--ink-3)] uppercase tracking-wider text-[10px] sm:text-xs whitespace-nowrap">First Scored</th>
              <th className="px-2 sm:px-4 py-3 text-left font-semibold text-[var(--ink-3)] uppercase tracking-wider text-[10px] sm:text-xs whitespace-nowrap">Score</th>
              <th className="px-2 sm:px-4 py-3 text-left font-semibold text-[var(--ink-3)] uppercase tracking-wider text-[10px] sm:text-xs whitespace-nowrap">Teams</th>
              <th className="px-2 sm:px-4 py-3 text-right font-semibold text-[var(--ink-3)] uppercase tracking-wider text-[10px] sm:text-xs whitespace-nowrap">Ballpark</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--line)]">
            {rows.map((row, i) => {
              const visitorWon = row.visitor_score > row.home_score;
              const winner = visitorWon ? row.visitor_team : row.home_team;
              const loser = visitorWon ? row.home_team : row.visitor_team;
              const isNew = new Date(row.date).getUTCFullYear() === thisYear;
              const boxScoreUrl =
                row.game_id && row.source === "mlb_api"
                  ? `https://www.mlb.com/gameday/${row.game_id}`
                  : row.box_url ?? null;

              const rowContent = (
                <>
                  <td className="px-2 sm:px-4 py-2 sm:py-2.5 text-[11px] sm:text-sm text-[var(--ink-2)] tabular-nums whitespace-nowrap">
                    {isNew && (
                      <span
                        className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--team-accent)] mr-1.5 align-middle"
                        title={`New in ${thisYear}`}
                      />
                    )}
                    {formatDate(row.date)}
                  </td>
                  <td className="px-2 sm:px-4 py-2 sm:py-2.5 text-[11px] sm:text-sm text-[var(--ink)] font-semibold tabular-nums whitespace-nowrap">
                    {row.win}–{row.lose}
                  </td>
                  <td className="px-2 sm:px-4 py-2 sm:py-2.5 text-[11px] sm:text-sm text-[var(--ink-2)] @3xl:whitespace-nowrap">
                    <span className="@3xl:hidden">
                      {shortName(winner)} vs.{" "}
                      <span className="whitespace-nowrap">
                        {shortName(loser)}
                        {boxScoreUrl && (
                          <ArrowUpRight className="inline-block ml-0.5 w-2.5 h-2.5 text-[var(--ink-faint)]" />
                        )}
                      </span>
                    </span>
                    <span className="hidden @3xl:inline">
                      {winner} vs. {loser}
                      {boxScoreUrl && (
                        <ArrowUpRight className="inline-block ml-1 w-3 h-3 text-[var(--ink-faint)]" />
                      )}
                    </span>
                  </td>
                  <td className="px-2 sm:px-4 py-2 sm:py-2.5 text-[11px] sm:text-sm text-right text-[var(--ink-2)]">
                    {row.venue_name ?? ""}
                  </td>
                </>
              );

              if (boxScoreUrl) {
                return (
                  <tr
                    key={`${row.win}-${row.lose}-${i}`}
                    onClick={() => window.open(boxScoreUrl, "_blank")}
                    className="hover:bg-[var(--surface-hover)] transition-colors cursor-pointer"
                  >
                    {rowContent}
                  </tr>
                );
              }

              return (
                <tr
                  key={`${row.win}-${row.lose}-${i}`}
                  className="hover:bg-[var(--surface-hover)] transition-colors"
                >
                  {rowContent}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-3 pt-1">
          <span className="hidden sm:block text-xs text-[var(--ink-3)] tabular-nums">
            {rangeStart.toLocaleString()}–{rangeEnd.toLocaleString()} of {total.toLocaleString()}
          </span>
          <div className="flex items-center gap-0.5 mx-auto sm:mx-0">
            <button
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage === 1 || isLoading}
              className={navBtn}
              aria-label="Previous page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            {getPageItems(currentPage, totalPages).map((item) =>
              typeof item === "number" ? (
                <button
                  key={item}
                  onClick={() => goToPage(item)}
                  disabled={isLoading}
                  aria-current={item === currentPage ? "page" : undefined}
                  className={`min-w-[28px] h-7 px-1.5 rounded-md text-sm tabular-nums transition-colors ${
                    item === currentPage
                      ? "bg-[var(--surface)] border border-[var(--line)] text-[var(--ink)] font-semibold"
                      : "text-[var(--ink-3)] hover:text-[var(--ink)]"
                  }`}
                >
                  {item}
                </button>
              ) : (
                <span
                  key={item}
                  className="min-w-[20px] text-center text-sm text-[var(--ink-faint)] select-none"
                >
                  …
                </span>
              )
            )}
            <button
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage === totalPages || isLoading}
              className={navBtn}
              aria-label="Next page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
