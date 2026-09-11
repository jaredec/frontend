"use client";

import React, { useMemo, useState, useEffect, useLayoutEffect, useRef } from "react";
import { Tooltip, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { X, Loader2, FilterX, ArrowLeftRight, ArrowUpDown, Repeat } from "lucide-react";
import { TEAM_NAMES, TEAM_IGAMI } from "@/lib/mlb-data";

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
  box_url: string | null;
}

// Modern games link to MLB Gameday; Retrosheet-era games link to the
// Retrosheet box score page when one exists.
const boxScoreHref = (row: ApiRow): string | null => {
  if (row.last_game_id && row.source === "mlb_api") {
    return `https://www.mlb.com/gameday/${row.last_game_id}`;
  }
  return row.box_url ?? null;
};

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
        "z-50 w-auto rounded-md bg-white dark:bg-[#252526] shadow-lg border border-slate-200 dark:border-[#3e3e42] p-3 " +
        className
      }
      {...props}
    />
  </TooltipPrimitive.Portal>
);

const DESKTOP_CELL_SIZE = 20;
const DESKTOP_HEADER_CELL_SIZE = 30;
const BEAR_Y_AXIS_W = 16;

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


interface ScorigamiHeatmapProps {
  rows: ApiRow[] | undefined;
  isLoading: boolean;
  scorigamiType: ScorigamiType;
  club: string;
  gridSize: number;
  isGhostClick?: () => boolean;
  dark?: boolean;
  colCount?: number;   // number of X (winning-score) columns; defaults to gridSize
  rowCount?: number;   // number of Y (losing-score) rows to render; defaults to a square grid
  fillWidth?: boolean; // let cells grow to fill the container width instead of capping at 20px
  skeleton?: boolean;  // render the grid frame as gray cells (loading) instead of a spinner
  bearigamiGrid?: boolean; // bearigami-style structure: 0.5px gridline borders, white empties, dark diagonal
  onToggleType?: () => void;
}

export default function ScorigamiHeatmap({
  rows,
  isLoading,
  scorigamiType,
  club,
  gridSize,
  isGhostClick,
  dark = true,
  colCount,
  rowCount,
  fillWidth = false,
  skeleton = false,
  bearigamiGrid = false,
  onToggleType,
}: ScorigamiHeatmapProps) {
  const GRID_DIMENSION = colCount ?? gridSize;
  const ROW_COUNT = rowCount ?? gridSize;

  const hasData = useMemo(() => Array.isArray(rows) && rows.length > 0, [rows]);

  const data = useMemo(() => {
    if (!Array.isArray(rows) || rows.length === 0) return {};
    const map: Record<string, ApiRow> = {};
    rows.forEach((r) => (map[`${r.score1}-${r.score2}`] = r));
    return map;
  }, [rows]);

  const isDarkMode = dark;
  const [cellSize, setCellSize] = useState(DESKTOP_CELL_SIZE);
  const [headerCellSize, setHeaderCellSize] = useState(DESKTOP_HEADER_CELL_SIZE);
  const [gridReady, setGridReady] = useState(false);
  const gridContainerRef = useRef<HTMLDivElement>(null);
  const [activeCellKey, setActiveCellKey] = useState<string | null>(null);
  const [hoveredCellKey, setHoveredCellKey] = useState<string | null>(null);
  const closeTip = () => {
    setActiveCellKey(null);
    setHoveredCellKey(null);
  };
  const ignoreNextCellClick = useRef(false);

  const yAxisTextLabel = useMemo(
    () =>
      scorigamiType === "traditional"
        ? "Losing score"
        : club === "ALL"
          ? "Visitor score"
          : "Opponent score",
    [scorigamiType, club]
  );
  const xAxisTextLabel = useMemo(
    () =>
      scorigamiType === "traditional"
        ? "Winning score"
        : club === "ALL"
          ? "Home score"
          : `${(TEAM_IGAMI[club] ?? "").replace(/igami$/i, "") || TEAM_NAMES[club] || club} score`,
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
  const [hoverX, hoverY] = useMemo(
    () => (hoveredCellKey ? hoveredCellKey.split("-").map(Number) : [null, null]),
    [hoveredCellKey]
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

  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollFade, setScrollFade] = useState({ left: false, right: false });

  useLayoutEffect(() => {
    const calculateSize = () => {
      if (!gridContainerRef.current) return;
      if (bearigamiGrid) {
        const el = scrollRef.current ?? gridContainerRef.current;
        if (!el) return;
        const visibleCols = window.innerWidth < 768 ? 20 : GRID_DIMENSION;
        const next = el.clientWidth / visibleCols;
        setCellSize(next);
        setHeaderCellSize(next);
        setGridReady(true);
        return;
      }
      const containerWidth = gridContainerRef.current.offsetWidth;
      const PADDING = window.innerWidth < 640 ? 24 : 48;
      const availableWidth = containerWidth - PADDING;
      const totalUnits = GRID_DIMENSION + 1.2;
      const dynamicCellSize = Math.floor(availableWidth / totalUnits);
      const maxCell = fillWidth ? 40 : DESKTOP_CELL_SIZE;   // fillWidth: cells grow to fill instead of capping at 20
      setCellSize(Math.max(4, Math.min(maxCell, dynamicCellSize)));
      setHeaderCellSize(
        Math.max(10, Math.min(DESKTOP_HEADER_CELL_SIZE, dynamicCellSize * 1.2))
      );
      setGridReady(true);
    };
    if (bearigamiGrid || hasData || skeleton) {
      calculateSize();
      window.addEventListener("resize", calculateSize);
      return () => window.removeEventListener("resize", calculateSize);
    }
  }, [hasData, skeleton, GRID_DIMENSION, fillWidth, bearigamiGrid]);

  useEffect(() => {
    if (!bearigamiGrid) return;
    const el = scrollRef.current;
    if (!el) return;
    const update = () => {
      setScrollFade({
        left: el.scrollLeft > 2,
        right: el.scrollLeft + el.clientWidth < el.scrollWidth - 2,
      });
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [bearigamiGrid, cellSize, GRID_DIMENSION, ROW_COUNT, gridReady]);


  // Default variant scales ticks with the cell. Bearigami uses a fixed 14px
  // "dinosaur" serif on both axes so X and Y numbers match.
  const tickFontSize = bearigamiGrid
    ? Math.min(14, Math.max(9, cellSize * 0.75))
    : Math.min(cellSize * 0.65, 12);
  const sparseTicks = bearigamiGrid && cellSize < 16;
  const tickStyle: React.CSSProperties = bearigamiGrid
    ? {
        fontSize: tickFontSize,
        fontFamily: "var(--v2-ui-font), system-ui, sans-serif",
        fontWeight: 400,
        fontStyle: "normal",
        color: "#343434",
        lineHeight: 1,
        overflow: "visible",
      }
    : { fontSize: `${tickFontSize}px` };

  const xLabelH = bearigamiGrid ? cellSize : headerCellSize;
  const yAxisW = bearigamiGrid ? (sparseTicks ? 22 : BEAR_Y_AXIS_W) : headerCellSize;

  const emptyCellColor = bearigamiGrid ? "#ffffff" : getLogScaledColor(0, maxOccurrencesInView);
  const impossibleCellColor = bearigamiGrid ? "#0b162a" : (isDarkMode ? "#1c1c1e" : "#eef2f7");
  const cellStructure = (isImp: boolean): React.CSSProperties =>
    bearigamiGrid
      ? { boxSizing: "border-box", borderRadius: 0, border: `0.5px solid ${isImp ? impossibleCellColor : "#d9dee7"}` }
      : {};

  if (isLoading && !skeleton)
    return (
      <div className="flex min-h-[400px] md:min-h-[450px] w-full items-center justify-center">
        <StatusIndicator type="loading" />
      </div>
    );
  if (!hasData && !skeleton)
    return (
      <div className="flex min-h-[400px] md:min-h-[450px] w-full items-center justify-center">
        <StatusIndicator type="empty" />
      </div>
    );

  const gridWidth = GRID_DIMENSION * cellSize;
  const gridHeight = xLabelH + ROW_COUNT * cellSize;

  return (
    <TooltipProvider delayDuration={150}>
      <div
        ref={gridContainerRef}
        className={bearigamiGrid ? "w-full overflow-visible" : "p-3 sm:p-6 flex flex-col items-center justify-center"}
        style={{ visibility: gridReady ? "visible" : "hidden" }}
      >
        <div className={bearigamiGrid ? "w-full" : "flex flex-col items-center"}>
          {bearigamiGrid && (
            <div
              className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 pb-[15px]"
              style={{
                fontFamily: "var(--v2-ui-font), system-ui, sans-serif",
                fontSize: 14,
                fontWeight: 400,
                color: "#343434",
              }}
            >
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <span className="inline-flex items-center gap-1.5">
                  <ArrowLeftRight className="h-3.5 w-3.5" strokeWidth={1.75} />
                  {xAxisTextLabel}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <ArrowUpDown className="h-3.5 w-3.5" strokeWidth={1.75} />
                  {yAxisTextLabel}
                </span>
              </div>
              {onToggleType && (
                <button
                  type="button"
                  onClick={onToggleType}
                  className="inline-flex items-center gap-1.5 underline underline-offset-4 decoration-[#343434]/50 hover:text-[#2d91ff] hover:decoration-[#2d91ff] cursor-pointer"
                  title={scorigamiType === "traditional" ? "Switch to Home/Away view" : "Switch to Win/Loss view"}
                >
                  <Repeat className="h-3.5 w-3.5" strokeWidth={1.75} />
                  {scorigamiType === "traditional" ? "Home/Away" : "Win/Loss"}
                </button>
              )}
            </div>
          )}
          {!bearigamiGrid && (
            <div
              style={{ paddingLeft: `${yAxisW}px` }}
              className="text-center pb-1.5 pt-1"
            >
              <span className="text-[9px] sm:text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                {xAxisTextLabel}
              </span>
            </div>
          )}
          <div
            className={`relative ${bearigamiGrid ? "w-[calc(100%+2rem)] -mx-4 max-sm:w-full max-sm:mx-0" : ""}`}
          >
          <div className="flex items-start">
            {!bearigamiGrid && (
              <div
                style={{ width: `${yAxisW}px` }}
                className="flex-none flex items-center justify-center pr-1"
              >
                <div className="transform -rotate-90 whitespace-nowrap text-[9px] sm:text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  {yAxisTextLabel}
                </div>
              </div>
            )}
            {bearigamiGrid && (
              <div
                className="flex-none"
                style={{ width: yAxisW, paddingTop: xLabelH }}
              >
                {Array.from({ length: ROW_COUNT }).map((_, score2_iterator) => (
                  <div
                    key={`yh-${score2_iterator}`}
                    className="flex items-center justify-end text-right"
                    style={{ ...tickStyle, paddingRight: 4, height: cellSize }}
                  >
                    {sparseTicks && score2_iterator % 2 !== 0 ? "" : score2_iterator}
                  </div>
                ))}
              </div>
            )}
            <div className={bearigamiGrid ? "relative min-w-0 flex-1" : undefined}>
            <div
              ref={bearigamiGrid ? scrollRef : undefined}
              className={bearigamiGrid ? "min-w-0 w-full overflow-x-auto overscroll-x-contain" : "relative overflow-hidden"}
              style={bearigamiGrid ? { WebkitOverflowScrolling: "touch" } : {
                width: `${yAxisW + gridWidth}px`,
                height: `${gridHeight}px`,
              }}
            >
              <div
                onMouseLeave={bearigamiGrid ? () => setHoveredCellKey(null) : undefined}
                style={{
                  width: bearigamiGrid ? gridWidth : yAxisW + gridWidth,
                  height: gridHeight,
                  display: "grid",
                  gridTemplateColumns: bearigamiGrid
                    ? `repeat(${GRID_DIMENSION}, ${cellSize}px)`
                    : `${yAxisW}px repeat(${GRID_DIMENSION}, ${cellSize}px)`,
                  gridTemplateRows: `${xLabelH}px repeat(${ROW_COUNT}, ${cellSize}px)`,
                }}
              >
                {/* Empty corner — default layout only */}
                {!bearigamiGrid && <div></div>}

                {/* Column Headers */}
                {Array.from({ length: GRID_DIMENSION }).map((_, i) => (
                  <div
                    key={`ch-${i}`}
                    className={
                      bearigamiGrid
                        ? "flex items-center justify-center text-center"
                        : `flex items-center justify-center font-medium transition-colors overflow-hidden ${
                            activeX === i
                              ? "text-slate-700 dark:text-slate-200"
                              : "text-slate-400 dark:text-slate-500"
                          }`
                    }
                    style={tickStyle}
                  >
                    {sparseTicks && i % 2 !== 0 ? "" : i}
                  </div>
                ))}

                {/* Rows */}
                {Array.from({ length: ROW_COUNT }).map(
                  (_, score2_iterator) => (
                    <React.Fragment key={`rf-${score2_iterator}`}>
                      {/* Row Header (left) — default layout only */}
                      {!bearigamiGrid && (
                      <div
                        className={`flex items-center justify-center font-medium transition-colors overflow-hidden ${
                          activeY === score2_iterator
                            ? "text-slate-700 dark:text-slate-200"
                            : "text-slate-400 dark:text-slate-500"
                        }`}
                        style={tickStyle}
                      >
                        {score2_iterator}
                      </div>
                      )}

                      {/* Data Cells */}
                      {Array.from({ length: GRID_DIMENSION }).map(
                        (_, score1_iterator) => {
                          const k = `${score1_iterator}-${score2_iterator}`;
                          const rowData = data[k];
                          const f = rowData?.occurrences ?? 0;
                          const isActive = activeCellKey === k;
                          const isHovered = hoveredCellKey === k;

                          const isImpossible = scorigamiType === "traditional" && score1_iterator < score2_iterator;
                          const isCross =
                            bearigamiGrid &&
                            !isImpossible &&
                            hoverX != null &&
                            (hoverX === score1_iterator || hoverY === score2_iterator);
                          const isFocus = bearigamiGrid && isHovered && !isImpossible;

                          if (skeleton) {
                            // Exact empty-cell color, so the skeleton is indistinguishable
                            // from the loaded empty grid — only the colored (blue) cells pop in.
                            return (
                              <div
                                key={k}
                                style={{
                                  backgroundColor: isImpossible ? impossibleCellColor : emptyCellColor,
                                  ...cellStructure(isImpossible),
                                }}
                              />
                            );
                          }

                          const baseColor = isImpossible
                            ? impossibleCellColor
                            : f === 0
                              ? emptyCellColor
                              : getLogScaledColor(f, maxOccurrencesInView);
                          const CellBase = (
                            <div
                              style={{
                                backgroundColor: isFocus ? (bearigamiGrid ? "#2d91ff" : "#f38e55") : baseColor,
                                ...cellStructure(isImpossible),
                                ...(isCross && !isFocus
                                  ? {
                                      outline: "1px solid rgba(0,0,0,.12)",
                                      boxShadow: "inset 0 0 0 9999px rgba(0,0,0,.05)",
                                      zIndex: 1,
                                    }
                                  : isFocus
                                    ? { zIndex: 2 }
                                    : {}),
                              }}
                              data-cell={k}
                              className={
                                bearigamiGrid
                                  ? isImpossible
                                    ? "pointer-events-none"
                                    : "cursor-pointer"
                                  : `cursor-pointer transition-[filter] duration-100 ${
                                      isHovered && !isActive ? "brightness-110" : ""
                                    } ${isActive ? "brightness-125" : ""}`
                              }
                              onMouseEnter={() => !isImpossible && setHoveredCellKey(k)}
                              onMouseLeave={bearigamiGrid ? undefined : () => setHoveredCellKey(null)}
                              onClick={() => {
                                if (ignoreNextCellClick.current) {
                                  ignoreNextCellClick.current = false;
                                  return;
                                }
                                if (isImpossible) return;
                                if (isGhostClick?.()) return;
                                setActiveCellKey((prev) => {
                                  if (prev === k) {
                                    setHoveredCellKey(null);
                                    return null;
                                  }
                                  return k;
                                });
                              }}
                            />
                          );

                          if (isActive) {
                            return (
                              <Tooltip
                                key={k}
                                open={true}
                                onOpenChange={(open) => !open && closeTip()}
                              >
                                <TooltipTrigger asChild>{CellBase}</TooltipTrigger>
                                <TooltipContent
                                  onPointerDownOutside={(e) => {
                                    const t = e.target as HTMLElement | null;
                                    if (t?.closest?.(`[data-cell="${k}"]`)) {
                                      e.preventDefault();
                                      ignoreNextCellClick.current = true;
                                    }
                                    closeTip();
                                  }}
                                >
                                  <div className="flex flex-col items-start text-left min-w-[140px]">
                                    <div className="flex justify-between items-center w-full mb-1">
                                      <span className="text-base font-semibold text-slate-900 dark:text-white leading-tight tabular-nums">
                                        {score1_iterator} – {score2_iterator}
                                      </span>
                                      <button
                                        type="button"
                                        aria-label="Close"
                                        onPointerDown={(e) => {
                                          e.stopPropagation();
                                          e.preventDefault();
                                          closeTip();
                                        }}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          closeTip();
                                        }}
                                        className="ml-3 -mr-1 p-1.5 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                                      >
                                        <X className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                    <span className="text-xs text-slate-500 dark:text-slate-400">
                                      {freqText(f)}
                                    </span>
                                    {f > 0 && rowData?.last_date && (
                                      <div className="mt-2 pt-2 border-t border-slate-100 dark:border-[#3e3e42] w-full text-xs space-y-0.5">
                                        <div className="text-slate-500 dark:text-slate-400">
                                          <span className="font-medium text-slate-600 dark:text-slate-300">
                                            Last:
                                          </span>{" "}
                                          {formatDisplayDate(rowData.last_date)}
                                        </div>
                                        <div className="text-slate-500 dark:text-slate-400">
                                          {rowData.last_home_team} vs {rowData.last_visitor_team}
                                        </div>
                                        {boxScoreHref(rowData) && (
                                          <a
                                            href={boxScoreHref(rowData)!}
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
              {bearigamiGrid && (
                <>
                  {scrollFade.left && (
                    <div
                      className="pointer-events-none absolute top-0 bottom-0 w-8 z-10"
                      style={{ left: yAxisW, background: "linear-gradient(to right, #f2f2f2, transparent)" }}
                    />
                  )}
                  {scrollFade.right && (
                    <div
                      className="pointer-events-none absolute top-0 bottom-0 right-0 w-8 z-10"
                      style={{ background: "linear-gradient(to left, #f2f2f2, transparent)" }}
                    />
                  )}
                </>
              )}
            </div>
        </div>
        {!(bearigamiGrid) && Array.isArray(rows) && rows.length > 0 && (
          <div className="sm:hidden flex items-center justify-center gap-6 mt-3 pb-1">
            <div className="text-center">
              <div className="text-sm font-semibold tabular-nums text-slate-700 dark:text-slate-200">
                {rows.reduce((s, r) => s + Number(r.occurrences), 0).toLocaleString()}
              </div>
              <div className="text-[10px] uppercase tracking-wide text-slate-400 dark:text-slate-500 mt-0.5">Games</div>
            </div>
            <div className="w-px h-6 bg-slate-200 dark:bg-[#3e3e42]" />
            <div className="text-center">
              <div className="text-sm font-semibold tabular-nums text-slate-700 dark:text-slate-200">
                {rows.length.toLocaleString()}
              </div>
              <div className="text-[10px] uppercase tracking-wide text-slate-400 dark:text-slate-500 mt-0.5">Scores</div>
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}