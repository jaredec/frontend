"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import useSWR, { preload } from "swr";
import { AlertTriangle, ArrowLeftRight, Maximize2, Minimize2 } from "lucide-react";

import NavBar from "@/components/nav-bar";
import FilterBar from "@/components/filter-bar";
import ScorigamiHeatmap from "@/components/scorigami-heatmap";
import PageFooter from "@/components/page-footer";
import {
  TEAM_NAMES,
  CURRENT_FRANCHISE_CODES,
  FranchiseCode,
  ScorigamiType,
  GameFilter,
} from "@/lib/mlb-data";
import type { YearlyRow } from "@/lib/scorigami-queries";

const CURRENT_YEAR = new Date().getFullYear();
const MIN_YEAR = 1871;

// Flip to false to immediately revert to API-only behavior.
const USE_STATIC_JSON = true;

const STATIC_TYPE_DIR: Record<string, string> = {
  traditional: "traditional",
  home_away: "homeaway",
};

// Two-URL fetcher: try the primary, fall back to the secondary on any failure.
// Encoded as "primary|fallback" in the SWR key. SWR keys remain unique per
// (team, type, gameFilter) combo, so caching still works.
const fetcher = async (key: string) => {
  const [primary, fallback] = key.includes("|") ? key.split("|") : [key, null];
  try {
    const r = await fetch(primary);
    if (r.ok) return await r.json();
    if (!fallback) {
      const json = await r.json().catch(() => ({}));
      throw new Error(json.error || `HTTP ${r.status}`);
    }
  } catch (e) {
    if (!fallback) throw e;
  }
  const r = await fetch(fallback);
  const json = await r.json();
  if (!r.ok) throw new Error(json.error || "API error");
  return json;
};

function buildDataKey(club: string, scorigamiType: string, gameFilter: string): string {
  const apiUrl = `/api/scorigami?team=${club}&type=${scorigamiType}&mode=yearly&gameFilter=${gameFilter}`;
  // Static JSON only covers the "all games" case — game filters still hit the API.
  if (!USE_STATIC_JSON || gameFilter !== "all") return apiUrl;
  const dir = STATIC_TYPE_DIR[scorigamiType];
  if (!dir) return apiUrl;
  const staticUrl = `/scorigami-data/${dir}/${club}.json`;
  return `${staticUrl}|${apiUrl}`;
}

export type GridSize = 36 | 51;

interface ScorigamiPageProps {
  initialClub?: FranchiseCode | "ALL";
}

export default function ScorigamiPage({ initialClub = "ALL" }: ScorigamiPageProps) {
  const [scorigamiType, setScorigamiType] = useState<ScorigamiType>("traditional");
  const [club, setClub] = useState<FranchiseCode | "ALL">(initialClub);
  const [yearRange, setYearRange] = useState<[number, number]>([MIN_YEAR, CURRENT_YEAR]);
  const [gameFilter, setGameFilter] = useState<GameFilter>("all");
  const [gridSize, setGridSize] = useState<GridSize>(36);
  // Track when filter dropdowns close to suppress ghost clicks on heatmap
  const dropdownCloseTimeRef = useRef(0);
  const handleDropdownOpenChange = (open: boolean) => {
    if (!open) dropdownCloseTimeRef.current = Date.now();
  };
  const isGhostClick = () => Date.now() - dropdownCloseTimeRef.current < 400;

  // Load all yearly data once per team+type combo
  const dataKey = useMemo(
    () => buildDataKey(club, scorigamiType, gameFilter),
    [club, scorigamiType, gameFilter]
  );

  const {
    data: yearlyRows,
    error,
    isLoading,
    isValidating,
  } = useSWR<YearlyRow[]>(dataKey, fetcher, {
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

  // Adjust yearRange when data bounds change (e.g. team or game filter switch)
  const prevClubRef = useRef(club);
  const prevGameFilterRef = useRef(gameFilter);
  useEffect(() => {
    if (!yearlyRows || yearlyRows.length === 0) return;

    const [dataMin, dataMax] = dataYearBounds;
    const clubChanged = prevClubRef.current !== club;
    const gameFilterChanged = prevGameFilterRef.current !== gameFilter;
    prevClubRef.current = club;
    prevGameFilterRef.current = gameFilter;

    if (clubChanged || gameFilterChanged) {
      // Team or game filter changed: snap to full range for new data
      setYearRange([Math.max(dataMin, MIN_YEAR), dataMax]);
    } else {
      // Same team + filter, bounds may have shifted (type switch or data reload): clamp
      setYearRange(([lo, hi]) => {
        const clampedLo = Math.max(lo, dataMin);
        const clampedHi = Math.min(hi, dataMax);
        if (clampedLo > clampedHi) return [dataMin, dataMax];
        if (clampedLo !== lo || clampedHi !== hi) return [clampedLo, clampedHi];
        return [lo, hi];
      });
    }
  }, [club, gameFilter, yearlyRows, dataYearBounds]);

  // Prefetch the alternate type so toggling is instant
  useEffect(() => {
    if (!yearlyRows) return;
    const altType = scorigamiType === "traditional" ? "home_away" : "traditional";
    preload(buildDataKey(club, altType, gameFilter), fetcher);
  }, [yearlyRows, club, scorigamiType, gameFilter]);

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
      box_url: string | null;
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
          box_url: row.box_url ?? null,
        });
      } else {
        existing.occurrences += Number(row.occurrences);
        if (row.last_date && (!existing.last_date || row.last_date > existing.last_date)) {
          existing.last_date = row.last_date;
          existing.last_home_team = row.last_home_team;
          existing.last_visitor_team = row.last_visitor_team;
          existing.last_game_id = row.last_game_id;
          existing.source = row.source;
          existing.box_url = row.box_url ?? null;
        }
      }
    }

    return Array.from(map.values());
  }, [yearlyRows, yearRange]);


  const sortedTeamsForDropdown = useMemo(() => {
    return CURRENT_FRANCHISE_CODES.map((code) => ({
      code,
      name: TEAM_NAMES[code] ?? code,
    })).sort((a, b) => a.name.localeCompare(b.name));
  }, []);

  const quickStats = useMemo(() => {
    if (!rows || rows.length === 0) return null;
    const totalGames = rows.reduce((s, r) => s + r.occurrences, 0);
    return { totalGames, uniqueScores: rows.length };
  }, [rows]);

  const isFiltered =
    club !== initialClub ||
    gameFilter !== "all" ||
    yearRange[0] !== MIN_YEAR ||
    yearRange[1] !== CURRENT_YEAR;

  const handleReset = () => {
    setClub(initialClub);
    setGameFilter("all");
    setYearRange([MIN_YEAR, CURRENT_YEAR]);
  };

  const filterProps = {
    gameFilter,
    setGameFilter,
    club,
    setClub,
    yearRange,
    setYearRange,
    dataYearBounds,
    sortedTeamsForDropdown,
    onDropdownOpenChange: handleDropdownOpenChange,
    onReset: handleReset,
    isFiltered,
  };

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar
        totalGames={quickStats?.totalGames}
        uniqueScores={quickStats?.uniqueScores}
      />

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-4">
        {/* Filters */}
        <div className="mb-3">
          <FilterBar {...filterProps} />
        </div>

        {/* Heatmap — full width */}
        <div className="relative bg-white dark:bg-[#252526] rounded-lg overflow-hidden min-h-[400px] md:min-h-[500px]">

          {/* Icon buttons: type toggle + expand/collapse */}
          <div className="absolute top-2 right-2 z-10 flex items-center gap-1">
            <button
              onClick={() => setScorigamiType(scorigamiType === "traditional" ? "home_away" : "traditional")}
              className="p-1.5 rounded-md bg-white/80 dark:bg-[#252526]/80 backdrop-blur-sm border border-slate-200/60 dark:border-[#3e3e42]/60 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
              title={scorigamiType === "traditional" ? "Switch to Home/Away view" : "Switch to Traditional view"}
            >
              <ArrowLeftRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => setGridSize(gridSize === 36 ? 51 : 36)}
              className="p-1.5 rounded-md bg-white/80 dark:bg-[#252526]/80 backdrop-blur-sm border border-slate-200/60 dark:border-[#3e3e42]/60 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
              title={gridSize === 36 ? "Expand grid" : "Collapse grid"}
            >
              {gridSize === 36 ? (
                <Maximize2 className="w-4 h-4" />
              ) : (
                <Minimize2 className="w-4 h-4" />
              )}
            </button>
          </div>

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
              isGhostClick={isGhostClick}
            />
          )}
        </div>
      </main>

      <PageFooter />
    </div>
  );
}
