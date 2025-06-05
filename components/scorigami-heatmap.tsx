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
import { ChevronDown, ChevronUp, AlertTriangle, Loader2, Info, FilterX } from "lucide-react";

/* ───────── Types ───────── */
interface ApiRow {
  score1: number;
  score2: number;
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

type TCProps = React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>;
const TooltipContent = ({ className = "", ...props }: TCProps) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      side="right"
      sideOffset={8}
      className={
        "z-50 rounded-md bg-white dark:bg-gray-950 shadow-xl ring-1 ring-gray-200 " +
        "dark:ring-gray-800 px-3.5 py-2.5 text-xs " +
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

const TEAM_CODE_TO_MODERN_FRANCHISE: Record<string, string> = {
  ANA: "ANA", ARI: "ARI", ATL: "ATL", BAL: "BAL", BLA: "NYA",
  BOS: "BOS", BR3: "LAN", BRO: "LAN", BS1: "ATL", BSN: "ATL",
  CAL: "ANA", CH1: "CHN", CH2: "CHN", CHA: "CHA", CHN: "CHN",
  CIN: "CIN", CLE: "CLE", CN2: "CIN", COL: "COL", DET: "DET",
  FLO: "MIA", HOU: "HOU", KC1: "OAK", KCA: "KCA", LAA: "ANA",
  LAN: "LAN", MIA: "MIA", MIL: "MIL", MIN: "MIN", MLA: "BAL",
  MLN: "ATL", MON: "WAS", NY1: "SFN", NYA: "NYA", NYN: "NYN",
  OAK: "OAK", PHA: "OAK", PHI: "PHI", PIT: "PIT", PT1: "PIT",
  SDN: "SDN", SE1: "MIL", SEA: "SEA", SFN: "SFN", SL4: "SLN",
  SLA: "BAL", SLN: "SLN", TBA: "TBA", TEX: "TEX", TOR: "TOR",
  WAS: "WAS", WS1: "MIN", WS2: "TEX"
};
CURRENT_FRANCHISE_CODES.forEach(code => {
    if (!TEAM_CODE_TO_MODERN_FRANCHISE[code]) {
        TEAM_CODE_TO_MODERN_FRANCHISE[code] = code;
    }
});

const getDisplayTeamName = (apiTeamCode: string | null): string => {
  if (!apiTeamCode) return "N/A";
  const modernFranchiseCode = TEAM_CODE_TO_MODERN_FRANCHISE[apiTeamCode] ?? apiTeamCode;
  return TEAM_NAMES[modernFranchiseCode] ?? modernFranchiseCode;
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

const hex = [
  "#f3f4f6", 
  "#dbeafe", "#bfdbfe", "#93c5fd", "#60a5fa",
  "#3b82f6", "#2563eb", "#1d4ed8",
];
const darkHex = [ 
    "#374151", 
    "#dbeafe", "#bfdbfe", "#93c5fd", "#60a5fa",
    "#3b82f6", "#2563eb", "#1d4ed8",
];

const freqText = (f: number) =>
  f === 0 ? "Never Happened" : f === 1 ? "Happened Once" : `Happened ${f.toLocaleString()} Times`;

/* ───────── Component ───────── */
export default function ScorigamiHeatmap() {
  const [club, setClub] = useState<(typeof CURRENT_FRANCHISE_CODES[number] | "ALL")>("ALL");
  const [selectedYear, setSelectedYear] = useState<string>("ALL");

  const { data: rows, error, isLoading } = useSWR<ApiRow[]>(
    `/api/scorigami?team=${club}&year=${selectedYear}`,
    fetcher
  );

  const lastRows = useRef<ApiRow[] | null>(null);
  if (rows) lastRows.current = rows;
  // Use SWR's 'rows' if available (new data), otherwise fall back to 'lastRows.current' (stale data)
  // This allows the UI to show old data while new data is loading after a filter change.
  const effectiveRows = rows ?? lastRows.current; 
  const hasData = !!effectiveRows && effectiveRows.length > 0;

  const [data, setData] = useState<Record<string, ApiRow | undefined>>({});
  useEffect(() => {
    if (!effectiveRows || effectiveRows.length === 0) { // Use effectiveRows here
      setData({});
      return;
    }
    const map: Record<string, ApiRow> = {};
    effectiveRows!.forEach((r) => (map[`${r.score1}-${r.score2}`] = r));
    setData(map);
  }, [effectiveRows]); // Depend on effectiveRows

  const [hover, setHover] = useState<string | null>(null);

  const sortedTeamsForDropdown = useMemo(() => {
    return CURRENT_FRANCHISE_CODES
      .map(code => ({ code, name: TEAM_NAMES[code] ?? code }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, []);

  const totalGamesDisplayed = useMemo(() => {
    if (!effectiveRows || effectiveRows.length === 0) return 0;
    return effectiveRows.reduce((sum, row) => {
      return sum + Number(row.occurrences);
    }, 0);
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

  const yAxisTextLabel = club === "ALL" ? "Home Team Score" : `${TEAM_NAMES[club as string] ?? club} Score`;
  const xAxisTextLabel = club === "ALL" ? "Visitor Team Score" : "Opponent Score";

  const innerGridWidth = HEADER_CELL_SIZE + GRID_DIMENSION * CELL_SIZE;

  // If there's a critical error fetching data, show an error message.
  // This still takes over the component view as it's a significant issue.
  if (error) return (
    <div className="flex flex-col items-center justify-center p-6 sm:p-10 bg-red-50 dark:bg-red-900/30 rounded-xl shadow-lg min-h-[350px] text-center">
      <AlertTriangle className="w-14 h-14 text-red-500 dark:text-red-400 mb-5" />
      <h3 className="text-xl sm:text-2xl font-semibold text-red-700 dark:text-red-300 mb-2">Data Load Error</h3>
      <p className="text-red-600 dark:text-red-400 max-w-md">
        We encountered an issue while fetching the Scorigami data. Please try refreshing.
      </p>
    </div>
  );

  // The main component structure is always rendered.
  // Loading states and data presence will determine what's shown *inside* the heatmap panel.
  return (
    <TooltipProvider delayDuration={200}>
      <div className="mx-auto w-full space-y-6 sm:space-y-8">
        
        {/* Controls Section - Always visible and interactive */}
        <section aria-labelledby="filter-controls-heading" className="bg-white dark:bg-gray-800/60 p-5 sm:p-6 rounded-xl shadow-2xl shadow-gray-500/10 dark:shadow-black/20 border border-gray-200 dark:border-gray-700/80 transition-all duration-300 ease-out">
          <div className="flex flex-col sm:flex-row justify-between items-center mb-5 sm:mb-6">
            <h2 id="filter-controls-heading" className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-gray-100">
              Explore Scorigami
            </h2>
            {/* Show game count if we have data (stale or fresh) */}
            {(hasData || (isLoading && lastRows.current)) && ( // Show if there's any data or loading new data with old data present
                 <p className="mt-2 sm:mt-0 text-sm text-gray-600 dark:text-gray-400">
                    <span className="font-semibold text-blue-600 dark:text-blue-400">{totalGamesDisplayed.toLocaleString()}</span> games in view
                    {isLoading && <Loader2 className="inline w-4 h-4 ml-2 animate-spin text-blue-500" />} {/* Subtle loading indicator here */}
                </p>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
            <div>
              <label htmlFor="team-select-trigger" className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5 tracking-wide uppercase">
                Team
              </label>
              <Select.Root value={club} onValueChange={(val) => setClub(val as any)}>
                <Select.Trigger 
                  id="team-select-trigger"
                  className="flex w-full items-center justify-between rounded-lg border border-gray-300 dark:border-gray-600 
                             bg-gray-50 dark:bg-gray-700/60 px-4 py-2.5 text-sm sm:text-base text-gray-900 dark:text-gray-50
                             focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 hover:border-gray-400 dark:hover:border-gray-500 transition-colors"
                >
                  <Select.Value aria-label={club}>{club === "ALL" ? "All Teams" : TEAM_NAMES[club as string] ?? club}</Select.Value>
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
              <label htmlFor="year-select-trigger" className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5 tracking-wide uppercase">
                Year
              </label>
              <Select.Root value={selectedYear} onValueChange={(val) => setSelectedYear(val as string)}>
                <Select.Trigger
                  id="year-select-trigger"
                  className="flex w-full items-center justify-between rounded-lg border border-gray-300 dark:border-gray-600 
                             bg-gray-50 dark:bg-gray-700/60 px-4 py-2.5 text-sm sm:text-base text-gray-900 dark:text-gray-50
                             focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 hover:border-gray-400 dark:hover:border-gray-500 transition-colors"
                >
                  <Select.Value aria-label={selectedYear}>
                    {selectedYear === "ALL" ? "All Years" : selectedYear}
                  </Select.Value>
                  <Select.Icon><ChevronDown className="h-5 w-5 text-gray-500 dark:text-gray-400" /></Select.Icon>
                </Select.Trigger>
                 <Select.Portal>
                  <Select.Content
                    className="z-[99] max-h-80 w-[var(--radix-select-trigger-width)] overflow-y-auto rounded-lg border bg-white
                               p-1.5 text-sm shadow-xl dark:bg-gray-800 dark:border-gray-700"
                    position="popper" sideOffset={6}
                  >
                    <Select.ScrollUpButton className="flex justify-center py-1 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
                      <ChevronUp className="h-4 w-4" />
                    </Select.ScrollUpButton>
                    <Select.Viewport className="p-1">
                      {YEARS_FOR_DROPDOWN.map((year) => (
                        <Select.Item
                          key={year}
                          value={year}
                          className="cursor-pointer select-none rounded-md px-3 py-2 text-sm sm:text-base leading-none
                                     outline-none text-gray-800 dark:text-gray-100
                                     data-[highlighted]:bg-blue-500 data-[highlighted]:text-white
                                     dark:data-[highlighted]:bg-blue-600"
                        >
                          <Select.ItemText>{year === "ALL" ? "All Years" : year}</Select.ItemText>
                        </Select.Item>
                      ))}
                    </Select.Viewport>
                    <Select.ScrollDownButton className="flex justify-center py-1 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
                      <ChevronDown className="h-4 w-4" />
                    </Select.ScrollDownButton>
                  </Select.Content>
                </Select.Portal>
              </Select.Root>
            </div>
          </div>
        </section>

        {/* Heatmap Visualization Section - Content changes based on loading/data state */}
        <section 
          aria-labelledby="heatmap-visualization-heading" 
          className="bg-white dark:bg-gray-800/60 p-3 sm:p-4 rounded-xl shadow-2xl shadow-gray-500/10 dark:shadow-black/20 border border-gray-200 dark:border-gray-700/80 min-h-[400px] flex flex-col" // Added min-h and flex
        >
          {/* Conditional rendering for the content of this section */}
          {isLoading && !lastRows.current && !error && ( // Only show for initial load if no error
            <div className="flex-grow flex flex-col items-center justify-center p-6 text-center">
              <Loader2 className="w-12 h-12 text-blue-600 dark:text-blue-400 mb-4 animate-spin" />
              <p className="text-lg font-medium text-gray-600 dark:text-gray-300">Initializing Scorigami Grid...</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Fetching initial data.</p>
            </div>
          )}

          {!isLoading && !hasData && !error && ( // Finished loading, but no data found
            <div className="flex-grow flex flex-col items-center justify-center p-6 text-center">
                <FilterX className="w-14 h-14 text-yellow-500 dark:text-yellow-400 mb-5" />
                <h3 className="text-xl sm:text-2xl font-semibold text-yellow-700 dark:text-yellow-300 mb-2">No Scorigami Found</h3>
                <p className="text-yellow-600 dark:text-yellow-400 max-w-md mb-1">
                    No Scorigami data matches your selection:
                </p>
                <p className="text-sm text-yellow-500 dark:text-yellow-500 font-medium">
                    {club === "ALL" ? "All Teams" : TEAM_NAMES[club as string] ?? club}
                    {selectedYear === "ALL" ? ", All Years" : ` in ${selectedYear}`}
                </p>
                <p className="text-yellow-500 dark:text-yellow-500 text-sm mt-3">Try adjusting the team or year filters.</p>
            </div>
          )}
          
          {/* Render heatmap if data exists (stale or fresh), or if loading with stale data */}
          {(hasData || (isLoading && lastRows.current)) && !error && (
            <div className="flex flex-col flex-grow"> {/* Allow content to grow */}
              <div className="flex"> {/* Y-Axis Label Column and Main Chart Content */}
                <div className="flex-none w-16 sm:w-20 flex items-center justify-center pr-2 sm:pr-3">
                  <div 
                    className="transform -rotate-90 whitespace-nowrap text-sm sm:text-base font-semibold text-gray-700 dark:text-gray-300 tracking-wide"
                  >
                    {yAxisTextLabel}
                  </div>
                </div>

                <div className="flex-grow flex flex-col min-w-0">
                  <div className="text-center pb-2 sm:pb-3 pt-1">
                    <span className="text-sm sm:text-base font-semibold text-gray-700 dark:text-gray-300 tracking-wide">
                      {xAxisTextLabel}
                    </span>
                  </div>

                  <div className="overflow-x-auto flex-grow pb-1 relative"> {/* Added relative for potential overlay */}
                    {isLoading && lastRows.current && ( // Subtle loading overlay when showing stale data
                      <div className="absolute inset-0 bg-white/30 dark:bg-black/30 flex items-center justify-center z-30 backdrop-blur-sm">
                        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                      </div>
                    )}
                    <div 
                      className="heatmap-grid-inner border border-gray-300 dark:border-gray-600 rounded-sm"
                      style={{
                        display: "grid",
                        gridTemplateColumns: `${HEADER_CELL_SIZE}px repeat(${GRID_DIMENSION}, ${CELL_SIZE}px)`,
                        gridTemplateRows: `${HEADER_CELL_SIZE}px repeat(${GRID_DIMENSION}, ${CELL_SIZE}px)`,
                        width: `${innerGridWidth}px`,
                      }}
                    >
                      <div 
                        style={{ gridColumn: 1, gridRow: 1 }} 
                        className="border-b border-r border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-700/50" 
                      />
                      
                      {Array.from({ length: GRID_DIMENSION }, (_, i) => (
                        <div
                          key={`col-header-${i}`}
                          style={{ gridColumn: i + 2, gridRow: 1 }}
                          className="flex items-center justify-center border-b border-l border-gray-300 
                                    bg-gray-100/70 text-xs font-medium text-gray-600 dark:border-gray-600 dark:bg-gray-700/60 dark:text-gray-400"
                        >
                          {i}
                        </div>
                      ))}

                      {Array.from({ length: GRID_DIMENSION }, (_, score1_iterator) => (
                        <React.Fragment key={`row-data-${score1_iterator}`}>
                          <div
                            key={`row-header-${score1_iterator}`}
                            style={{ gridColumn: 1, gridRow: score1_iterator + 2 }}
                            className="flex items-center justify-center border-r border-t border-gray-300 
                                      bg-gray-100/70 text-xs font-medium text-gray-600 dark:border-gray-600 dark:bg-gray-700/60 dark:text-gray-400"
                          >
                            {score1_iterator}
                          </div>
                          {Array.from({ length: GRID_DIMENSION }, (_, score2_iterator) => { 
                            const k = `${score1_iterator}-${score2_iterator}`;
                            const rowData = data[k]; 
                            const f = rowData?.occurrences ?? 0;
                            const active = hover === k;
                            const tooltipScoreLine = club === "ALL" 
                              ? `Home ${score1_iterator} – Visitor ${score2_iterator}` 
                              : `${TEAM_NAMES[club as string] ?? club} ${score1_iterator} – Opponent ${score2_iterator}`;

                            return (
                              <Tooltip key={k}>
                                <TooltipTrigger asChild>
                                  <div
                                    style={{
                                      gridColumn: score2_iterator + 2, 
                                      gridRow: score1_iterator + 2,    
                                      backgroundColor: getLogScaledColor(f, maxOccurrencesInView),
                                      width: `${CELL_SIZE}px`,
                                      height: `${CELL_SIZE}px`,
                                    }}
                                    className={`border-t border-l cursor-pointer transition-all duration-100 ease-in-out group
                                      ${active ? "ring-2 ring-offset-0 ring-blue-500 dark:ring-blue-400 relative z-20 shadow-lg" 
                                              : "border-gray-200 dark:border-gray-700/80"}
                                      hover:border-gray-400 dark:hover:border-gray-500 hover:relative hover:z-10`}
                                    onMouseEnter={() => setHover(k)}
                                    onMouseLeave={() => setHover(null)}
                                  />
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs"> 
                                  <div className="mb-1.5 text-sm font-semibold text-gray-900 dark:text-gray-50">
                                    {tooltipScoreLine}
                                  </div>
                                  <div className="text-xs text-gray-700 dark:text-gray-300 mb-2">
                                    {freqText(f)}
                                  </div>
                                  {rowData?.last_date && (
                                    <>
                                      <hr className="my-1.5 border-gray-200 dark:border-gray-600" />
                                      <div className="space-y-1">
                                        <div className="font-medium text-xs text-gray-800 dark:text-gray-200">
                                          Last Occurence:
                                        </div>
                                        <div className="text-xs text-gray-600 dark:text-gray-400">
                                          {formatDisplayDate(rowData.last_date)}
                                        </div>
                                        <div className="text-xs text-gray-600 dark:text-gray-400">
                                          {getDisplayTeamName(rowData.last_home_team)}
                                          {" vs "}
                                          {getDisplayTeamName(rowData.last_visitor_team)}
                                        </div>
                                      </div>
                                    </>
                                  )}
                                </TooltipContent>
                              </Tooltip>
                            );
                          })}
                        </React.Fragment>
                      ))}
                    </div> {/* End of .heatmap-grid-inner */}
                  </div> {/* End of .scrollable-grid-container */}
                </div> {/* End of .main-chart-content */}
              </div> {/* End of .flex container for Y-Axis + Main Chart */}
            </div>
          )}
        </section>
      </div> {/* End of main page container */}
    </TooltipProvider>
  );
}