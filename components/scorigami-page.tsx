"use client";

import React, { useState, useMemo, useEffect, useLayoutEffect, useRef, useCallback, startTransition } from "react";
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
import { getTeamTheme } from "@/lib/team-theme.mjs";
import { decodeYearly, recordsForFilter, staticDataUrl, yearlyForFilter } from "@/lib/static-data.mjs";

type RecordRow = { year: number; game_type: string; wins: number; losses: number; ties: number };
type StaticData = { rows: YearlyRow[]; records: RecordRow[] | null; typed: boolean };

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

// Two-URL fetcher: try the primary, fall back to the secondary on any failure.
// Encoded as "primary|fallback" in the SWR key.
const fetcher = async (key: string): Promise<StaticData> => {
  const [primary, fallback] = key.includes("|") ? key.split("|") : [key, null];
  try {
    const r = await fetch(primary);
    if (r.ok) return decodeYearly(await r.json()) as StaticData;
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
  return decodeYearly(json) as StaticData;
};

const apiKey = (club: string, scorigamiType: string, gameFilter: string) =>
  `/api/scorigami?team=${club}&type=${scorigamiType}&mode=yearly&gameFilter=${gameFilter}`;

// Static files carry every game type, so one key per team+type serves all game
// filters and switching them never refetches. The API fallback is "all" only;
// see filteredKey for filtered views when the static file is unavailable.
function buildDataKey(club: string, scorigamiType: string, gameFilter: string): string {
  const staticUrl = staticDataUrl(club, scorigamiType);
  if (!USE_STATIC_JSON || !staticUrl) return apiKey(club, scorigamiType, gameFilter);
  return `${staticUrl}|${apiKey(club, scorigamiType, "all")}`;
}

const SWR_OPTS = {
  revalidateOnFocus: false,
  revalidateIfStale: false,
  dedupingInterval: 3600000,
} as const;


function whenIdle(fn: () => void): () => void {
  if (typeof window.requestIdleCallback === "function") {
    const id = window.requestIdleCallback(fn, { timeout: 3000 });
    return () => window.cancelIdleCallback(id);
  }
  const id = window.setTimeout(fn, 1500);
  return () => window.clearTimeout(id);
}

type AggRow = {
  score1: number;
  score2: number;
  occurrences: number;
  last_date: string | null;
  last_home_team: string | null;
  last_visitor_team: string | null;
  last_home_score?: number | null;
  last_visitor_score?: number | null;
  last_game_id: number | string | null;
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
        last_home_score: row.last_home_score ?? null,
        last_visitor_score: row.last_visitor_score ?? null,
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
        existing.last_home_score = row.last_home_score ?? null;
        existing.last_visitor_score = row.last_visitor_score ?? null;
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
  records: RecordRow[] | null,
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
  } else if (statsType === "traditional" && records) {
    wins = 0;
    losses = 0;
    for (const r of records) {
      if (r.year < yearRange[0] || r.year > yearRange[1]) continue;
      wins += r.wins;
      losses += r.losses;
      ties += r.ties;
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
  const [yearMode, setYearMode] = useState<"single" | "range">("range");
  const [gameFilter, setGameFilter] = useState<GameFilter>("all");
  const [gridSize, setGridSize] = useState<GridSize>(36);
  const [gridExpanded, setGridExpanded] = useState(false);
  // Track when filter dropdowns close to suppress ghost clicks on heatmap
  const dropdownCloseTimeRef = useRef(0);
  const handleDropdownOpenChange = (open: boolean) => {
    if (!open) dropdownCloseTimeRef.current = Date.now();
  };
  const isGhostClick = () => Date.now() - dropdownCloseTimeRef.current < 400;

  // Warm the browser cache with every header logo so it swaps instantly (no
  // blank flash) when the filter changes. Single-page variant only. The images
  // are held so they stay in the memory cache; /logo3.svg is max-age=0 and
  // would otherwise revalidate on every swap.
  const warmLogosRef = useRef<HTMLImageElement[]>([]);
  useEffect(() => {
    if (variant !== "single") return;
    warmLogosRef.current = ["/logo3.svg", ...CURRENT_FRANCHISE_CODES.map((code) => getTeamLogoUrl(code))]
      .filter((url): url is string => Boolean(url))
      .map((url) => {
        const img = new window.Image();
        img.src = url;
        return img;
      });
  }, [variant]);

  // One file per team+type covers every game filter.
  const dataKey = useMemo(
    () => buildDataKey(club, scorigamiType, gameFilter),
    [club, scorigamiType, gameFilter]
  );

  const { cache } = useSWRConfig();

  const {
    data: baseData,
    error,
    isLoading,
    isValidating,
  } = useSWR<StaticData>(dataKey, fetcher, SWR_OPTS);

  // Only when the static file failed and we fell back to the "all" API rows.
  const filteredKey =
    USE_STATIC_JSON && baseData && !baseData.typed && gameFilter !== "all"
      ? apiKey(club, scorigamiType, gameFilter)
      : null;
  const { data: filteredData } = useSWR<StaticData>(filteredKey, fetcher, SWR_OPTS);

  // Team W/L on the traditional view comes from the file's records; older or
  // API-sourced data needs the home/away rows instead.
  const needHa =
    variant === "single" && club !== "ALL" && scorigamiType === "traditional" &&
    Boolean(baseData) && !baseData?.records;
  const haKey = needHa ? buildDataKey(club, "home_away", gameFilter) : null;
  const haFilteredKey = needHa && USE_STATIC_JSON && gameFilter !== "all" ? apiKey(club, "home_away", gameFilter) : null;
  const { data: haData } = useSWR<StaticData>(haKey, fetcher, SWR_OPTS);
  const { data: haFilteredData } = useSWR<StaticData>(
    haData && !haData.typed ? haFilteredKey : null,
    fetcher,
    SWR_OPTS,
  );

  type ViewSnap = {
    yearly: YearlyRow[];
    ha: YearlyRow[] | undefined;
    records: RecordRow[] | null;
    club: FranchiseCode | "ALL";
    scorigamiType: ScorigamiType;
    gameFilter: GameFilter;
    yearRange: [number, number];
  };
  const [view, setView] = useState<ViewSnap | null>(null);
  const shownViewRef = useRef(view);
  shownViewRef.current = view;
  const yearRangeRef = useRef(yearRange);
  yearRangeRef.current = yearRange;

  useLayoutEffect(() => {
    const cached = (key: string | null) =>
      key ? (cache.get(key)?.data as StaticData | undefined) : undefined;
    // Rows for this game filter: typed static rows filter locally; untyped
    // "all" rows need the server-filtered key.
    const forFilter = (base: StaticData | undefined, filteredApiKey: string | null) => {
      if (!base) return undefined;
      if (base.typed || gameFilter === "all" || !USE_STATIC_JSON) return yearlyForFilter(base.rows, gameFilter);
      return cached(filteredApiKey)?.rows;
    };

    const base = cached(dataKey);
    const cachedYearly = forFilter(base, apiKey(club, scorigamiType, gameFilter));
    if (!base || !cachedYearly) return;

    const records = recordsForFilter(base.records, gameFilter);
    const wantHa = variant === "single" && club !== "ALL" && scorigamiType === "traditional" && !records;
    const cachedHa = wantHa ? forFilter(cached(haKey), haFilteredKey) : undefined;
    if (wantHa && !cachedHa) return;

    const [spanMin, spanMax] = sliderSpan(cachedYearly, gameFilter);
    // Compared against the committed view, so a re-run while a transition is
    // still pending keeps treating the switch as a change.
    const shown = shownViewRef.current;
    const clubChanged = !!shown && shown.club !== club;
    const gameFilterChanged = !!shown && shown.gameFilter !== gameFilter;

    const [lo, hi] = yearRangeRef.current;
    let nextRange: [number, number];
    if (clubChanged || gameFilterChanged) {
      nextRange = [spanMin, spanMax];
    } else {
      const clampedLo = Math.max(lo, spanMin);
      const clampedHi = Math.min(hi, spanMax);
      nextRange = clampedLo > clampedHi ? [spanMin, spanMax] : [clampedLo, clampedHi];
    }

    const apply = () => {
      if (lo !== nextRange[0] || hi !== nextRange[1]) setYearRange(nextRange);
      setView({
        yearly: cachedYearly,
        ha: cachedHa,
        records,
        club,
        scorigamiType,
        gameFilter,
        yearRange: nextRange,
      });
    };
    // A team switch re-renders the whole grid; as a transition, the header's
    // new logo and title paint first instead of waiting on it (slow phones).
    if (clubChanged) startTransition(apply);
    else apply();
  }, [cache, dataKey, haKey, haFilteredKey, baseData, filteredData, haData, haFilteredData, club, scorigamiType, gameFilter, variant]);

  const dataYearBounds = useMemo<[number, number]>(() => {
    if (!view || !Array.isArray(view.yearly) || view.yearly.length === 0) {
      return [MIN_YEAR, CURRENT_YEAR];
    }
    return sliderSpan(view.yearly, view.gameFilter);
  }, [view]);

  // Once the grid is up, warm the likely next views off the critical path:
  // All Teams (from a team page) and the other view type.
  useEffect(() => {
    if (!baseData) return;
    const altType = scorigamiType === "traditional" ? "home_away" : "traditional";
    const keys = [
      ...(club !== "ALL" ? [buildDataKey("ALL", scorigamiType, gameFilter)] : []),
      buildDataKey(club, altType, gameFilter),
    ];
    return whenIdle(() => {
      for (const key of keys) if (!cache.get(key)?.data) preload(key, fetcher);
    });
  }, [cache, baseData, club, scorigamiType, gameFilter]);

  // Keyed on range values, not the selection, so picking a new team doesn't
  // rebuild (and re-render) the old grid while its data is swapped in.
  const synced =
    !!view &&
    view.club === club &&
    view.scorigamiType === scorigamiType &&
    view.gameFilter === gameFilter;
  const [rangeLo, rangeHi] = synced ? yearRange : view?.yearRange ?? yearRange;
  const display = useMemo(() => {
    if (!view) return null;
    const range: [number, number] = [rangeLo, rangeHi];
    const rows = aggregateRows(view.yearly, range);
    const stats = computeHeaderStats(
      rows,
      view.yearly,
      view.ha,
      view.records,
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
  }, [view, rangeLo, rangeHi]);

  const rows = display?.rows;
  const headerStats = display?.stats ?? null;
  const statsClub = display?.club ?? club;

  const theme = getTeamTheme(variant === "single" ? statsClub : "ALL");
  const themeVars = useMemo(
    () => ({ "--team-dark": theme.dark, "--team-accent": theme.accent, "--team-link": theme.link }),
    [theme]
  );
  // Dropdowns and tooltips portal to <body>, outside the wrapper's inline vars.
  useLayoutEffect(() => {
    const root = document.documentElement.style;
    for (const [k, v] of Object.entries(themeVars)) root.setProperty(k, v);
    return () => {
      for (const k of Object.keys(themeVars)) root.removeProperty(k);
    };
  }, [themeVars]);

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
    setYearMode("range");
  };

  const filterProps = {
    gameFilter,
    setGameFilter,
    club,
    setClub,
    yearRange,
    setYearRange,
    yearMode,
    setYearMode,
    dataYearBounds,
    sortedTeamsForDropdown,
    onDropdownOpenChange: handleDropdownOpenChange,
    onReset: handleReset,
    onPrefetchTeam: (code: FranchiseCode | "ALL") => {
      const key = buildDataKey(code, scorigamiType, gameFilter);
      if (!cache.get(key)?.data) preload(key, fetcher);
    },
  };

  // Memoized so renders that don't touch the grid (e.g. the header swapping to
  // a newly picked team) skip re-rendering ~1,700 cells.
  const heatmapLoading = isLoading && !view;
  const heatmapType = display?.scorigamiType ?? scorigamiType;
  const heatmapClub = display?.club ?? club;
  const heatmap = useMemo(
    () => (
      <ScorigamiHeatmap
        rows={rows}
        isLoading={heatmapLoading}
        scorigamiType={heatmapType}
        club={heatmapClub}
        gridSize={gridSize}
        isGhostClick={isGhostClick}
        dark={variant !== "single"}
        colCount={variant === "single" ? (gridExpanded ? 51 : 30) : undefined}
        rowCount={variant === "single" ? (gridExpanded ? 51 : 30) : undefined}
        skeleton={false}
        bearigamiGrid={variant === "single"}
        revealed={variant === "single" ? revealed : true}
        onPainted={variant === "single" ? markRevealed : undefined}
        onToggleType={variant === "single"
          ? () => setScorigamiType(scorigamiType === "traditional" ? "home_away" : "traditional")
          : undefined
        }
        onToggleExpand={variant === "single"
          ? () => setGridExpanded((v) => !v)
          : undefined
        }
        expanded={variant === "single" ? gridExpanded : false}
      />
    ),
    // isGhostClick only reads a ref, so a stale closure is fine.
    [rows, heatmapLoading, heatmapType, heatmapClub, gridSize, variant, gridExpanded, revealed, markRevealed, scorigamiType],
  );

  return (
    <div className="min-h-screen flex flex-col overflow-x-hidden" style={variant === "single" ? { backgroundColor: "#f2f2f2", fontFamily: "var(--v2-ui-font), system-ui, sans-serif", ...themeVars } : undefined}>
      {variant === "single" ? (
        <header className="max-w-[1150px] mx-auto w-full px-3 sm:px-4 pt-[15px] pb-2 sm:pb-3 text-center">
            {(() => {
              const igamiFor = (c: FranchiseCode | "ALL") =>
                c === "ALL" ? "MLB Scorigami" : (TEAM_IGAMI[c] ?? "MLB Scorigami");
              // Logo and title follow the selection at once; the stats below
              // follow the grid.
              const igamiTitle = igamiFor(club);
              const statsTitle = igamiFor(statsClub);
              const logoSrc = club === "ALL" ? "/logo3.svg" : (getTeamLogoUrl(club) ?? "/logo3.svg");
              const countLabel = "Unique scores";
              const shownRange = display?.yearRange ?? yearRange;
              const isSingleSeason = shownRange[0] === shownRange[1];
              const statsType = display?.scorigamiType ?? scorigamiType;
              const recentLabel = isSingleSeason
                ? "Rarest score"
                : statsClub !== "ALL"
                  ? `Last ${statsTitle}`
                  : statsType === "home_away"
                    ? (headerStats?.recent && headerStats.recent.score1 < headerStats.recent.score2
                        ? "Last Awayigami"
                        : "Last Homeigami")
                    : "Last Scorigami";
              return (
                <>
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 mt-5 mb-5 max-[459px]:mt-[30px]">
                    <div className="h-[88px] w-[88px] sm:h-[112px] sm:w-[115px] flex items-center justify-center flex-none">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={logoSrc}
                        alt={igamiTitle}
                        className={`object-contain ${
                          club === "ALL"
                            ? "h-[76px] w-[76px] sm:h-[96px] sm:w-[96px]"
                            : "h-full w-full"
                        }`}
                      />
                    </div>
                    <span
                      className="flex items-center sm:h-[77px] text-[36px] sm:text-[48px] leading-none tracking-tight text-[#343434] px-1"
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
                                  <span style={{ color: "var(--team-dark)" }}>{countLabel}: </span>
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
                                    <span style={{ color: "var(--team-dark)" }}>{countLabel}: </span>
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
                              <span style={{ color: "var(--team-dark)" }}>{recentLabel}: </span>
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

      <main className={`flex-1 mx-auto w-full px-4 ${variant === "single" ? "max-w-[1150px] pt-1 pb-4" : "max-w-5xl py-4"}`}>
        {/* Filters */}
        <div className={variant === "single" ? "mb-2" : "mb-3"}>
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

          {isValidating && baseData && (
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
            heatmap
          )}
        </div>
      </main>

      {variant === "single" && <V2About />}

      <PageFooter />
    </div>
  );
}
