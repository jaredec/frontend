"use client";

import React, { useState, useEffect, useRef } from "react";
import * as Select from "@radix-ui/react-select";
import * as Slider from "@radix-ui/react-slider";
import { ChevronDown, RotateCcw } from "lucide-react";
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
}: {
  value: GameFilter;
  onChange: (v: GameFilter) => void;
  onOpenChange?: (open: boolean) => void;
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

  const itemCls = "w-full text-left px-3 py-2 text-sm text-slate-800 dark:text-slate-200 hover:bg-blue-500 hover:text-white rounded cursor-pointer";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => { setOpen(o => !o); onOpenChange?.(!open); }}
        className="flex w-full items-center justify-between rounded-md border border-slate-200 dark:border-[#3e3e42] bg-white dark:bg-[#252526] px-2.5 py-1.5 text-sm text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      >
        <span className="flex-1 truncate">{triggerLabel}</span>
        <ChevronDown className="h-3.5 w-3.5 text-slate-400 flex-shrink-0 ml-1" />
      </button>

      {open && (
        <div className="absolute z-[99] mt-1 w-full min-w-[180px] rounded-md border border-slate-200 dark:border-[#3e3e42] bg-white dark:bg-[#252526] p-1 shadow-lg">
          <button onClick={() => select("all")} className={itemCls}>All Games</button>
          <button onClick={() => select("regular")} className={itemCls}>Regular Season</button>

          {/* Postseason header — toggles sub-list */}
          <button
            type="button"
            onClick={() => setPostExpanded(e => !e)}
            className="w-full flex items-center justify-between px-3 py-2 text-sm text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#2d2d30] rounded cursor-pointer"
          >
            <span>Postseason</span>
            <ChevronDown className={`h-3.5 w-3.5 text-slate-400 transition-transform ${postExpanded ? "rotate-180" : ""}`} />
          </button>

          {postExpanded && (
            <div className="ml-2 border-l border-slate-200 dark:border-[#3e3e42] pl-2">
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
  isFiltered?: boolean;
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
}: FilterBarProps) {
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    const check = () => setIsDark(document.documentElement.classList.contains("dark"));
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  const [dataMin, dataMax] = dataYearBounds;
  const isSingleYear = yearRange[0] === yearRange[1];

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

  return (
    <div className="space-y-3 md:space-y-0 md:flex md:items-end md:gap-5">

      {/* Row 1 on mobile: Games dropdown + Team dropdown */}
      <div className="flex items-end gap-2 md:contents">

        {/* Game Type dropdown */}
        <div className="flex-1 min-w-0 md:w-52 md:flex-none">
          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
            Game Type
          </label>
          <GameTypeDropdown
            value={gameFilter}
            onChange={setGameFilter}
            onOpenChange={onDropdownOpenChange}
          />
        </div>

        {/* Team dropdown */}
        <div className="flex-1 min-w-0 md:w-52 md:flex-none">
          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
            Team
          </label>
          <Select.Root
            value={club}
            onValueChange={(val: string) => setClub(val as FranchiseCode | "ALL")}
            onOpenChange={onDropdownOpenChange}
          >
            <Select.Trigger className="flex w-full items-center justify-between rounded-md border border-slate-200 dark:border-[#3e3e42] bg-white dark:bg-[#252526] px-3 py-1.5 text-sm text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 overflow-hidden">
              <span className="flex-1 min-w-0 overflow-hidden">
                <Select.Value>
                  <span className="flex items-center gap-2 min-w-0">
                    {club !== "ALL" && getTeamLogoUrl(club, isDark) && (
                      <img src={getTeamLogoUrl(club, isDark)!} alt="" className="w-5 h-5 object-contain flex-shrink-0" />
                    )}
                    <span className="truncate">
                      {club === "ALL" ? "All Teams" : TEAM_NAMES[club] ?? club}
                    </span>
                  </span>
                </Select.Value>
              </span>
              <Select.Icon className="flex-shrink-0 ml-1">
                <ChevronDown className="h-4 w-4 text-slate-400" />
              </Select.Icon>
            </Select.Trigger>
            <Select.Portal>
              <Select.Content
                className="z-[99] max-h-80 w-[var(--radix-select-trigger-width)] overflow-y-auto rounded-md border border-slate-200 dark:border-[#3e3e42] bg-white dark:bg-[#252526] p-1 text-sm shadow-lg"
                position="popper"
                sideOffset={4}
              >
                <Select.Viewport>
                  <Select.Item
                    value="ALL"
                    className="cursor-pointer select-none rounded px-3 py-2 text-sm outline-none text-slate-800 dark:text-slate-200 data-[highlighted]:bg-blue-500 data-[highlighted]:text-white"
                  >
                    <Select.ItemText>All Teams</Select.ItemText>
                  </Select.Item>
                  {sortedTeamsForDropdown.map((team) => (
                    <Select.Item
                      key={team.code}
                      value={team.code}
                      className="cursor-pointer select-none rounded px-3 py-2 text-sm outline-none text-slate-800 dark:text-slate-200 data-[highlighted]:bg-blue-500 data-[highlighted]:text-white"
                    >
                      <Select.ItemText>
                        <span className="flex items-center gap-2">
                          {getTeamLogoUrl(team.code, isDark) && (
                            <img
                              src={getTeamLogoUrl(team.code, isDark)!}
                              alt=""
                              loading="lazy"
                              className="w-5 h-5 object-contain flex-shrink-0"
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

      {/* Row 2 on mobile: Year range slider — full width */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-xs font-medium text-slate-700 dark:text-slate-300 tabular-nums">
            {isSingleYear ? yearRange[0] : `${yearRange[0]} – ${yearRange[1]}`}
          </span>
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
              checked={!isSingleYear}
              onChange={() =>
                isSingleYear
                  ? setYearRange([Math.max(dataMin, MODERN_ERA_START), dataMax])
                  : setYearRange([clampYear(dataMax), clampYear(dataMax)])
              }
              className="accent-blue-500 cursor-pointer"
            />
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">Range</span>
          </label>
        </div>
        <div className="relative">
        {isSingleYear ? (
          <Slider.Root
            key="single"
            value={[yearRange[0]]}
            onValueChange={(val: number[]) => clampedSet(val[0], val[0])}
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
            onValueChange={(val: number[]) => clampedSet(val[0], val[1])}
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

    </div>
  );
}
