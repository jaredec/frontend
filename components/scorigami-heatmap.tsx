"use client";

import React, { useMemo, useState, useEffect, useRef } from "react";
import { Tooltip, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { X, Loader2, FilterX } from "lucide-react";
import { TEAM_NAMES } from "@/lib/mlb-data";

// --- Types & Helpers ---
type ScorigamiType = "oriented" | "traditional";
interface ApiRow {
  score1: number;
  score2: number;
  occurrences: number;
  last_date: string | null;
  last_home_team: string | null;
  last_visitor_team: string | null;
}
const formatDisplayDate = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
const freqText = (f: number) => f === 1 ? "1 Game" : `${f.toLocaleString()} Games`;

const TooltipContent = ({ className = "", ...props }: React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>) => (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        sideOffset={8}
        collisionPadding={10}
        className={"z-50 w-auto rounded-md bg-white dark:bg-gray-900 shadow-xl ring-1 ring-gray-200 dark:ring-gray-800 p-3 " + className}
        {...props}
      />
    </TooltipPrimitive.Portal>
);

// Constants
const MAX_DISPLAY_SCORE = 30;
const GRID_DIMENSION = MAX_DISPLAY_SCORE + 1;
const DESKTOP_CELL_SIZE = 22;
const DESKTOP_HEADER_CELL_SIZE = 36;
const hex = ["#f3f4f6", "#dbeafe", "#bfdbfe", "#93c5fd", "#60a5fa", "#3b82f6", "#2563eb", "#1d4ed8"];
const darkHex = ["#374151", "#dbeafe", "#bfdbfe", "#93c5fd", "#60a5fa", "#3b82f6", "#2563eb", "#1d4ed8"];

const HeatmapLegend = ({ isDarkMode }: { isDarkMode: boolean }) => {
    const colors = (isDarkMode ? darkHex : hex).slice(1);
    return (
        <div className="flex items-center justify-center space-x-2 mt-4">
            <span className="text-xs text-slate-500 dark:text-slate-400">Fewer</span>
            <div className="flex">
                {colors.map((color, i) => (
                    <div key={i} className="h-3 sm:h-4 w-4 sm:w-6 rounded-sm" style={{ backgroundColor: color }} />
                ))}
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400">More</span>
        </div>
    );
};

const StatusIndicator = ({ type }: { type: 'loading' | 'empty' }) => {
    if (type === 'empty') {
        return (
            <div className="flex flex-col items-center justify-center p-6 text-center">
                <FilterX className="w-12 h-12 text-amber-500 mb-4" />
                <h3 className="text-xl font-semibold text-amber-700 dark:text-amber-300">No Games Found</h3>
                <p className="text-amber-600 dark:text-amber-400 mt-1 max-w-sm">No games match the selected filters.</p>
            </div>
        );
    }
    // Loading state
    return (
        <div className="flex flex-col items-center justify-center p-6 text-center">
            <Loader2 className="w-12 h-12 text-blue-500 mb-4 animate-spin" />
            <p className="text-lg font-medium text-slate-600 dark:text-slate-300">Initializing Grid...</p>
        </div>
    );
};

interface ScorigamiHeatmapProps {
  rows: ApiRow[] | undefined;
  isLoading: boolean;
  scorigamiType: ScorigamiType;
  club: string;
}

export default function ScorigamiHeatmap({ rows, isLoading, scorigamiType, club }: ScorigamiHeatmapProps) {
  const hasData = useMemo(() => !!rows && rows.length > 0, [rows]);

  const [data, setData] = useState<Record<string, ApiRow | undefined>>({});
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [cellSize, setCellSize] = useState(DESKTOP_CELL_SIZE);
  const [headerCellSize, setHeaderCellSize] = useState(DESKTOP_HEADER_CELL_SIZE);
  const gridContainerRef = useRef<HTMLDivElement>(null);
  const [activeCellKey, setActiveCellKey] = useState<string | null>(null);

  // ▼▼▼ CORRECTED AXIS LABELS ▼▼▼
  const yAxisTextLabel = useMemo(() => scorigamiType === 'traditional' ? 'Losing Score' : club === 'ALL' ? 'Visitor Score' : 'Opponent Score', [scorigamiType, club]);
  const xAxisTextLabel = useMemo(() => scorigamiType === 'traditional' ? 'Winning Score' : club === 'ALL' ? 'Home Score' : `${TEAM_NAMES[club] ?? club} Score`, [scorigamiType, club]);

  const maxOccurrencesInView = useMemo(() => {
    if (!rows || rows.length === 0) return 1;
    const maxOcc = Math.max(...rows.map(row => Number(row.occurrences)));
    return maxOcc === 0 ? 1 : maxOcc;
  }, [rows]);

  useEffect(() => {
    if (!rows || rows.length === 0) { setData({}); return; }
    const map: Record<string, ApiRow> = {};
    rows.forEach((r) => (map[`${r.score1}-${r.score2}`] = r));
    setData(map);
  }, [rows]);

  const [activeY, activeX] = useMemo(() => activeCellKey ? activeCellKey.split('-').map(Number) : [null, null], [activeCellKey]);
  
  const getLogScaledColor = (currentOccurrences: number, maxInView: number) => {
    const currentHex = isDarkMode ? darkHex : hex;
    if (currentOccurrences === 0) return currentHex[0];
    const colorsForOccurrences = currentHex.slice(1);
    const numColors = colorsForOccurrences.length;
    const logOccurrences = Math.log1p(currentOccurrences);
    const maxLogOccurrences = Math.log1p(maxInView);
    if (maxLogOccurrences > 0 && maxLogOccurrences === logOccurrences) return colorsForOccurrences[numColors - 1];
    const ratio = maxLogOccurrences > 0 ? logOccurrences / maxLogOccurrences : 0;
    let colorIndex = Math.floor(ratio * numColors);
    colorIndex = Math.min(colorIndex, numColors - 1);
    return colorsForOccurrences[colorIndex];
  };

  useEffect(() => {
    const calculateSize = () => {
        if (!gridContainerRef.current) return;
        const containerWidth = gridContainerRef.current.offsetWidth;
        const PADDING = window.innerWidth < 640 ? 32 : 48;
        const availableWidth = containerWidth - PADDING;
        const totalUnits = GRID_DIMENSION + 1.2;
        const dynamicCellSize = Math.floor(availableWidth / totalUnits);
        
        setCellSize(Math.max(6, Math.min(DESKTOP_CELL_SIZE, dynamicCellSize)));
        setHeaderCellSize(Math.max(12, Math.min(DESKTOP_HEADER_CELL_SIZE, dynamicCellSize * 1.2)));
    };

    if (hasData) {
        calculateSize();
        window.addEventListener('resize', calculateSize);
        return () => window.removeEventListener('resize', calculateSize);
    }
  }, [hasData]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setIsDarkMode(mediaQuery.matches);
    const handler = (e: MediaQueryListEvent) => setIsDarkMode(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);
  
  if (isLoading) {
    return <div className="flex min-h-[450px] w-full items-center justify-center"><StatusIndicator type="loading" /></div>;
  }
  if (!hasData) {
    return <div className="flex min-h-[450px] w-full items-center justify-center"><StatusIndicator type="empty" /></div>;
  }

  return (
    <TooltipProvider delayDuration={150}>
      <div ref={gridContainerRef} className="p-4 sm:p-6 flex flex-col items-center justify-center">
        <div className="flex flex-col items-center">
            <div style={{ paddingLeft: `${headerCellSize}px`}} className="text-center pb-2 pt-1">
                <span className="text-xs sm:text-base font-semibold text-slate-700 dark:text-slate-300 tracking-wide">{xAxisTextLabel}</span>
            </div>
            <div className="flex">
                <div style={{ width: `${headerCellSize}px`}} className="flex-none flex items-center justify-center pr-2">
                    <div className="transform -rotate-90 whitespace-nowrap text-xs sm:text-base font-semibold text-slate-700 dark:text-slate-300 tracking-wide">{yAxisTextLabel}</div>
                </div>
                <div className="relative border border-slate-300 dark:border-slate-700/80 rounded-sm overflow-hidden" style={{ width: `${headerCellSize + GRID_DIMENSION * cellSize}px`, height: `${headerCellSize + GRID_DIMENSION * cellSize}px`}}>
                    <div style={{ display: "grid", gridTemplateColumns: `${headerCellSize}px repeat(${GRID_DIMENSION}, ${cellSize}px)`, gridTemplateRows: `${headerCellSize}px repeat(${GRID_DIMENSION}, ${cellSize}px)`}}>
                        <div className="border-r border-b border-slate-200/80 dark:border-slate-700/60 bg-slate-50 dark:bg-slate-800/30"></div>
                        {Array.from({ length: GRID_DIMENSION }).map((_, i) => (
                        <div key={`col-header-${i}`} className={`flex items-center justify-center border-r border-b border-slate-200/80 dark:border-slate-700/60 text-[7px] sm:text-[9px] md:text-xs font-medium text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/30 transition-colors ${activeX === i ? 'bg-slate-200 dark:bg-slate-700' : ''}`}>{i}</div>
                        ))}
                        {Array.from({ length: GRID_DIMENSION }).map((_, score2_iterator) => (
                        <React.Fragment key={`row-frag-${score2_iterator}`}>
                            <div className={`flex items-center justify-center border-r border-b border-slate-200/80 dark:border-slate-700/60 text-[7px] sm:text-[9px] md:text-xs font-medium text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/30 transition-colors ${activeY === score2_iterator ? 'bg-slate-200 dark:bg-slate-700' : ''}`}>{score2_iterator}</div>
                            {Array.from({ length: GRID_DIMENSION }).map((_, score1_iterator) => {
                                const k = `${score1_iterator}-${score2_iterator}`;
                                const rowData = data[k];
                                const f = rowData?.occurrences ?? 0;
                                const isActive = activeCellKey === k;
                                return (
                                <Tooltip key={k} open={isActive} onOpenChange={(isOpen) => setActiveCellKey(isOpen ? k : null)}>
                                    <TooltipTrigger asChild>
                                    <div
                                        style={{ backgroundColor: getLogScaledColor(f, maxOccurrencesInView) }}
                                        className={`border-r border-b cursor-pointer transition-all duration-150 ease-in-out ${isActive ? 'ring-2 ring-offset-0 ring-blue-500 dark:ring-blue-400 z-20 shadow-lg' : 'border-slate-200/50 dark:border-slate-700/50'}`}
                                        onMouseEnter={() => { if ('ontouchstart' in window === false) setActiveCellKey(k) }}
                                        onMouseLeave={() => { if ('ontouchstart' in window === false) setActiveCellKey(null) }}
                                        onClick={() => setActiveCellKey(isActive ? null : k)}
                                    />
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <div className="flex flex-col items-start text-left">
                                            <div className="flex justify-between items-center w-full">
                                            <span className="text-lg font-bold text-slate-900 dark:text-white leading-tight">{`${score1_iterator} - ${score2_iterator}`}</span>
                                            {'ontouchstart' in window && (
                                                <button onClick={() => setActiveCellKey(null)} className="p-1 -mr-1 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
                                                    <X className="w-4 h-4"/>
                                                </button>
                                            )}
                                            </div>
                                            <span className="text-sm text-slate-500 dark:text-slate-400">{freqText(f)}</span>
                                            {f > 0 && rowData?.last_date && (
                                            <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-700 w-full text-xs space-y-0.5">
                                                <div className="font-medium text-slate-600 dark:text-slate-300">Last Occurrence:</div>
                                                <div className="text-slate-500 dark:text-slate-400">{formatDisplayDate(rowData.last_date)}</div>
                                                <div className="text-slate-500 dark:text-slate-400">{rowData.last_home_team} vs {rowData.last_visitor_team}</div>
                                            </div>
                                            )}
                                        </div>
                                    </TooltipContent>
                                </Tooltip>
                                );
                            })}
                        </React.Fragment>
                        ))}
                    </div>
                </div>
            </div>
        </div>
        <HeatmapLegend isDarkMode={isDarkMode} />
      </div>
    </TooltipProvider>
  );
}