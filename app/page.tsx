"use client";

import React, { useState, useMemo } from "react";
import useSWR from "swr";
import { AlertTriangle } from "lucide-react";

import TopBar from "@/components/top-bar";
import FilterBar from "@/components/filter-bar";
import ScorigamiHeatmap from "@/components/scorigami-heatmap";
import FranchiseLineage from "@/components/franchise-lineage";
import PageFooter from "@/components/page-footer";
import {
  TEAM_NAMES,
  CURRENT_FRANCHISE_CODES,
  FranchiseCode,
  ScorigamiType,
} from "@/lib/mlb-data";

const CURRENT_YEAR = new Date().getFullYear();
const MIN_YEAR = 1871;

const fetcher = async (u: string) => {
  const r = await fetch(u);
  const json = await r.json();
  if (!r.ok) throw new Error(json.error || "API error");
  return json;
};

export default function Home() {
  const [scorigamiType, setScorigamiType] = useState<ScorigamiType>("traditional");
  const [club, setClub] = useState<FranchiseCode | "ALL">("ALL");
  // Visual state (updates on every drag tick for smooth slider)
  const [yearRange, setYearRange] = useState<[number, number]>([MIN_YEAR, CURRENT_YEAR]);
  // Committed state (updates only on thumb release — drives the API call)
  const [committedYearRange, setCommittedYearRange] = useState<[number, number]>([MIN_YEAR, CURRENT_YEAR]);

  const isAllTime = committedYearRange[0] === MIN_YEAR && committedYearRange[1] === CURRENT_YEAR;

  const apiUrl = useMemo(() => {
    const base = `/api/scorigami?team=${club}&type=${scorigamiType}`;
    if (isAllTime) {
      return `${base}&year=ALL`;
    }
    return `${base}&yearStart=${committedYearRange[0]}&yearEnd=${committedYearRange[1]}`;
  }, [club, scorigamiType, committedYearRange, isAllTime]);

  const {
    data: rows,
    error,
    isLoading,
    isValidating,
  } = useSWR(apiUrl, fetcher, {
    revalidateOnFocus: false,
    revalidateIfStale: false,
    dedupingInterval: 3600000,
    keepPreviousData: true,
  });

  const totalGamesDisplayed = useMemo(() => {
    if (!rows || error || !Array.isArray(rows)) return 0;
    return rows.reduce(
      (sum: number, row: { occurrences: number }) => sum + Number(row.occurrences),
      0
    );
  }, [rows, error]);

  const sortedTeamsForDropdown = useMemo(() => {
    return CURRENT_FRANCHISE_CODES.map((code) => ({
      code,
      name: TEAM_NAMES[code] ?? code,
    })).sort((a, b) => a.name.localeCompare(b.name));
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <TopBar
        totalGamesDisplayed={totalGamesDisplayed}
        isLoading={isLoading && !rows}
      />

      <FilterBar
        scorigamiType={scorigamiType}
        setScorigamiType={setScorigamiType}
        club={club}
        setClub={setClub}
        yearRange={yearRange}
        setYearRange={setYearRange}
        onYearRangeCommit={setCommittedYearRange}
        sortedTeamsForDropdown={sortedTeamsForDropdown}
      />

      <main className="flex-1 container mx-auto px-4 pb-4">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Lineage sidebar — left on desktop, below heatmap on mobile */}
          <div className="order-2 md:order-1 w-full md:w-48 flex-shrink-0 md:self-start">
            <FranchiseLineage club={club} />
          </div>

          {/* Heatmap card */}
          <div className="order-1 md:order-2 flex-1 min-w-0 relative bg-white dark:bg-[#1e1e1e] border border-slate-200/80 dark:border-[#2c2c2c] rounded-lg overflow-hidden min-h-[500px]">
            {isValidating && (
              <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-blue-500/10 z-50">
                <div className="h-full bg-blue-500 animate-loading-bar w-full origin-left" />
              </div>
            )}

            {error ? (
              <div className="flex flex-col items-center justify-center p-6 min-h-[450px] text-center">
                <AlertTriangle className="w-10 h-10 text-red-500 mb-3" />
                <h3 className="text-base font-medium text-red-700 dark:text-red-400">
                  Data Offline
                </h3>
                <p className="text-sm text-red-600 dark:text-red-500 mt-1">
                  The connection was interrupted.
                </p>
              </div>
            ) : (
              <ScorigamiHeatmap
                rows={rows}
                isLoading={isLoading && !rows}
                scorigamiType={scorigamiType}
                club={club}
              />
            )}
          </div>
        </div>
      </main>

      <PageFooter />
    </div>
  );
}
