"use client";

import React, { useState, useMemo, useEffect, useLayoutEffect, useRef, useCallback } from "react";
import useSWR, { preload, useSWRConfig } from "swr";
import { AlertTriangle, ArrowLeftRight, Maximize2, Minimize2 } from "lucide-react";

import NavBar from "@/components/nav-bar";
import FilterBar from "@/components/filter-bar";
import ScorigamiHeatmap from "@/components/scorigami-heatmap";
import PageFooter from "@/components/page-footer";
import V2About from "@/components/v2-about";
import {
  TEAM_NAMES,
  CURRENT_FRANCHISE_CODES,
  FranchiseCode,
  ScorigamiType,
  GameFilter,
  TEAM_IGAMI,
  getTeamLogoUrl,
} from "@/lib/mlb-data";
import type { YearlyRow } from "@/lib/scorigami-queries";

const formatMetaDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });

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

type AggRow = {
  score1: number;
  score2: number;
  occurrences: number;
  last_date: string | null;
  last_home_team: string | null;
  last_visitor_team: string | null;
  last_game_id: number | null;
  source: string | null;
  box_url: string | null;
};

type HeaderStats = {
  totalGames: number;
  uniqueScores: number;
  wins: number | null;
  losses: number | null;
  ties: number;
  recent: { score1: number; score2: number; date: string | null; home: string | null; visitor: string | null } | null;
};

function aggregateRows(yearly: YearlyRow[], yearRange: [number, number]): AggRow[] {
  const map = new Map<string, AggRow>();
  for (const row of yearly) {
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
}

function computeHeaderStats(
  rows: AggRow[],
  yearly: YearlyRow[],
  ha: YearlyRow[] | undefined,
  statsClub: FranchiseCode | "ALL",
  statsType: ScorigamiType,
  yearRange: [number, number],
): HeaderStats {
  if (rows.length === 0) {
    return {
      totalGames: 0,
      uniqueScores: 0,
      wins: statsClub === "ALL" ? null : 0,
      losses: statsClub === "ALL" ? null : 0,
      ties: 0,
      recent: null,
    };
  }
  const totalGames = rows.reduce((s, r) => s + r.occurrences, 0);
  const uniqueScores = rows.length;
  const recordRows: YearlyRow[] | undefined =
    statsClub === "ALL" ? undefined : statsType === "home_away" ? yearly : ha;
  let wins: number | null = null;
  let losses: number | null = null;
  let ties = 0;
  if (statsClub === "ALL") {
    for (const r of rows) {
      if (r.score1 === r.score2) ties += Number(r.occurrences);
    }
  } else if (Array.isArray(recordRows)) {
    wins = 0;
    losses = 0;
    for (const row of recordRows) {
      if (row.year < yearRange[0] || row.year > yearRange[1]) continue;
      const n = Number(row.occurrences);
      if (row.score1 > row.score2) wins += n;
      else if (row.score1 < row.score2) losses += n;
      else ties += n;
    }
  } else {
    for (const r of rows) {
      if (r.score1 === r.score2) ties += Number(r.occurrences);
    }
  }

  const isSingleSeason = yearRange[0] === yearRange[1];
  let recent: HeaderStats["recent"] = null;
  if (isSingleSeason) {
    const allTime = new Map<string, number>();
    for (const row of yearly) {
      const k = `${row.score1}-${row.score2}`;
      allTime.set(k, (allTime.get(k) ?? 0) + Number(row.occurrences));
    }
    let best: AggRow | null = null;
    let bestAllTime = Infinity;
    for (const r of rows) {
      const k = `${r.score1}-${r.score2}`;
      const n = allTime.get(k) ?? Number(r.occurrences);
      if (
        !best ||
        n < bestAllTime ||
        (n === bestAllTime && (r.last_date || "") > (best.last_date || ""))
      ) {
        best = r;
        bestAllTime = n;
      }
    }
    if (best) {
      recent = {
        score1: best.score1,
        score2: best.score2,
        date: best.last_date,
        home: best.last_home_team,
        visitor: best.last_visitor_team,
      };
    }
  } else if (yearly.length > 0) {
    const first = new Map<string, YearlyRow>();
    for (const row of yearly) {
      const k = `${row.score1}-${row.score2}`;
      const prev = first.get(k);
      if (!prev || row.year < prev.year) first.set(k, row);
    }
    let best: YearlyRow | null = null;
    for (const row of first.values()) {
      if (row.year < yearRange[0] || row.year > yearRange[1]) continue;
      if (
        !best ||
        row.year > best.year ||
        (row.year === best.year && (row.last_date || "") > (best.last_date || ""))
      ) {
        best = row;
      }
    }
    if (best) {
      recent = {
        score1: best.score1,
        score2: best.score2,
        date: best.last_date,
        home: best.last_home_team,
        visitor: best.last_visitor_team,
      };
    }
  }

  return { totalGames, uniqueScores, wins, losses, ties, recent };
}

function yearBounds(yearly: YearlyRow[]): [number, number] {
  if (yearly.length === 0) return [MIN_YEAR, CURRENT_YEAR];
  let min = Infinity;
  let max = -Infinity;
  for (const row of yearly) {
    if (row.year < min) min = row.year;
    if (row.year > max) max = row.year;
  }
  return [min, max];
}

function sliderSpan(yearly: YearlyRow[], gameFilter: GameFilter): [number, number] {
  const [min, max] = yearBounds(yearly);
  const postseason = ["playoffs", "ws", "lcs", "ds", "wc"].includes(gameFilter);
  return [min, postseason ? max : Math.max(max, CURRENT_YEAR)];
}

export type GridSize = 36 | 51;

interface ScorigamiPageProps {
  initialClub?: FranchiseCode | "ALL";
  variant?: "default" | "single";
}

export default function ScorigamiPage({ initialClub = "ALL", variant = "single" }: ScorigamiPageProps) {
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

  // Warm the browser cache with every team logo so the header logo swaps instantly
  // (no blank flash) when the filter changes. Single-page variant only.
  useEffect(() => {
    if (variant !== "single") return;
    CURRENT_FRANCHISE_CODES.forEach((code) => {
      const url = getTeamLogoUrl(code);
      if (url) {
        const img = new window.Image();
        img.src = url;
      }
    });
  }, [variant]);

  // Load all yearly data once per team+type combo
  const dataKey = useMemo(
    () => buildDataKey(club, scorigamiType, gameFilter),
    [club, scorigamiType, gameFilter]
  );

  const { cache } = useSWRConfig();

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

  // Team W/L needs home/away rows even when the grid is on the traditional view.
  const haKey = useMemo(
    () => (variant === "single" ? buildDataKey(club, "home_away", gameFilter) : null),
    [variant, club, gameFilter]
  );
  const { data: haYearly } = useSWR<YearlyRow[]>(haKey, fetcher, {
    revalidateOnFocus: false,
    revalidateIfStale: false,
    dedupingInterval: 3600000,
  });

  type ViewSnap = {
    yearly: YearlyRow[];
    ha: YearlyRow[] | undefined;
    club: FranchiseCode | "ALL";
    scorigamiType: ScorigamiType;
    gameFilter: GameFilter;
    yearRange: [number, number];
  };
  const [view, setView] = useState<ViewSnap | null>(null);
  const prevClubRef = useRef(club);
  const prevGameFilterRef = useRef(gameFilter);
  const yearRangeRef = useRef(yearRange);
  yearRangeRef.current = yearRange;

  useLayoutEffect(() => {
    const cachedYearly = cache.get(dataKey)?.data as YearlyRow[] | undefined;
    if (!Array.isArray(cachedYearly)) return;

    const needHa = variant === "single" && club !== "ALL" && scorigamiType === "traditional";
    const cachedHa = haKey ? (cache.get(haKey)?.data as YearlyRow[] | undefined) : undefined;
    if (needHa && !Array.isArray(cachedHa)) return;

    const [spanMin, spanMax] = sliderSpan(cachedYearly, gameFilter);
    const clubChanged = prevClubRef.current !== club;
    const gameFilterChanged = prevGameFilterRef.current !== gameFilter;
    prevClubRef.current = club;
    prevGameFilterRef.current = gameFilter;

    const [lo, hi] = yearRangeRef.current;
    let nextRange: [number, number];
    if (clubChanged || gameFilterChanged) {
      nextRange = [spanMin, spanMax];
    } else {
      const clampedLo = Math.max(lo, spanMin);
      const clampedHi = Math.min(hi, spanMax);
      nextRange = clampedLo > clampedHi ? [spanMin, spanMax] : [clampedLo, clampedHi];
    }

    if (lo !== nextRange[0] || hi !== nextRange[1]) setYearRange(nextRange);
    setView({
      yearly: cachedYearly,
      ha: cachedHa,
      club,
      scorigamiType,
      gameFilter,
      yearRange: nextRange,
    });
  }, [cache, dataKey, haKey, yearlyRows, haYearly, club, scorigamiType, gameFilter, variant]);

  const dataYearBounds = useMemo<[number, number]>(() => {
    if (!view || !Array.isArray(view.yearly) || view.yearly.length === 0) {
      return [MIN_YEAR, CURRENT_YEAR];
    }
    return sliderSpan(view.yearly, view.gameFilter);
  }, [view]);

  useEffect(() => {
    if (!yearlyRows) return;
    const altType = scorigamiType === "traditional" ? "home_away" : "traditional";
    preload(buildDataKey(club, altType, gameFilter), fetcher);
  }, [yearlyRows, club, scorigamiType, gameFilter]);

  const display = useMemo(() => {
    if (!view) return null;
    const synced =
      view.club === club &&
      view.scorigamiType === scorigamiType &&
      view.gameFilter === gameFilter;
    const range = synced ? yearRange : view.yearRange;
    const rows = aggregateRows(view.yearly, range);
    const stats = computeHeaderStats(
      rows,
      view.yearly,
      view.ha,
      view.club,
      view.scorigamiType,
      range,
    );
    return {
      rows,
      stats,
      club: view.club,
      scorigamiType: view.scorigamiType,
      yearRange: range,
    };
  }, [view, yearRange, club, scorigamiType, gameFilter]);

  const rows = display?.rows;
  const headerStats = display?.stats ?? null;
  const statsClub = display?.club ?? club;

  const sortedTeamsForDropdown = useMemo(() => {
    return CURRENT_FRANCHISE_CODES.map((code) => ({
      code,
      name: TEAM_NAMES[code] ?? code,
    })).sort((a, b) => a.name.localeCompare(b.name));
  }, []);

  const [revealed, setRevealed] = useState(false);
  const markRevealed = useCallback(() => setRevealed(true), []);

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
  };

  return (
    <div className="min-h-screen flex flex-col" style={variant === "single" ? { backgroundColor: "#f2f2f2", fontFamily: "var(--v2-ui-font), system-ui, sans-serif" } : undefined}>
      {variant === "single" ? (
        <header className="max-w-[1150px] mx-auto w-full px-3 sm:px-4 pt-8 sm:pt-10 pb-5 sm:pb-6 text-center">
            {(() => {
              const igamiTitle = statsClub === "ALL" ? "MLB Scorigami" : (TEAM_IGAMI[statsClub] ?? "MLB Scorigami");
              const logoSrc = statsClub === "ALL" ? "/logo3.svg" : (getTeamLogoUrl(statsClub) ?? "/logo3.svg");
              const countLabel = "Unique scores";
              const shownRange = display?.yearRange ?? yearRange;
              const isSingleSeason = shownRange[0] === shownRange[1];
              const statsType = display?.scorigamiType ?? scorigamiType;
              const recentLabel = isSingleSeason
                ? "Rarest score"
                : statsClub !== "ALL"
                  ? `Last ${igamiTitle}`
                  : statsType === "home_away"
                    ? (headerStats?.recent && headerStats.recent.score1 < headerStats.recent.score2
                        ? "Last Awayigami"
                        : "Last Homeigami")
                    : "Last Scorigami";
              return (
                <>
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5">
                    <div className="h-[88px] w-[88px] sm:h-[112px] sm:w-[112px] flex items-center justify-center flex-none">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={logoSrc}
                        alt={igamiTitle}
                        className={`object-contain ${
                          statsClub === "ALL"
                            ? "h-[64px] w-[64px] sm:h-[80px] sm:w-[80px]"
                            : "h-full w-full"
                        }`}
                      />
                    </div>
                    <span
                      className="text-[36px] sm:text-[48px] tracking-tight leading-tight text-[#343434] px-1"
                      style={{
                        fontFamily: "var(--v2-title-font)",
                        fontWeight: "var(--v2-title-weight)",
                        WebkitTextStroke: "0.4px #343434",
                      }}
                    >{igamiTitle}</span>
                  </div>
                  <div
                    className="mt-3.5 sm:mt-4 min-h-[5.25rem] sm:min-h-[3.3rem] px-1 sm:px-4 text-[16px] sm:text-[17px] leading-snug sm:leading-[1.55]"
                    style={{
                      fontFamily: "var(--v2-ui-font), system-ui, sans-serif",
                      fontWeight: 400,
                      color: "#343434",
                      opacity: revealed ? 1 : 0,
                      transition: revealed ? "opacity 160ms ease-out" : undefined,
                    }}
                  >
                    {headerStats && (
                      <>
                        <div className="flex flex-col items-center gap-1.5 sm:gap-0">
                          <div className="flex flex-col items-center gap-1.5 sm:flex-row sm:flex-wrap sm:justify-center sm:gap-x-3 sm:gap-y-0.5">
                            {statsClub === "ALL" ? (
                              <>
                                <span>
                                  <span style={{ color: "#343434" }}>Games: </span>
                                  <span className="font-bold tabular-nums" style={{ color: "#343434" }}>
                                    {headerStats.totalGames.toLocaleString()}
                                  </span>
                                </span>
                                <span>
                                  <span style={{ color: "#0b162a" }}>{countLabel}: </span>
                                  <span className="font-bold tabular-nums" style={{ color: "#343434" }}>
                                    {headerStats.uniqueScores.toLocaleString()}
                                  </span>
                                </span>
                              </>
                            ) : (
                              <>
                                <span className="flex flex-wrap items-center justify-center gap-x-3">
                                  <span>
                                    <span style={{ color: "#343434" }}>Games: </span>
                                    <span className="font-bold tabular-nums" style={{ color: "#343434" }}>
                                      {headerStats.totalGames.toLocaleString()}
                                    </span>
                                  </span>
                                  <span>
                                    <span style={{ color: "#0b162a" }}>{countLabel}: </span>
                                    <span className="font-bold tabular-nums" style={{ color: "#343434" }}>
                                      {headerStats.uniqueScores.toLocaleString()}
                                    </span>
                                  </span>
                                </span>
                                {headerStats.wins != null && headerStats.losses != null && (
                                  <span className="flex flex-wrap items-center justify-center gap-x-3">
                                    <span>
                                      <span style={{ color: "#2d7a4f" }}>Wins: </span>
                                      <span className="font-bold tabular-nums" style={{ color: "#2d7a4f" }}>
                                        {headerStats.wins.toLocaleString()}
                                      </span>
                                    </span>
                                    <span>
                                      <span style={{ color: "#8a4a4a" }}>Losses: </span>
                                      <span className="font-bold tabular-nums" style={{ color: "#8a4a4a" }}>
                                        {headerStats.losses.toLocaleString()}
                                      </span>
                                    </span>
                                    <span>
                                      <span style={{ color: "#5a6a7a" }}>Ties: </span>
                                      <span className="font-bold tabular-nums" style={{ color: "#5a6a7a" }}>
                                        {headerStats.ties.toLocaleString()}
                                      </span>
                                    </span>
                                  </span>
                                )}
                              </>
                            )}
                          </div>
                          {headerStats.recent && (
                            <div>
                              <span style={{ color: "#0b162a" }}>{recentLabel}: </span>
                              <span className="font-bold tabular-nums" style={{ color: "#343434" }}>
                                {headerStats.recent.score1}–{headerStats.recent.score2}
                              </span>
                              {headerStats.recent.date && (
                                <span className="font-bold" style={{ color: "#343434" }}>
                                  {" "}
                                  · {formatMetaDate(headerStats.recent.date)}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </>
              );
            })()}
        </header>
      ) : (
        <NavBar
          totalGames={headerStats?.totalGames}
          uniqueScores={headerStats?.uniqueScores}
        />
      )}

      <main className={`flex-1 mx-auto w-full px-4 py-4 ${variant === "single" ? "max-w-[1150px]" : "max-w-5xl"}`}>
        {/* Filters */}
        <div className={variant === "single" ? "mb-6" : "mb-3"}>
          <FilterBar {...filterProps} stacked={variant === "single"} />
        </div>

        {/* Heatmap — full width. Single-page: no card; grid sits on the gray canvas. */}
        <div className={variant === "single"
          ? "relative"
          : "relative bg-white dark:bg-[#252526] rounded-lg overflow-hidden min-h-[400px] md:min-h-[500px]"
        }>

          {variant !== "single" && (
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
          )}

          {isValidating && yearlyRows && (
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
              isLoading={isLoading && !view}
              scorigamiType={display?.scorigamiType ?? scorigamiType}
              club={display?.club ?? club}
              gridSize={gridSize}
              isGhostClick={isGhostClick}
              dark={variant !== "single"}
              colCount={variant === "single" ? 51 : undefined}
              rowCount={variant === "single" ? 41 : undefined}
              skeleton={false}
              bearigamiGrid={variant === "single"}
              revealed={variant === "single" ? revealed : true}
              onPainted={variant === "single" ? markRevealed : undefined}
              onToggleType={variant === "single"
                ? () => setScorigamiType(scorigamiType === "traditional" ? "home_away" : "traditional")
                : undefined
              }
            />
          )}
        </div>
      </main>

      {variant === "single" && <V2About />}

      <PageFooter />
    </div>
  );
}
