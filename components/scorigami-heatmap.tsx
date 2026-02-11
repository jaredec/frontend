"use client";

import React, { useMemo, useState, useEffect, useRef } from "react";
import { Tooltip, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { X, Loader2, FilterX } from "lucide-react";
import { TEAM_NAMES } from "@/lib/mlb-data";

type ScorigamiType = "home_away" | "traditional";

interface ApiRow {
  score1: number;
  score2: number;
  occurrences: number;
  last_date: string | null;
  last_home_team: string | null;
  last_visitor_team: string | null;
  last_game_id: number | null;
  source: string | null;
}

const formatDisplayDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });

const freqText = (f: number) =>
  f === 1 ? "1 game" : `${f.toLocaleString()} games`;

const TooltipContent = ({
  className = "",
  ...props
}: React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      sideOffset={8}
      collisionPadding={10}
      className={
        "z-50 w-auto rounded-md bg-white dark:bg-[#1e1e1e] shadow-lg border border-slate-200 dark:border-[#383838] p-3 " +
        className
      }
      {...props}
    />
  </TooltipPrimitive.Portal>
);

const DESKTOP_CELL_SIZE = 20;
const DESKTOP_HEADER_CELL_SIZE = 30;

const hex = [
  "#f3f4f6", "#dbeafe", "#bfdbfe", "#93c5fd", "#60a5fa",
  "#3b82f6", "#2563eb", "#1d4ed8", "#153bc0", "#0c248d",
];
const darkHex = [
  "#404040", "#60a5fa", "#3b82f6", "#2563eb", "#1d4ed8",
  "#153bc0", "#0c248d", "#0a1d74", "#08165c", "#040a2f",
];

const StatusIndicator = ({ type }: { type: "loading" | "empty" }) => {
  if (type === "empty") {
    return (
      <div className="flex flex-col items-center justify-center p-6 text-center">
        <FilterX className="w-10 h-10 text-slate-400 dark:text-slate-500 mb-3" />
        <h3 className="text-base font-medium text-slate-600 dark:text-slate-300">
          No Games Found
        </h3>
        <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
          No games match the selected filters.
        </p>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center justify-center p-6 text-center">
      <Loader2 className="w-8 h-8 text-blue-500 mb-3 animate-spin" />
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Loading data...
      </p>
    </div>
  );
};

function ColorLegend({ isDarkMode }: { isDarkMode: boolean }) {
  const colors = isDarkMode ? darkHex : hex;
  return (
    <div className="flex items-center gap-2 mt-4 justify-center">
      <span className="text-[10px] text-slate-400 dark:text-slate-500">Fewer</span>
      <div className="flex gap-px">
        {colors.map((color, i) => (
          <div
            key={i}
            className="w-4 h-3 first:rounded-l-sm last:rounded-r-sm"
            style={{ backgroundColor: color }}
          />
        ))}
      </div>
      <span className="text-[10px] text-slate-400 dark:text-slate-500">More</span>
    </div>
  );
}

interface ScorigamiHeatmapProps {
  rows: ApiRow[] | undefined;
  isLoading: boolean;
  scorigamiType: ScorigamiType;
  club: string;
  gridSize: number;
}

export default function ScorigamiHeatmap({
  rows,
  isLoading,
  scorigamiType,
  club,
  gridSize,
}: ScorigamiHeatmapProps) {
  const GRID_DIMENSION = gridSize;

  const hasData = useMemo(() => Array.isArray(rows) && rows.length > 0, [rows]);

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const checkSize = () => setIsMobile(window.innerWidth < 768);
    checkSize();
    window.addEventListener("resize", checkSize);
    return () => window.removeEventListener("resize", checkSize);
  }, []);

  const data = useMemo(() => {
    if (!Array.isArray(rows) || rows.length === 0) return {};
    const map: Record<string, ApiRow> = {};
    rows.forEach((r) => (map[`${r.score1}-${r.score2}`] = r));
    return map;
  }, [rows]);

  const [isDarkMode, setIsDarkMode] = useState(false);
  const [cellSize, setCellSize] = useState(DESKTOP_CELL_SIZE);
  const [headerCellSize, setHeaderCellSize] = useState(DESKTOP_HEADER_CELL_SIZE);
  const gridContainerRef = useRef<HTMLDivElement>(null);
  const [activeCellKey, setActiveCellKey] = useState<string | null>(null);
  const [hoveredCellKey, setHoveredCellKey] = useState<string | null>(null);

  const yAxisTextLabel = useMemo(
    () =>
      scorigamiType === "traditional"
        ? "Losing Score"
        : club === "ALL"
          ? "Visitor Score"
          : "Opponent Score",
    [scorigamiType, club]
  );
  const xAxisTextLabel = useMemo(
    () =>
      scorigamiType === "traditional"
        ? "Winning Score"
        : club === "ALL"
          ? "Home Score"
          : `${TEAM_NAMES[club] ?? club} Score`,
    [scorigamiType, club]
  );

  const maxOccurrencesInView = useMemo(() => {
    if (!Array.isArray(rows) || rows.length === 0) return 1;
    const maxOcc = Math.max(...rows.map((row) => Number(row.occurrences)));
    return maxOcc === 0 ? 1 : maxOcc;
  }, [rows]);

  const highlightKey = activeCellKey ?? hoveredCellKey;
  const [activeX, activeY] = useMemo(
    () => (highlightKey ? highlightKey.split("-").map(Number) : [null, null]),
    [highlightKey]
  );

  const getLogScaledColor = (currentOccurrences: number, maxInView: number) => {
    const currentHexSet = isDarkMode ? darkHex : hex;
    if (currentOccurrences === 0) return currentHexSet[0];
    if (currentOccurrences === 1) return currentHexSet[1];
    const dataColors = currentHexSet.slice(1);
    const numColors = dataColors.length;
    const logOccurrences = Math.log1p(currentOccurrences);
    const maxLogOccurrences = Math.log1p(maxInView);
    let ratio = maxLogOccurrences > 0 ? logOccurrences / maxLogOccurrences : 0;
    ratio = Math.pow(ratio, 1.7);
    let colorIndex = Math.floor(ratio * (numColors - 1)) + 1;
    colorIndex = Math.min(colorIndex, numColors - 1);
    return dataColors[colorIndex];
  };

  useEffect(() => {
    const calculateSize = () => {
      if (!gridContainerRef.current) return;
      const containerWidth = gridContainerRef.current.offsetWidth;
      const PADDING = window.innerWidth < 640 ? 24 : 48;
      const availableWidth = containerWidth - PADDING;
      const totalUnits = GRID_DIMENSION + 1.2;
      const dynamicCellSize = Math.floor(availableWidth / totalUnits);
      setCellSize(Math.max(4, Math.min(DESKTOP_CELL_SIZE, dynamicCellSize)));
      setHeaderCellSize(
        Math.max(10, Math.min(DESKTOP_HEADER_CELL_SIZE, dynamicCellSize * 1.2))
      );
    };
    if (hasData) {
      calculateSize();
      window.addEventListener("resize", calculateSize);
      return () => window.removeEventListener("resize", calculateSize);
    }
  }, [hasData, GRID_DIMENSION]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    setIsDarkMode(mediaQuery.matches);
    const handler = (e: MediaQueryListEvent) => setIsDarkMode(e.matches);
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  // Back to the original multiplier logic, but applied to every label
  const dynamicFontSize = Math.min(cellSize * 0.65, 12);

  if (isLoading)
    return (
      <div className="flex min-h-[400px] md:min-h-[450px] w-full items-center justify-center">
        <StatusIndicator type="loading" />
      </div>
    );
  if (!hasData)
    return (
      <div className="flex min-h-[400px] md:min-h-[450px] w-full items-center justify-center">
        <StatusIndicator type="empty" />
      </div>
    );

  return (
    <TooltipProvider delayDuration={150}>
      <div
        ref={gridContainerRef}
        className="p-3 sm:p-6 flex flex-col items-center justify-center"
      >
        <div className="flex flex-col items-center">
          <div
            style={{ paddingLeft: `${headerCellSize}px` }}
            className="text-center pb-1.5 pt-1"
          >
            <span className="text-[9px] sm:text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              {xAxisTextLabel}
            </span>
          </div>
          <div className="flex">
            <div
              style={{ width: `${headerCellSize}px` }}
              className="flex-none flex items-center justify-center pr-1"
            >
              <div className="transform -rotate-90 whitespace-nowrap text-[9px] sm:text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                {yAxisTextLabel}
              </div>
            </div>
            <div
              className="relative border border-slate-200 dark:border-[#2c2c2c] rounded-sm overflow-hidden"
              style={{
                width: `${headerCellSize + GRID_DIMENSION * cellSize}px`,
                height: `${headerCellSize + GRID_DIMENSION * cellSize}px`,
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: `${headerCellSize}px repeat(${GRID_DIMENSION}, ${cellSize}px)`,
                  gridTemplateRows: `${headerCellSize}px repeat(${GRID_DIMENSION}, ${cellSize}px)`,
                }}
              >
                {/* Empty Top-Left Corner */}
                <div className="bg-slate-50 dark:bg-[#2c2c2c]"></div>

                {/* Column Headers */}
                {Array.from({ length: GRID_DIMENSION }).map((_, i) => (
                  <div
                    key={`ch-${i}`}
                    className={`flex items-center justify-center font-medium bg-slate-50 dark:bg-[#2c2c2c] transition-colors overflow-hidden ${
                      activeX === i
                        ? "bg-slate-200 dark:bg-[#383838] text-slate-600 dark:text-slate-300"
                        : "text-slate-400 dark:text-slate-500"
                    }`}
                    style={{ fontSize: `${dynamicFontSize}px` }}
                  >
                    {i}
                  </div>
                ))}

                {/* Rows */}
                {Array.from({ length: GRID_DIMENSION }).map(
                  (_, score2_iterator) => (
                    <React.Fragment key={`rf-${score2_iterator}`}>
                      {/* Row Header */}
                      <div
                        className={`flex items-center justify-center font-medium bg-slate-50 dark:bg-[#2c2c2c] transition-colors overflow-hidden ${
                          activeY === score2_iterator
                            ? "bg-slate-200 dark:bg-[#383838] text-slate-600 dark:text-slate-300"
                            : "text-slate-400 dark:text-slate-500"
                        }`}
                        style={{ fontSize: `${dynamicFontSize}px` }}
                      >
                        {score2_iterator}
                      </div>

                      {/* Data Cells */}
                      {Array.from({ length: GRID_DIMENSION }).map(
                        (_, score1_iterator) => {
                          const k = `${score1_iterator}-${score2_iterator}`;
                          const rowData = data[k];
                          const f = rowData?.occurrences ?? 0;
                          const isActive = activeCellKey === k;
                          const isHovered = hoveredCellKey === k;

                          const CellBase = (
                            <div
                              style={{
                                backgroundColor: getLogScaledColor(f, maxOccurrencesInView),
                              }}
                              className={`cursor-pointer transition-[filter] duration-100 ${
                                isHovered && !isActive ? "brightness-110" : ""
                              } ${isActive ? "brightness-125" : ""}`}
                              onMouseEnter={() => setHoveredCellKey(k)}
                              onMouseLeave={() => setHoveredCellKey(null)}
                              onClick={() => setActiveCellKey(isActive ? null : k)}
                            />
                          );

                          if (isActive) {
                            return (
                              <Tooltip
                                key={k}
                                open={true}
                                onOpenChange={(open) => !open && setActiveCellKey(null)}
                              >
                                <TooltipTrigger asChild>{CellBase}</TooltipTrigger>
                                <TooltipContent
                                  onPointerDownOutside={() => setActiveCellKey(null)}
                                >
                                  <div className="flex flex-col items-start text-left min-w-[140px]">
                                    <div className="flex justify-between items-center w-full mb-1">
                                      <span className="text-base font-semibold text-slate-900 dark:text-white leading-tight tabular-nums">
                                        {score1_iterator} – {score2_iterator}
                                      </span>
                                      {isMobile && (
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setActiveCellKey(null);
                                          }}
                                          className="ml-3 p-0.5 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                                        >
                                          <X className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                    </div>
                                    <span className="text-xs text-slate-500 dark:text-slate-400">
                                      {freqText(f)}
                                    </span>
                                    {f > 0 && rowData?.last_date && (
                                      <div className="mt-2 pt-2 border-t border-slate-100 dark:border-[#383838] w-full text-xs space-y-0.5">
                                        <div className="text-slate-500 dark:text-slate-400">
                                          <span className="font-medium text-slate-600 dark:text-slate-300">
                                            Last:
                                          </span>{" "}
                                          {formatDisplayDate(rowData.last_date)}
                                        </div>
                                        <div className="text-slate-500 dark:text-slate-400">
                                          {rowData.last_home_team} vs {rowData.last_visitor_team}
                                        </div>
                                        {rowData.last_game_id && rowData.source === "mlb_api" && (
                                          <a
                                            href={`https://www.mlb.com/gameday/${rowData.last_game_id}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            onClick={(e) => e.stopPropagation()}
                                            className="inline-flex items-center gap-1 mt-1 text-blue-600 dark:text-blue-400 hover:underline"
                                          >
                                            Box Score ↗
                                          </a>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            );
                          }
                          return <React.Fragment key={k}>{CellBase}</React.Fragment>;
                        }
                      )}
                    </React.Fragment>
                  )
                )}
              </div>
            </div>
          </div>
        </div>
        <ColorLegend isDarkMode={isDarkMode} />
      </div>
    </TooltipProvider>
  );
}