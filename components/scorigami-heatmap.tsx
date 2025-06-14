"use client";

import React from 'react';
import { useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import {
  Tooltip,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import * as Select from "@radix-ui/react-select";
import * as RadioGroup from '@radix-ui/react-radio-group';
import { ChevronDown, ChevronUp, AlertTriangle, Loader2, FilterX } from "lucide-react";

/* ───────── Types ───────── */
type ScorigamiType = "oriented" | "traditional";

interface ApiRow {
  score1: number; // Y-Axis: Visitor / Opponent / Losing
  score2: number; // X-Axis: Home / Selected Team / Winning
  occurrences: number;
  last_date: string | null;
  last_home_team: string | null;
  last_visitor_team: string | null;
}

/* ───────── Helpers ───────── */
const formatDisplayDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });

const freqText = (f: number) => {
    if (f === 1) return "1 Game";
    return `${f.toLocaleString()} Games`;
}

type TCProps = React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>;
const TooltipContent = ({ className = "", ...props }: TCProps) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      side="right"
      sideOffset={8}
      className={
        "z-50 w-auto rounded-md bg-white dark:bg-gray-900 shadow-xl ring-1 ring-gray-200 " +
        "dark:ring-gray-800 p-3 " +
        className
      }
      {...props}
    />
  </TooltipPrimitive.Portal>
);

/* ───────── Teams Data ───────── */
const CURRENT_FRANCHISE_CODES = [
  "ANA", "ARI", "ATL", "BAL", "BOS", "CHA", "CHN", "CIN", "CLE", "COL",
  "DET", "HOU", "KCA", "LAN", "MIA", "MIL", "MIN", "NYA", "NYN",
  "OAK", "PHI", "PIT", "SDN", "SEA", "SFN", "SLN", "TBA", "TEX", "TOR", "WAS",
] as const;

type FranchiseCode = typeof CURRENT_FRANCHISE_CODES[number];

const TEAM_NAMES: Record<string, string> = {
  ANA: "Los Angeles Angels", ARI: "Arizona Diamondbacks", ATL: "Atlanta Braves",
  BAL: "Baltimore Orioles", BOS: "Boston Red Sox", CHA: "Chicago White Sox",
  CHN: "Chicago Cubs", CIN: "Cincinnati Reds", CLE: "Cleveland Guardians",
  COL: "Colorado Rockies", DET: "Detroit Tigers", HOU: "Houston Astros",
  KCA: "Kansas City Royals", LAN: "Los Angeles Dodgers", MIA: "Miami Marlins",
  MIL: "Milwaukee Brewers", MIN: "Minnesota Twins", NYA: "New York Yankees",
  NYN: "New York Mets", OAK: "Oakland Athletics", PHI: "Philadelphia Phillies",
  PIT: "Pittsburgh Pirates", SDN: "San Diego Padres", SEA: "Seattle Mariners",
  SFN: "San Francisco Giants", SLN: "St. Louis Cardinals", TBA: "Tampa Bay Rays",
  TEX: "Texas Rangers", TOR: "Toronto Blue Jays", WAS: "Washington Nationals",
};

/* ───────── Date Filter Years ───────── */
const CURRENT_YEAR = new Date().getFullYear();
const EARLIEST_MLB_YEAR = 1871;
const YEARS_FOR_DROPDOWN: string[] = ["ALL"];
for (let y = CURRENT_YEAR; y >= EARLIEST_MLB_YEAR; y--) {
  YEARS_FOR_DROPDOWN.push(y.toString());
}

/* ───────── Misc constants ───────── */
const CELL_SIZE = 22; 
const HEADER_CELL_SIZE = 36; 
const fetcher = (u: string) => fetch(u).then((r) => r.json());
const MAX_DISPLAY_SCORE = 30;
const GRID_DIMENSION = MAX_DISPLAY_SCORE + 1; 

const hex = ["#f3f4f6", "#dbeafe", "#bfdbfe", "#93c5fd", "#60a5fa", "#3b82f6", "#2563eb", "#1d4ed8"];
const darkHex = ["#374151", "#dbeafe", "#bfdbfe", "#93c5fd", "#60a5fa", "#3b82f6", "#2563eb", "#1d4ed8"];

const HeatmapLegend = ({ isDarkMode }: { isDarkMode: boolean }) => {
    const colors = (isDarkMode ? darkHex : hex).slice(1);
    return (
        <div className="flex items-center justify-center space-x-2 mt-4">
            <span className="text-xs text-gray-500 dark:text-gray-400">Fewer games</span>
            <div className="flex">
                {colors.map((color, i) => (
                    <div key={i} className="h-4 w-6 rounded-sm" style={{ backgroundColor: color }} />
                ))}
            </div>
            <span className="text-xs text-gray-500 dark:text-gray-400">More games</span>
        </div>
    );
};

/* ───────── Component ───────── */
export default function ScorigamiHeatmap() {
  const [scorigamiType, setScorigamiType] = useState<ScorigamiType>('traditional');
  const [club, setClub] = useState<FranchiseCode | "ALL">("ALL");
  const [selectedYear, setSelectedYear] = useState<string>("ALL");

  const { data: rows, error, isLoading } = useSWR<ApiRow[]>(
    `/api/scorigami?team=${club}&year=${selectedYear}&type=${scorigamiType}`,
    fetcher
  );

  const lastRows = useRef<ApiRow[] | null>(null);
  if (rows) lastRows.current = rows;
  const effectiveRows = rows ?? lastRows.current; 
  const hasData = !!effectiveRows && effectiveRows.length > 0;

  const [data, setData] = useState<Record<string, ApiRow | undefined>>({});
  useEffect(() => {
    if (!effectiveRows || effectiveRows.length === 0) {
      setData({});
      return;
    }
    const map: Record<string, ApiRow> = {};
    effectiveRows!.forEach((r) => (map[`${r.score1}-${r.score2}`] = r));
    setData(map);
  }, [effectiveRows]);

  const [hover, setHover] = useState<string | null>(null);

  const [hoveredY, hoveredX] = useMemo(() => {
    return hover ? hover.split('-').map(Number) : [null, null];
  }, [hover]);

  const sortedTeamsForDropdown = useMemo(() => {
    return CURRENT_FRANCHISE_CODES
      .map(code => ({ code, name: TEAM_NAMES[code] ?? code }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, []);

  const totalGamesDisplayed = useMemo(() => {
    if (!effectiveRows || effectiveRows.length === 0) return 0;
    return effectiveRows.reduce((sum, row) => sum + Number(row.occurrences), 0);
  }, [effectiveRows]);

  const maxOccurrencesInView = useMemo(() => {
    if (!effectiveRows || effectiveRows.length === 0) return 1;
    const maxOcc = Math.max(...effectiveRows.map(row => Number(row.occurrences)));
    return maxOcc === 0 ? 1 : maxOcc;
  }, [effectiveRows]);

  const [isDarkMode, setIsDarkMode] = useState(false);
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setIsDarkMode(mediaQuery.matches);
    const handler = (e: MediaQueryListEvent) => setIsDarkMode(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  const getLogScaledColor = (currentOccurrences: number, maxInView: number) => {
    const currentHex = isDarkMode ? darkHex : hex;
    if (currentOccurrences === 0) return currentHex[0];
    const colorsForOccurrences = currentHex.slice(1);
    const numColors = colorsForOccurrences.length;
    const logOccurrences = Math.log1p(currentOccurrences);
    const maxLogOccurrences = Math.log1p(maxInView);
    if (maxLogOccurrences === Math.log1p(1) && logOccurrences === Math.log1p(1)) {
         return colorsForOccurrences[numColors - 1];
    }
    const ratio = maxLogOccurrences > 0 ? logOccurrences / maxLogOccurrences : 0;
    let colorIndex = Math.floor(ratio * numColors);
    colorIndex = Math.min(colorIndex, numColors - 1);
    colorIndex = Math.max(0, colorIndex);
    return colorsForOccurrences[colorIndex];
  };

  const yAxisTextLabel = scorigamiType === 'traditional'
    ? 'Losing Score'
    : club === 'ALL'
      ? 'Visitor Team Score'
      : 'Opponent Score';

  const xAxisTextLabel = scorigamiType === 'traditional'
    ? 'Winning Score'
    : club === 'ALL'
      ? 'Home Team Score'
      : `${TEAM_NAMES[club as string] ?? club} Score`;

  const innerGridWidth = HEADER_CELL_SIZE + GRID_DIMENSION * CELL_SIZE;

  if (error) return (
    <div className="flex flex-col items-center justify-center p-6 sm:p-10 bg-red-50 dark:bg-red-900/30 rounded-xl shadow-lg min-h-[350px] text-center">
      <AlertTriangle className="w-14 h-14 text-red-500 dark:text-red-400 mb-5" />
      <h3 className="text-xl sm:text-2xl font-semibold text-red-700 dark:text-red-300 mb-2">Data Load Error</h3>
      <p className="text-red-600 dark:text-red-400 max-w-md">We encountered an issue while fetching the Scorigami data. Please try refreshing.</p>
    </div>
  );

  return (
    <TooltipProvider delayDuration={100}>
      <div className="bg-white dark:bg-gray-800/50 rounded-2xl shadow-2xl shadow-gray-500/10 dark:shadow-black/20 border border-gray-200/80 dark:border-gray-700/60 transition-all duration-300 ease-out">
        <div className="p-5 sm:p-6 border-b border-gray-200 dark:border-gray-700/60">
          <div className="flex flex-col sm:flex-row justify-between items-center mb-5 sm:mb-6">
            <h2 id="filter-controls-heading" className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-gray-100">Explore Scorigami</h2>
            {(hasData || (isLoading && lastRows.current)) && (
                 <p className="mt-2 sm:mt-0 text-sm text-gray-600 dark:text-gray-400">
                    <span className="font-semibold text-blue-600 dark:text-blue-400">{totalGamesDisplayed.toLocaleString()}</span> games in view
                    {isLoading && <Loader2 className="inline w-4 h-4 ml-2 animate-spin text-blue-500" />}
                </p>
            )}
          </div>
          
          <div className="mb-6">
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2 tracking-wide uppercase">Scorigami Type</label>
            <RadioGroup.Root
                className="grid grid-cols-2 gap-2 rounded-lg bg-gray-100 dark:bg-gray-700/60 p-1"
                value={scorigamiType}
                onValueChange={(val: string) => setScorigamiType(val as ScorigamiType)}
                aria-label="Select Scorigami Type"
            >
                <RadioGroup.Item value="traditional" id="rg-traditional" className="focus:outline-none">
                    <label htmlFor="rg-traditional" className={`flex flex-col items-center justify-center rounded-md px-3 py-2 text-sm font-medium whitespace-nowrap cursor-pointer transition-colors
                        ${scorigamiType === 'traditional' ? 'bg-white dark:bg-blue-600 text-blue-700 dark:text-white shadow' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600/50'}`}>
                        Traditional
                    </label>
                </RadioGroup.Item>
                <RadioGroup.Item value="oriented" id="rg-oriented" className="focus:outline-none">
                    <label htmlFor="rg-oriented" className={`flex flex-col items-center justify-center rounded-md px-3 py-2 text-sm font-medium whitespace-nowrap cursor-pointer transition-colors
                        ${scorigamiType === 'oriented' ? 'bg-white dark:bg-blue-600 text-blue-700 dark:text-white shadow' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600/50'}`}>
                        Oriented
                    </label>
                </RadioGroup.Item>
            </RadioGroup.Root>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
            <div>
              <label htmlFor="team-select-trigger" className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5 tracking-wide uppercase">Team</label>
              {/* ▼▼▼ CORRECTED: The 'any' type is removed for type safety ▼▼▼ */}
              <Select.Root value={club} onValueChange={(val: FranchiseCode | "ALL") => setClub(val)}>
                <Select.Trigger id="team-select-trigger" className="flex w-full items-center justify-between rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/60 px-4 py-2.5 text-sm sm:text-base text-gray-900 dark:text-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 hover:border-gray-400 dark:hover:border-gray-500 transition-colors">
                  <Select.Value aria-label={club}>{club === "ALL" ? "All Teams" : TEAM_NAMES[club] ?? club}</Select.Value>
                  <Select.Icon><ChevronDown className="h-5 w-5 text-gray-500 dark:text-gray-400" /></Select.Icon>
                </Select.Trigger>
                <Select.Portal> 
                  <Select.Content className="z-[99] max-h-80 w-[var(--radix-select-trigger-width)] overflow-y-auto rounded-lg border bg-white p-1.5 text-sm shadow-xl dark:bg-gray-800 dark:border-gray-700" position="popper" sideOffset={6}>
                    <Select.ScrollUpButton className="flex justify-center py-1 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"><ChevronUp className="h-4 w-4" /></Select.ScrollUpButton>
                    <Select.Viewport className="p-1">
                      <Select.Item key="ALL" value="ALL" className="cursor-pointer select-none rounded-md px-3 py-2 text-sm sm:text-base leading-none outline-none text-gray-800 dark:text-gray-100 data-[highlighted]:bg-blue-500 data-[highlighted]:text-white dark:data-[highlighted]:bg-blue-600">
                        <Select.ItemText>All Teams</Select.ItemText>
                      </Select.Item>
                      {sortedTeamsForDropdown.map((team) => (
                        <Select.Item key={team.code} value={team.code} className="cursor-pointer select-none rounded-md px-3 py-2 text-sm sm:text-base leading-none outline-none text-gray-800 dark:text-gray-100 data-[highlighted]:bg-blue-500 data-[highlighted]:text-white dark:data-[highlighted]:bg-blue-600">
                          <Select.ItemText>{team.name}</Select.ItemText>
                        </Select.Item>
                      ))}
                    </Select.Viewport>
                    <Select.ScrollDownButton className="flex justify-center py-1 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"><ChevronDown className="h-4 w-4" /></Select.ScrollDownButton>
                  </Select.Content>
                </Select.Portal>
              </Select.Root>
            </div>
            <div>
              <label htmlFor="year-select-trigger" className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5 tracking-wide uppercase">Year</label>
              <Select.Root value={selectedYear} onValueChange={(val) => setSelectedYear(val as string)}>
                <Select.Trigger id="year-select-trigger" className="flex w-full items-center justify-between rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/60 px-4 py-2.5 text-sm sm:text-base text-gray-900 dark:text-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 hover:border-gray-400 dark:hover:border-gray-500 transition-colors">
                  <Select.Value aria-label={selectedYear}>{selectedYear === "ALL" ? "All Years" : selectedYear}</Select.Value>
                  <Select.Icon><ChevronDown className="h-5 w-5 text-gray-500 dark:text-gray-400" /></Select.Icon>
                </Select.Trigger>
                 <Select.Portal>
                  <Select.Content className="z-[99] max-h-80 w-[var(--radix-select-trigger-width)] overflow-y-auto rounded-lg border bg-white p-1.5 text-sm shadow-xl dark:bg-gray-800 dark:border-gray-700" position="popper" sideOffset={6}>
                    <Select.ScrollUpButton className="flex justify-center py-1 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"><ChevronUp className="h-4 w-4" /></Select.ScrollUpButton>
                    <Select.Viewport className="p-1">
                      {YEARS_FOR_DROPDOWN.map((year) => (
                        <Select.Item key={year} value={year} className="cursor-pointer select-none rounded-md px-3 py-2 text-sm sm:text-base leading-none outline-none text-gray-800 dark:text-gray-100 data-[highlighted]:bg-blue-500 data-[highlighted]:text-white dark:data-[highlighted]:bg-blue-600">
                          <Select.ItemText>{year === "ALL" ? "All Years" : year}</Select.ItemText>
                        </Select.Item>
                      ))}
                    </Select.Viewport>
                    <Select.ScrollDownButton className="flex justify-center py-1 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"><ChevronDown className="h-4 w-4" /></Select.ScrollDownButton>
                  </Select.Content>
                </Select.Portal>
              </Select.Root>
            </div>
          </div>
        </div>
        
        <div className="p-3 sm:p-4 min-h-[400px] flex flex-col justify-center">
          {isLoading && !lastRows.current && !error && (
            <div className="flex-grow flex flex-col items-center justify-center p-6 text-center">
              <Loader2 className="w-12 h-12 text-blue-600 dark:text-blue-400 mb-4 animate-spin" />
              <p className="text-lg font-medium text-gray-600 dark:text-gray-300">Initializing Scorigami Grid...</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Fetching initial data.</p>
            </div>
          )}

          {!isLoading && !hasData && !error && (
            <div className="flex-grow flex flex-col items-center justify-center p-6 text-center">
                <FilterX className="w-14 h-14 text-yellow-500 dark:text-yellow-400 mb-5" />
                <h3 className="text-xl sm:text-2xl font-semibold text-yellow-700 dark:text-yellow-300 mb-2">No Scorigami Found</h3>
                <p className="text-yellow-600 dark:text-yellow-400 max-w-md mb-1">No Scorigami data matches your selection:</p>
                <p className="text-sm text-yellow-500 dark:text-yellow-500 font-medium">
                    {club === "ALL" ? "All Teams" : TEAM_NAMES[club] ?? club}
                    {selectedYear === "ALL" ? ", All Years" : ` in ${selectedYear}`}
                    {`, ${scorigamiType} mode`}
                </p>
                <p className="text-yellow-500 dark:text-yellow-500 text-sm mt-3">Try adjusting the filters.</p>
            </div>
          )}
          
          {(hasData || (isLoading && lastRows.current)) && !error && (
            <div className="flex flex-col items-center">
              <div className="inline-flex">
                <div className="flex-none w-16 sm:w-20 flex items-center justify-center pr-2 sm:pr-3">
                  <div className="transform -rotate-90 whitespace-nowrap text-sm sm:text-base font-semibold text-gray-700 dark:text-gray-300 tracking-wide">{yAxisTextLabel}</div>
                </div>

                <div className="flex flex-col min-w-0">
                  <div className="text-center pb-2 sm:pb-3 pt-1">
                    <span className="text-sm sm:text-base font-semibold text-gray-700 dark:text-gray-300 tracking-wide">{xAxisTextLabel}</span>
                  </div>

                  <div className="overflow-x-auto flex-grow pb-1 relative">
                    {isLoading && lastRows.current && (
                      <div className="absolute inset-0 bg-white/30 dark:bg-black/30 flex items-center justify-center z-30 backdrop-blur-sm">
                        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                      </div>
                    )}
                    <div className="heatmap-grid-inner border border-gray-300 dark:border-gray-600 rounded-sm" style={{ display: "grid", gridTemplateColumns: `${HEADER_CELL_SIZE}px repeat(${GRID_DIMENSION}, ${CELL_SIZE}px)`, gridTemplateRows: `${HEADER_CELL_SIZE}px repeat(${GRID_DIMENSION}, ${CELL_SIZE}px)`, width: `${innerGridWidth}px` }}>
                      <div style={{ gridColumn: 1, gridRow: 1 }} className="border-b border-r border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-700/50" />
                      
                      {Array.from({ length: GRID_DIMENSION }, (_, i) => {
                        const isHighlighted = i === hoveredX;
                        return (
                            <div
                              key={`col-header-${i}`}
                              style={{ gridColumn: i + 2, gridRow: 1 }}
                              className={`flex items-center justify-center border-b border-l border-gray-300 
                                        bg-gray-100/70 text-xs font-medium text-gray-600 dark:border-gray-600 dark:bg-gray-700/60 dark:text-gray-400
                                        transition-colors duration-150 ${isHighlighted ? 'bg-gray-300/80 dark:bg-gray-600' : ''}`}
                            >
                              {i}
                            </div>
                        )
                      })}

                      {Array.from({ length: GRID_DIMENSION }, (_, score1_iterator) => {
                          const isHighlighted = score1_iterator === hoveredY;
                          return (
                            <React.Fragment key={`row-data-${score1_iterator}`}>
                              <div
                                key={`row-header-${score1_iterator}`}
                                style={{ gridColumn: 1, gridRow: score1_iterator + 2 }}
                                className={`flex items-center justify-center border-r border-t border-gray-300 
                                          bg-gray-100/70 text-xs font-medium text-gray-600 dark:border-gray-600 dark:bg-gray-700/60 dark:text-gray-400
                                          transition-colors duration-150 ${isHighlighted ? 'bg-gray-300/80 dark:bg-gray-600' : ''}`}
                              >
                                {score1_iterator}
                              </div>
                              {Array.from({ length: GRID_DIMENSION }, (_, score2_iterator) => { 
                                const k = `${score1_iterator}-${score2_iterator}`;
                                const rowData = data[k]; 
                                const f = rowData?.occurrences ?? 0;
                                const isActive = hover === k;
                                const tooltipScoreLine = `${score2_iterator} - ${score1_iterator}`;
                               
                                return (
                                  <Tooltip key={k}>
                                    <TooltipTrigger asChild>
                                      <div
                                        style={{
                                          gridColumn: score2_iterator + 2, 
                                          gridRow: score1_iterator + 2,    
                                          backgroundColor: getLogScaledColor(f, maxOccurrencesInView),
                                        }}
                                        className={`border-t border-l cursor-pointer transition-colors duration-150 ease-in-out group relative
                                          ${isActive ? "ring-2 ring-offset-0 ring-blue-500 dark:ring-blue-400 z-20 shadow-lg" 
                                                  : "border-gray-200 dark:border-gray-700/80"}
                                          hover:border-gray-400 dark:hover:border-gray-500 hover:z-10`}
                                        onMouseEnter={() => setHover(k)}
                                        onMouseLeave={() => setHover(null)}
                                      >
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent> 
                                      <div className="flex flex-col items-start text-left">
                                          <div className="flex flex-col">
                                            <span className="text-sm font-semibold text-gray-900 dark:text-white leading-tight">
                                              {tooltipScoreLine}
                                            </span>
                                            <span className="text-sm text-gray-500 dark:text-gray-400">
                                              {freqText(f)}
                                            </span>
                                          </div>
                                          {f > 0 && rowData?.last_date && (
                                              <div className="mt-2 w-full"> 
                                                  <div className="text-xs text-gray-400 dark:text-gray-500 space-y-0.5">
                                                      <div>Last occurrence:</div>
                                                      <div className='font-medium text-gray-600 dark:text-gray-300'>
                                                          {formatDisplayDate(rowData.last_date)}
                                                      </div>
                                                      <div className='font-medium text-gray-600 dark:text-gray-300'>
                                                        {rowData.last_home_team}
                                                        {' vs '}
                                                        {rowData.last_visitor_team}
                                                      </div>
                                                  </div>
                                              </div>
                                          )}
                                      </div>
                                    </TooltipContent>
                                  </Tooltip>
                                );
                              })}
                            </React.Fragment>
                          )
                      })}
                    </div>
                  </div>
                  
                  <HeatmapLegend isDarkMode={isDarkMode} />

                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}