"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import useSWR, { preload } from "swr";
import { AlertTriangle, Maximize2, Minimize2 } from "lucide-react";

import TopBar from "@/components/top-bar";
import FilterBar from "@/components/filter-bar";
import ScorigamiHeatmap from "@/components/scorigami-heatmap";
import PageFooter from "@/components/page-footer";
import {
  TEAM_NAMES,
  CURRENT_FRANCHISE_CODES,
  FranchiseCode,
  ScorigamiType,
} from "@/lib/mlb-data";
import type { YearlyRow } from "@/lib/scorigami-queries";

const CURRENT_YEAR = new Date().getFullYear();
const MIN_YEAR = 1871;

const fetcher = async (u: string) => {
  const r = await fetch(u);
  const json = await r.json();
  if (!r.ok) throw new Error(json.error || "API error");
  return json;
};

export type GridSize = 36 | 51;

interface ScorigamiPageProps {
  initialClub?: FranchiseCode | "ALL";
}

export default function ScorigamiPage({ initialClub = "ALL" }: ScorigamiPageProps) {
  const [scorigamiType, setScorigamiType] = useState<ScorigamiType>("traditional");
  const [club, setClub] = useState<FranchiseCode | "ALL">(initialClub);
  const [yearRange, setYearRange] = useState<[number, number]>([MIN_YEAR, CURRENT_YEAR]);
  const [gridSize, setGridSize] = useState<GridSize>(36);

  // Load all yearly data once per team+type combo
  const apiUrl = useMemo(
    () => `/api/scorigami?team=${club}&type=${scorigamiType}&mode=yearly`,
    [club, scorigamiType]
  );

  const {
    data: yearlyRows,
    error,
    isLoading,
    isValidating,
  } = useSWR<YearlyRow[]>(apiUrl, fetcher, {
    revalidateOnFocus: false,
    revalidateIfStale: false,
    dedupingInterval: 3600000,
  });

  // Derive min/max year from actual data
  const dataYearBounds = useMemo<[number, number]>(() => {
    if (!Array.isArray(yearlyRows) || yearlyRows.length === 0)
      return [MIN_YEAR, CURRENT_YEAR];
    let min = Infinity;
    let max = -Infinity;
    for (const row of yearlyRows) {
      if (row.year < min) min = row.year;
      if (row.year > max) max = row.year;
    }
    return [min, max];
  }, [yearlyRows]);

  // Adjust yearRange when data bounds change (e.g. team switch)
  const prevClubRef = useRef(club);
  useEffect(() => {
    if (!yearlyRows || yearlyRows.length === 0) return;

    const [dataMin, dataMax] = dataYearBounds;
    const clubChanged = prevClubRef.current !== club;
    prevClubRef.current = club;

    if (clubChanged) {
      // Team changed: snap to full range
      setYearRange([dataMin, dataMax]);
    } else {
      // Same team, bounds may have shifted (type switch or data reload): clamp
      setYearRange(([lo, hi]) => {
        const clampedLo = Math.max(lo, dataMin);
        const clampedHi = Math.min(hi, dataMax);
        if (clampedLo > clampedHi) return [dataMin, dataMax];
        if (clampedLo !== lo || clampedHi !== hi) return [clampedLo, clampedHi];
        return [lo, hi];
      });
    }
  }, [club, yearlyRows, dataYearBounds]);

  // Prefetch the alternate type so toggling is instant
  useEffect(() => {
    if (!yearlyRows) return;
    const altType = scorigamiType === "traditional" ? "home_away" : "traditional";
    const altUrl = `/api/scorigami?team=${club}&type=${altType}&mode=yearly`;
    preload(altUrl, fetcher);
  }, [yearlyRows, club, scorigamiType]);

  // Client-side: filter by year range and aggregate by score pair
  const rows = useMemo(() => {
    if (!Array.isArray(yearlyRows) || yearlyRows.length === 0) return undefined;

    const map = new Map<string, {
      score1: number;
      score2: number;
      occurrences: number;
      last_date: string | null;
      last_home_team: string | null;
      last_visitor_team: string | null;
      last_game_id: number | null;
      source: string | null;
    }>();

    for (const row of yearlyRows) {
      if (row.year < yearRange[0] || row.year > yearRange[1]) continue;

      const key = `${row.score1}-${row.score2}`;
      const existing = map.get(key);

      if (!existing) {
        map.set(key, {
          score1: row.score1,
          score2: row.score2,
          occurrences: Number(row.occurrences),
          last_date: row.last_date,
          last_home_team: row.last_home_team,
          last_visitor_team: row.last_visitor_team,
          last_game_id: row.last_game_id,
          source: row.source,
        });
      } else {
        existing.occurrences += Number(row.occurrences);
        if (row.last_date && (!existing.last_date || row.last_date > existing.last_date)) {
          existing.last_date = row.last_date;
          existing.last_home_team = row.last_home_team;
          existing.last_visitor_team = row.last_visitor_team;
          existing.last_game_id = row.last_game_id;
          existing.source = row.source;
        }
      }
    }

    return Array.from(map.values());
  }, [yearlyRows, yearRange]);

  const totalGamesDisplayed = useMemo(() => {
    if (!rows || error) return 0;
    return rows.reduce((sum, row) => sum + row.occurrences, 0);
  }, [rows, error]);

  const sortedTeamsForDropdown = useMemo(() => {
    return CURRENT_FRANCHISE_CODES.map((code) => ({
      code,
      name: TEAM_NAMES[code] ?? code,
    })).sort((a, b) => a.name.localeCompare(b.name));
  }, []);

  const filterProps = {
    scorigamiType,
    setScorigamiType,
    club,
    setClub,
    yearRange,
    setYearRange,
    dataYearBounds,
    sortedTeamsForDropdown,
  };

  return (
    <div className="min-h-screen flex flex-col">
      <TopBar
        totalGamesDisplayed={totalGamesDisplayed}
        isLoading={isLoading && !yearlyRows}
      />

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-4">
        {/* Filters */}
        <div className="mb-3">
          <FilterBar {...filterProps} />
        </div>

        {/* Heatmap — full width */}
        <div className="relative bg-white dark:bg-[#252526] border border-slate-200/80 dark:border-[#2d2d30] rounded-lg overflow-hidden min-h-[400px] md:min-h-[500px]">
          {/* Expand/collapse grid button */}
          <button
            onClick={() => setGridSize(gridSize === 36 ? 51 : 36)}
            className="absolute top-2 right-2 z-10 p-1.5 rounded-md bg-white/80 dark:bg-[#252526]/80 backdrop-blur-sm border border-slate-200/60 dark:border-[#3e3e42]/60 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
            title={gridSize === 36 ? "Expand grid" : "Collapse grid"}
          >
            {gridSize === 36 ? (
              <Maximize2 className="w-4 h-4" />
            ) : (
              <Minimize2 className="w-4 h-4" />
            )}
          </button>

          {isValidating && (
            <div className="absolute top-0 left-0 right-0 h-[2px] overflow-hidden z-50">
              <div className="h-full w-full bg-gradient-to-r from-transparent via-blue-500/40 to-transparent animate-shimmer" />
            </div>
          )}

          {error ? (
            <div className="flex flex-col items-center justify-center p-6 min-h-[400px] md:min-h-[450px] text-center">
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
              isLoading={isLoading && !yearlyRows}
              scorigamiType={scorigamiType}
              club={club}
              gridSize={gridSize}
            />
          )}
        </div>
      </main>

      <PageFooter />

      {/* Buy me a coffee — fixed bottom right */}
      <a
        href="https://buymeacoffee.com/mlbscorigami"
        target="_blank"
        rel="noopener noreferrer"
        style={{ fontFamily: "var(--font-cookie)" }}
        className="fixed bottom-4 right-4 md:bottom-5 md:right-5 flex items-center gap-1.5 md:gap-2 bg-black dark:bg-white rounded-full px-3.5 py-2 md:px-6 md:py-3 text-sm md:text-xl text-white dark:text-black shadow-lg hover:scale-105 transition-transform z-50"
      >
        <span>☕</span>
        <span>Buy me a coffee</span>
      </a>
    </div>
  );
}
