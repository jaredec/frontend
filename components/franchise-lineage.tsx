"use client";

import useSWR from "swr";
import { TEAM_NAMES } from "@/lib/mlb-data";

interface LineageEntry {
  display_name: string;
  years_active: string;
  start_year: number;
}

const fetcher = async (u: string) => {
  const r = await fetch(u);
  const json = await r.json();
  if (!r.ok) throw new Error(json.message || "API error");
  return json;
};

interface FranchiseLineageProps {
  club: string;
}

export default function FranchiseLineage({ club }: FranchiseLineageProps) {
  const { data, error, isLoading } = useSWR<LineageEntry[]>(
    club !== "ALL" ? `/api/franchise-history?team=${club}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 86400000,
    }
  );

  const hasLineage = !isLoading && !error && Array.isArray(data) && data.length > 0;
  const franchiseName = club !== "ALL" ? (TEAM_NAMES[club] ?? club) : "Major League Baseball";

  return (
    <div className="bg-white dark:bg-[#1e1e1e] border border-slate-200/80 dark:border-[#2c2c2c] rounded-lg p-4">
      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-1">
        {franchiseName}
      </h3>

      {club === "ALL" ? (
        <div className="text-xs text-slate-400 dark:text-slate-500 mt-2 space-y-1.5">
          <p>All 30 franchises</p>
          <p className="tabular-nums">1871 – Present</p>
        </div>
      ) : hasLineage ? (
        <div className="mt-3 space-y-0">
          {data!.map((entry, i) => (
            <div
              key={`${entry.display_name}-${entry.start_year}`}
              className="flex items-start gap-2.5 relative"
            >
              <div className="flex flex-col items-center flex-shrink-0 w-2.5">
                <div
                  className={`w-1.5 h-1.5 rounded-full mt-1.5 ${
                    i === 0
                      ? "bg-blue-500"
                      : "bg-slate-300 dark:bg-slate-600"
                  }`}
                />
                {i < data!.length - 1 && (
                  <div className="w-px flex-1 bg-slate-200 dark:bg-[#383838] min-h-[16px]" />
                )}
              </div>
              <div className="pb-2.5 min-w-0">
                <p className="text-xs font-medium text-slate-700 dark:text-slate-300 leading-tight">
                  {entry.display_name}
                </p>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 tabular-nums">
                  {entry.years_active}
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : club !== "ALL" && !isLoading ? (
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
          No history available.
        </p>
      ) : null}
    </div>
  );
}
