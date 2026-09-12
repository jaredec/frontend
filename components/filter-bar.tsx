"use client";

import React, { useState, useEffect, useLayoutEffect, useRef } from "react";
import * as Select from "@radix-ui/react-select";
import * as Slider from "@radix-ui/react-slider";
import { ChevronDown, Pencil, RotateCcw } from "lucide-react";
import { TEAM_NAMES, FranchiseCode, GameFilter, getTeamLogoUrl } from "@/lib/mlb-data";

const POSTSEASON_ROUNDS: { value: GameFilter; label: string }[] = [
  { value: "playoffs", label: "All Postseason" },
  { value: "ws",       label: "World Series" },
  { value: "lcs",      label: "League Championship" },
  { value: "ds",       label: "Division Series" },
  { value: "wc",       label: "Wild Card" },
];

const isPostseason = (f: GameFilter) => ["playoffs", "ws", "lcs", "ds", "wc"].includes(f);

function GameTypeDropdown({
  value,
  onChange,
  onOpenChange,
  stacked = false,
}: {
  value: GameFilter;
  onChange: (v: GameFilter) => void;
  onOpenChange?: (open: boolean) => void;
  stacked?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [postExpanded, setPostExpanded] = useState(isPostseason(value));
  const ref = useRef<HTMLDivElement>(null);
  const openRef = useRef(false);
  openRef.current = open;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node) && openRef.current) {
        setOpen(false);
        onOpenChange?.(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onOpenChange]);

  const triggerLabel = isPostseason(value)
    ? (POSTSEASON_ROUNDS.find(r => r.value === value)?.label ?? "Postseason")
    : value === "all" ? "All Games" : "Regular Season";

  const select = (v: GameFilter) => {
    onChange(v);
    setOpen(false);
    onOpenChange?.(false);
  };

  const itemCls = stacked
    ? "w-full text-left px-2.5 py-1 md:px-3 md:py-1.5 text-[14px] md:text-[16px] text-[#343434] hover:bg-[#0b162a] hover:text-white rounded-md cursor-pointer"
    : "w-full text-left px-3 py-2 text-sm text-slate-800 dark:text-slate-200 hover:bg-blue-500 hover:text-white rounded cursor-pointer";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => { setOpen(o => !o); onOpenChange?.(!open); }}
        className={stacked
          ? "flex w-full items-center justify-between rounded-[15px] border border-[#d9dee7] bg-white px-3 py-1.5 md:py-2 text-[15px] md:text-[17px] text-[#343434] text-left focus:outline-none"
          : "flex w-full items-center justify-between rounded-md border border-slate-200/60 dark:border-[#3e3e42]/60 bg-white dark:bg-[#252526] px-2.5 py-1.5 text-sm text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        }
        style={stacked ? { fontFamily: "var(--v2-ui-font), system-ui, sans-serif", fontWeight: 500 } : undefined}
      >
        <span className="flex-1 truncate">{triggerLabel}</span>
        <ChevronDown className={`h-3.5 w-3.5 flex-shrink-0 ml-1 ${stacked ? "text-[#0b162a]" : "text-slate-400"}`} />
      </button>

      {open && (
        <div
          className={stacked
            ? "absolute z-[99] mt-1 w-full min-w-[180px] rounded-[12px] border border-[#d9dee7] bg-white py-0.5 shadow-md"
            : "absolute z-[99] mt-1 w-full min-w-[180px] rounded-md border border-slate-200/60 dark:border-[#3e3e42]/60 bg-white dark:bg-[#252526] p-1 shadow-lg"
          }
          style={stacked ? { fontFamily: "var(--v2-ui-font), system-ui, sans-serif" } : undefined}
        >
          <button onClick={() => select("all")} className={itemCls}>All Games</button>
          <button onClick={() => select("regular")} className={itemCls}>Regular Season</button>

          <button
            type="button"
            onClick={() => setPostExpanded(e => !e)}
            className={stacked
              ? "w-full flex items-center justify-between px-2.5 py-1 md:px-3 md:py-1.5 text-[14px] md:text-[16px] text-[#343434] hover:bg-[#0b162a] hover:text-white rounded-md cursor-pointer"
              : "w-full flex items-center justify-between px-3 py-2 text-sm text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#2d2d30] rounded cursor-pointer"
            }
          >
            <span>Postseason</span>
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${postExpanded ? "rotate-180" : ""} ${stacked ? "text-[#0b162a]" : "text-slate-400"}`} />
          </button>

          {postExpanded && (
            <div className={stacked ? "ml-2 border-l border-[#d9dee7] pl-1.5" : "ml-2 border-l border-slate-200 dark:border-[#3e3e42] pl-2"}>
              {POSTSEASON_ROUNDS.map(r => (
                <button key={r.value} onClick={() => select(r.value)} className={itemCls}>
                  {r.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const CURRENT_YEAR = new Date().getFullYear();
const MIN_YEAR = 1871;
const MODERN_ERA_START = 1901;

// Compact year field shown only while editing. Commits on blur/Enter;
// anything that isn't a full 4-digit year reverts. Escape cancels.
function YearInput({
  value,
  min,
  max,
  onCommit,
  ariaLabel,
  autoFocus,
}: {
  value: number;
  min: number;
  max: number;
  onCommit: (year: number) => void;
  ariaLabel: string;
  autoFocus?: boolean;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);

  const commit = () => {
    const n = parseInt(draft, 10);
    if (draft.length !== 4 || Number.isNaN(n)) {
      setDraft(String(value));
      return;
    }
    const clamped = Math.max(min, Math.min(max, n));
    setDraft(String(clamped));
    onCommit(clamped);
  };

  return (
    <input
      type="text"
      inputMode="numeric"
      maxLength={4}
      autoFocus={autoFocus}
      value={draft}
      onChange={(e) => setDraft(e.target.value.replace(/\D/g, ""))}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") {
          setDraft(String(value));
          (e.target as HTMLInputElement).blur();
        }
      }}
      onFocus={(e) => e.target.select()}
      aria-label={ariaLabel}
      className="w-10 h-5 rounded bg-slate-100 dark:bg-[#2d2d30] px-0.5 text-xs font-medium text-center tabular-nums text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
    />
  );
}

function yearToSliderValue(yearRange: [number, number], sentinel: number) {
  return yearRange[0] !== yearRange[1] ? sentinel : yearRange[0];
}

function BearYearSlider({
  minYear,
  maxYear,
  yearRange,
  onChange,
  haltNote,
}: {
  minYear: number;
  maxYear: number;
  yearRange: [number, number];
  onChange: (value: [number, number]) => void;
  haltNote?: string;
}) {
  const sentinel = maxYear + 1;
  const [local, setLocal] = useState(() => yearToSliderValue(yearRange, sentinel));
  const draggingRef = useRef(false);
  const lastFlushedRef = useRef(local);
  const trackRef = useRef<HTMLDivElement>(null);

  const flush = (v: number) => {
    if (v === lastFlushedRef.current) return;
    lastFlushedRef.current = v;
    if (v === sentinel) onChange([minYear, maxYear]);
    else onChange([v, v]);
  };

  const applyFromPointer = (clientX: number) => {
    const track = trackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const pad = 16;
    const usable = Math.max(rect.width - pad * 2, 1);
    const pct = (clientX - rect.left - pad) / usable;
    const raw = minYear + pct * (sentinel - minYear);
    const v = Math.round(Math.min(sentinel, Math.max(minYear, raw)));
    setLocal(v);
    flush(v);
  };

  useLayoutEffect(() => {
    if (draggingRef.current) return;
    let next = yearToSliderValue(yearRange, sentinel);
    if (next !== sentinel) next = Math.min(maxYear, Math.max(minYear, next));
    lastFlushedRef.current = next;
    setLocal(next);
  }, [yearRange, sentinel, minYear, maxYear]);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    draggingRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    applyFromPointer(e.clientX);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    applyFromPointer(e.clientX);
  };

  const onPointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    applyFromPointer(e.clientX);
  };

  const nudge = (delta: number) => {
    const next = Math.min(sentinel, Math.max(minYear, local + delta));
    setLocal(next);
    flush(next);
  };

  const pct = sentinel === minYear ? 0.5 : (local - minYear) / (sentinel - minYear);
  const showHalt = Boolean(haltNote) && local === minYear;

  return (
    <div className="w-full">
      <div
        ref={trackRef}
        role="slider"
        tabIndex={0}
        aria-label="Year slider"
        aria-valuemin={minYear}
        aria-valuemax={sentinel}
        aria-valuenow={local}
        aria-valuetext={local === sentinel ? "ALL" : String(local)}
        className="relative w-full h-8 flex items-center cursor-pointer select-none"
        style={{ touchAction: "none" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
            e.preventDefault();
            nudge(-1);
          } else if (e.key === "ArrowRight" || e.key === "ArrowUp") {
            e.preventDefault();
            nudge(1);
          } else if (e.key === "Home") {
            e.preventDefault();
            nudge(minYear - local);
          } else if (e.key === "End") {
            e.preventDefault();
            nudge(sentinel - local);
          }
        }}
      >
        <div className="absolute left-0 right-0 h-2 rounded-full bg-[#cbcbcb]" />
        <span
          className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none whitespace-nowrap rounded-full px-[10px] pt-[2px] pb-[4px]"
          style={{
            background: "#0b162a",
            color: "#ffffff",
            fontFamily: "var(--v2-ui-font), system-ui, sans-serif",
            fontSize: 12,
            fontWeight: 600,
            left: `calc(16px + ${pct} * (100% - 32px))`,
          }}
        >
          {local === sentinel ? "ALL" : String(local)}
        </span>
      </div>
      <p
        className="h-5 mt-0.5 text-center text-[12px] sm:text-[13px] leading-5 text-[#5a6a7a] transition-opacity duration-150"
        style={{
          fontFamily: "var(--v2-ui-font), system-ui, sans-serif",
          opacity: showHalt ? 1 : 0,
        }}
        aria-hidden={!showHalt}
        aria-live="polite"
      >
        {haltNote ?? ""}
      </p>
    </div>
  );
}

interface FilterBarProps {
  gameFilter: GameFilter;
  setGameFilter: (value: GameFilter) => void;
  club: FranchiseCode | "ALL";
  setClub: (value: FranchiseCode | "ALL") => void;
  yearRange: [number, number];
  setYearRange: (value: [number, number]) => void;
  dataYearBounds: [number, number];
  sortedTeamsForDropdown: { code: string; name: string }[];
  onDropdownOpenChange?: (open: boolean) => void;
  onReset?: () => void;
  stacked?: boolean;
}

export default function FilterBar({
  gameFilter,
  setGameFilter,
  club,
  setClub,
  yearRange,
  setYearRange,
  dataYearBounds,
  sortedTeamsForDropdown,
  onDropdownOpenChange,
  onReset,
  stacked = false,
}: FilterBarProps) {
  const isDark = !stacked;

  const [dataMin, dataMax] = dataYearBounds;
  const isSingleYear = yearRange[0] === yearRange[1];
  const [editingYears, setEditingYears] = useState(false);

  // The pencil hint stays hidden until the user works the slider, then fades
  // in (they're pinpointing a year — typing is easier) and fades back out
  // a few seconds after they stop.
  const [showEditHint, setShowEditHint] = useState(false);
  const hintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingEditHint = () => {
    setShowEditHint(true);
    if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
    hintTimerRef.current = setTimeout(() => setShowEditHint(false), 4000);
  };
  useEffect(() => {
    return () => {
      if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
    };
  }, []);

  const modernStartPct = ((MODERN_ERA_START - MIN_YEAR) / (CURRENT_YEAR - MIN_YEAR)) * 100;
  const trackGradient = isDark
    ? `linear-gradient(to right, #52525b 0%, #52525b ${modernStartPct}%, #3e3e42 ${modernStartPct}%, #3e3e42 100%)`
    : `linear-gradient(to right, #94a3b8 0%, #94a3b8 ${modernStartPct}%, #e2e8f0 ${modernStartPct}%, #e2e8f0 100%)`;

  const clampYear = (y: number) => Math.max(dataMin, Math.min(dataMax, y));

  const clampedSet = (lo: number, hi: number) => {
    const cLo = clampYear(lo);
    const cHi = clampYear(hi);
    setYearRange([Math.min(cLo, cHi), Math.max(cLo, cHi)]);
  };

  // Warm the browser cache for all team logos so the dropdown paints
  // instantly on first open instead of fetching each SVG on demand.
  useEffect(() => {
    sortedTeamsForDropdown.forEach(({ code }) => {
      const url = getTeamLogoUrl(code, isDark);
      if (url) {
        const img = new window.Image();
        img.src = url;
      }
    });
  }, [sortedTeamsForDropdown, isDark]);

  return (
    <div className={stacked
      ? "w-full space-y-4"
      : "space-y-3 md:space-y-0 md:flex md:items-end md:gap-5"
    }>

      {/* Row 1 on mobile: Games dropdown + Team dropdown */}
      <div className={stacked ? "flex items-end gap-3 w-full md:w-[70%] max-w-[950px] mx-auto" : "flex items-end gap-2 md:contents"}>

        {/* Game Type dropdown */}
        <div className={stacked ? "flex-1 min-w-0" : "flex-1 min-w-0 md:w-52 md:flex-none"}>
          <label
            className={stacked
              ? "block text-[13px] md:text-[15px] mb-1 text-[#343434]"
              : "block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5"
            }
            style={stacked ? { fontFamily: "var(--v2-ui-font), system-ui, sans-serif" } : undefined}
          >
            Game Type
          </label>
          <GameTypeDropdown
            value={gameFilter}
            onChange={setGameFilter}
            onOpenChange={onDropdownOpenChange}
            stacked={stacked}
          />
        </div>

        {/* Team dropdown */}
        <div className={stacked ? "flex-1 min-w-0" : "flex-1 min-w-0 md:w-52 md:flex-none"}>
          <label
            className={stacked
              ? "block text-[13px] md:text-[15px] mb-1 text-[#343434]"
              : "block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5"
            }
            style={stacked ? { fontFamily: "var(--v2-ui-font), system-ui, sans-serif" } : undefined}
          >
            Team
          </label>
          <Select.Root
            value={club}
            onValueChange={(val: string) => setClub(val as FranchiseCode | "ALL")}
            onOpenChange={onDropdownOpenChange}
          >
            <Select.Trigger
              className={stacked
                ? "flex w-full items-center justify-between rounded-[15px] border border-[#d9dee7] bg-white px-3 py-1.5 md:py-2 text-[15px] md:text-[17px] text-[#343434] text-left focus:outline-none overflow-hidden"
                : "flex w-full items-center justify-between rounded-md border border-slate-200/60 dark:border-[#3e3e42]/60 bg-white dark:bg-[#252526] px-3 py-1.5 text-sm text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 overflow-hidden"
              }
              style={stacked ? { fontFamily: "var(--v2-ui-font), system-ui, sans-serif", fontWeight: 500 } : undefined}
            >
              <span className="flex-1 min-w-0 overflow-hidden">
                <Select.Value>
                  <span className="flex items-center gap-2 min-w-0">
                    {club !== "ALL" && getTeamLogoUrl(club, isDark) && (
                      <img src={getTeamLogoUrl(club, isDark)!} alt="" className="w-5 h-5 md:w-6 md:h-6 object-contain flex-shrink-0" />
                    )}
                    <span className="truncate">
                      {club === "ALL" ? "All Teams" : TEAM_NAMES[club] ?? club}
                    </span>
                  </span>
                </Select.Value>
              </span>
              <Select.Icon className="flex-shrink-0 ml-1">
                <ChevronDown className={`h-3.5 w-3.5 ${stacked ? "text-[#0b162a]" : "text-slate-400"}`} />
              </Select.Icon>
            </Select.Trigger>
            <Select.Portal>
              <Select.Content
                className={stacked
                  ? "z-[99] max-h-72 md:max-h-80 w-[var(--radix-select-trigger-width)] overflow-y-auto rounded-[12px] border border-[#d9dee7] bg-white py-0.5 md:py-1 text-[14px] md:text-[16px] text-[#343434] shadow-md"
                  : "z-[99] max-h-80 w-[var(--radix-select-trigger-width)] overflow-y-auto rounded-md border border-slate-200/60 dark:border-[#3e3e42]/60 bg-white dark:bg-[#252526] p-1 text-sm shadow-lg"
                }
                style={stacked ? { fontFamily: "var(--v2-ui-font), system-ui, sans-serif" } : undefined}
                position="popper"
                sideOffset={2}
              >
                <Select.Viewport>
                  <Select.Item
                    value="ALL"
                    className={stacked
                      ? "cursor-pointer select-none rounded-md px-2.5 py-1 md:px-3 md:py-1.5 text-[14px] md:text-[16px] outline-none text-[#343434] data-[highlighted]:bg-[#0b162a] data-[highlighted]:text-white"
                      : "cursor-pointer select-none rounded px-3 py-2 text-sm outline-none text-slate-800 dark:text-slate-200 data-[highlighted]:bg-blue-500 data-[highlighted]:text-white"
                    }
                  >
                    <Select.ItemText>All Teams</Select.ItemText>
                  </Select.Item>
                  {sortedTeamsForDropdown.map((team) => (
                    <Select.Item
                      key={team.code}
                      value={team.code}
                      className={stacked
                        ? "cursor-pointer select-none rounded-md px-2.5 py-1 md:px-3 md:py-1.5 text-[14px] md:text-[16px] outline-none text-[#343434] data-[highlighted]:bg-[#0b162a] data-[highlighted]:text-white"
                        : "cursor-pointer select-none rounded px-3 py-2 text-sm outline-none text-slate-800 dark:text-slate-200 data-[highlighted]:bg-blue-500 data-[highlighted]:text-white"
                      }
                    >
                      <Select.ItemText>
                        <span className="flex items-center gap-1.5">
                          {getTeamLogoUrl(team.code, isDark) && (
                            <img
                              src={getTeamLogoUrl(team.code, isDark)!}
                              alt=""
                              className="w-5 h-5 md:w-6 md:h-6 object-contain flex-shrink-0"
                            />
                          )}
                          {team.name}
                        </span>
                      </Select.ItemText>
                    </Select.Item>
                  ))}
                </Select.Viewport>
              </Select.Content>
            </Select.Portal>
          </Select.Root>
        </div>

      </div>

      {/* Row 2: Year slider */}
      {stacked ? (
        <div className="w-full md:w-[90%] max-w-[1150px] mx-auto">
          <BearYearSlider
            minYear={dataMin}
            maxYear={dataMax}
            yearRange={yearRange}
            onChange={setYearRange}
            haltNote={club === "ALL" ? undefined : `No games before ${dataMin}`}
          />
        </div>
      ) : (
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1.5">
          {editingYears ? (
            <span
              className="flex h-5 items-center gap-1"
              onBlur={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                  setEditingYears(false);
                }
              }}
            >
              <YearInput
                value={yearRange[0]}
                min={dataMin}
                max={dataMax}
                autoFocus
                onCommit={(n) => (isSingleYear ? clampedSet(n, n) : clampedSet(n, yearRange[1]))}
                ariaLabel={isSingleYear ? "Year" : "Start year"}
              />
              {!isSingleYear && (
                <>
                  <span className="text-xs text-slate-400 dark:text-slate-500">–</span>
                  <YearInput
                    value={yearRange[1]}
                    min={dataMin}
                    max={dataMax}
                    onCommit={(n) => clampedSet(yearRange[0], n)}
                    ariaLabel="End year"
                  />
                </>
              )}
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setEditingYears(true)}
              title="Type exact years"
              className="group flex h-5 items-center gap-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 tabular-nums"
            >
              <span>{isSingleYear ? yearRange[0] : `${yearRange[0]} – ${yearRange[1]}`}</span>
              <Pencil
                className={`w-3 h-3 text-slate-400 dark:text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-300 transition-opacity duration-300 ${
                  showEditHint ? "opacity-100" : "opacity-0"
                }`}
              />
            </button>
          )}
          {onReset && (
            <>
              <button
                onClick={onReset}
                className="ml-auto flex items-center gap-1 text-[11px] text-slate-400 dark:text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                Reset
              </button>
              <div className="w-px h-4 bg-slate-200 dark:bg-[#3e3e42]" />
            </>
          )}
          <label className={`flex items-center gap-1.5 ${onReset ? "" : "ml-auto"} cursor-pointer select-none`}>
            <input
              type="checkbox"
              checked={isSingleYear}
              onChange={() =>
                isSingleYear
                  ? setYearRange([Math.max(dataMin, MIN_YEAR), dataMax])
                  : setYearRange([clampYear(dataMax), clampYear(dataMax)])
              }
              className="accent-blue-500 cursor-pointer"
            />
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">Single season</span>
          </label>
        </div>
        <div className="relative">
        {isSingleYear ? (
          <Slider.Root
            key="single"
            value={[yearRange[0]]}
            onValueChange={(val: number[]) => { pingEditHint(); clampedSet(val[0], val[0]); }}
            min={MIN_YEAR}
            max={CURRENT_YEAR}
            step={1}
            className="relative flex items-center select-none touch-none h-5 w-full"
          >
            <Slider.Track className="relative grow h-1 rounded-full" style={{ background: trackGradient }}>
              <Slider.Range className="absolute h-full rounded-full bg-transparent" />
            </Slider.Track>
            <Slider.Thumb className="block h-4 w-4 rounded-full bg-white border-2 border-blue-500 shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#1e1e1e] cursor-grab active:cursor-grabbing" />
          </Slider.Root>
        ) : (
          <Slider.Root
            key="range"
            value={yearRange}
            onValueChange={(val: number[]) => { pingEditHint(); clampedSet(val[0], val[1]); }}
            min={MIN_YEAR}
            max={CURRENT_YEAR}
            step={1}
            minStepsBetweenThumbs={1}
            className="relative flex items-center select-none touch-none h-5 w-full"
          >
            <Slider.Track className="relative grow h-1 rounded-full" style={{ background: trackGradient }}>
              <Slider.Range className="absolute h-full rounded-full bg-blue-500 dark:bg-blue-600" />
            </Slider.Track>
            <Slider.Thumb className="block h-4 w-4 rounded-full bg-white border-2 border-blue-500 shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#1e1e1e] cursor-grab active:cursor-grabbing" />
            <Slider.Thumb className="block h-4 w-4 rounded-full bg-white border-2 border-blue-500 shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#1e1e1e] cursor-grab active:cursor-grabbing" />
          </Slider.Root>
        )}
        </div>
      </div>
      )}

    </div>
  );
}
