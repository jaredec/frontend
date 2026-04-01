"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import type { HistoryRow, FilterMode } from "./page";

const FILTER_OPTIONS: { label: string; value: FilterMode }[] = [
  { label: "All Scorigami", value: "all" },
  { label: "Rarigami", value: "rarigami" },
  { label: "Playoffigami", value: "playoff" },
];

function formatDate(raw: string): string {
  const d = new Date(raw);
  return d.toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function FilterDropdown({ value, onChange }: { value: FilterMode; onChange: (v: FilterMode) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const label = FILTER_OPTIONS.find((o) => o.value === value)?.label ?? "All Scorigami";
  const itemCls = "w-full text-left px-3 py-2 text-sm text-slate-800 dark:text-slate-200 hover:bg-blue-500 hover:text-white rounded cursor-pointer";

  return (
    <div ref={ref} className="relative w-44">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between rounded-md border border-slate-200 dark:border-[#3e3e42] bg-white dark:bg-[#252526] px-2.5 py-1.5 text-sm text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      >
        <span className="flex-1 truncate">{label}</span>
        <ChevronDown className="h-3.5 w-3.5 text-slate-400 flex-shrink-0 ml-1" />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-slate-200 dark:border-[#3e3e42] bg-white dark:bg-[#252526] p-1 shadow-lg">
          {FILTER_OPTIONS.map((opt) => (
            <button key={opt.value} onClick={() => { onChange(opt.value); setOpen(false); }} className={itemCls}>
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function HistoryTable({
  rows: initialRows,
  filter: initialFilter,
  total: initialTotal,
  currentPage: initialPage,
  totalPages: initialTotalPages,
}: {
  rows: HistoryRow[];
  filter: FilterMode;
  total: number;
  currentPage: number;
  totalPages: number;
}) {
  const [filter, setFilter] = useState<FilterMode>(initialFilter);
  const [rows, setRows] = useState<HistoryRow[]>(initialRows);
  const [total, setTotal] = useState(initialTotal);
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [totalPages, setTotalPages] = useState(initialTotalPages);
  const [isLoading, setIsLoading] = useState(false);

  async function fetchData(f: FilterMode, p: number) {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ filter: f, page: String(p) });
      const res = await fetch(`/api/history?${params}`);
      const data = await res.json();
      setRows(data.rows);
      setTotal(data.total);
      setTotalPages(data.totalPages);
      setCurrentPage(p);
      const url = f === "all" && p === 1 ? "/history"
        : f === "all" ? `/history?page=${p}`
        : p === 1 ? `/history?filter=${f}`
        : `/history?filter=${f}&page=${p}`;
      window.history.pushState({}, "", url);
    } finally {
      setIsLoading(false);
    }
  }

  function handleFilterChange(v: FilterMode) {
    setFilter(v);
    fetchData(v, 1);
  }

  function goToPage(p: number) {
    window.scrollTo({ top: 0, behavior: "smooth" });
    fetchData(filter, p);
  }

  const rowLabel = filter === "rarigami" ? "game" : "score";

  return (
    <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-8 space-y-4">
      {/* Filter + count row */}
      <div className="flex items-end gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">Filter</label>
          <FilterDropdown value={filter} onChange={handleFilterChange} />
        </div>
        <span className="pb-1.5 text-xs text-slate-400 dark:text-slate-500 tabular-nums">
          {total.toLocaleString()} {rowLabel}{total !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-[#2d2d30] relative">
        {isLoading && (
          <div className="absolute top-0 left-0 right-0 h-[2px] overflow-hidden z-50">
            <div className="h-full w-full bg-gradient-to-r from-transparent via-blue-500/40 to-transparent animate-shimmer" />
          </div>
        )}
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-slate-200 dark:border-[#2d2d30] bg-slate-100/70 dark:bg-[#252526]">
              <th className="px-2 sm:px-4 py-3 text-left font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[10px] sm:text-xs whitespace-nowrap">Date</th>
              <th className="px-2 sm:px-4 py-3 text-left font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[10px] sm:text-xs whitespace-nowrap">Score</th>
              <th className="px-2 sm:px-4 py-3 text-left font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[10px] sm:text-xs whitespace-nowrap">Teams</th>
              <th className="px-2 sm:px-4 py-3 text-right font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[10px] sm:text-xs whitespace-nowrap">Occurrences</th>
              <th className="px-2 sm:px-4 py-3 text-center font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[10px] sm:text-xs whitespace-nowrap">Box Score</th>
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

              return (
                <tr key={i} className="hover:bg-slate-50 dark:hover:bg-[#252526] transition-colors">
                  <td className="px-2 sm:px-4 py-2 sm:py-2.5 text-[11px] sm:text-sm text-slate-500 dark:text-slate-400 tabular-nums whitespace-nowrap">
                    {formatDate(row.date)}
                  </td>
                  <td className="px-2 sm:px-4 py-2 sm:py-2.5 text-[11px] sm:text-sm text-slate-900 dark:text-slate-100 font-medium tabular-nums whitespace-nowrap">
                    {row.win}–{row.lose}
                  </td>
                  <td className="px-2 sm:px-4 py-2 sm:py-2.5 text-[11px] sm:text-sm text-slate-500 dark:text-slate-400 whitespace-nowrap">
                    {winner} vs. {loser}
                  </td>
                  <td className="px-2 sm:px-4 py-2 sm:py-2.5 text-[11px] sm:text-sm text-right tabular-nums text-slate-500 dark:text-slate-400 whitespace-nowrap">
                    {occurrences.toLocaleString()}
                  </td>
                  <td className="px-2 sm:px-4 py-2 sm:py-2.5 text-center whitespace-nowrap">
                    {boxScoreUrl ? (
                      <a
                        href={boxScoreUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center text-slate-400 dark:text-slate-500 hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
                        aria-label="Box score"
                      >
                        <ExternalLink className="w-3 sm:w-3.5 h-3 sm:h-3.5" />
                      </a>
                    ) : (
                      <span className="text-slate-300 dark:text-slate-700">—</span>
                    )}
                  </td>
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
