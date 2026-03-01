"use client";

import React from "react";
import * as Select from "@radix-ui/react-select";
import * as Slider from "@radix-ui/react-slider";
import { ChevronDown } from "lucide-react";
import { TEAM_NAMES, FranchiseCode, GameFilter } from "@/lib/mlb-data";

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
}: FilterBarProps) {
  const [dataMin, dataMax] = dataYearBounds;
  const isSingleYear = yearRange[0] === yearRange[1];
  const isModernEra = !isSingleYear && yearRange[0] === MODERN_ERA_START && yearRange[1] === dataMax;
  const isAllTime = !isSingleYear && yearRange[0] === dataMin && yearRange[1] === dataMax;

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
        <div className="flex-1 min-w-0 md:w-40 md:flex-none">
          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
            Game Type
          </label>
          <Select.Root
            value={gameFilter}
            onValueChange={(val: string) => setGameFilter(val as GameFilter)}
            onOpenChange={onDropdownOpenChange}
          >
            <Select.Trigger className="flex w-full items-center justify-between rounded-md border border-slate-200 dark:border-[#3e3e42] bg-white dark:bg-[#252526] px-2.5 py-1.5 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 whitespace-nowrap">
              <Select.Value />
              <Select.Icon>
                <ChevronDown className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
              </Select.Icon>
            </Select.Trigger>
            <Select.Portal>
              <Select.Content
                className="z-[99] w-[var(--radix-select-trigger-width)] overflow-hidden rounded-md border border-slate-200 dark:border-[#3e3e42] bg-white dark:bg-[#252526] p-1 shadow-lg"
                position="popper"
                sideOffset={4}
              >
                <Select.Viewport>
                  {(
                    [
                      { value: "all",      label: "All Games" },
                      { value: "regular",  label: "Regular Season" },
                      { value: "playoffs", label: "All Playoffs" },
                      { value: "ws",       label: "World Series" },
                      { value: "lcs",      label: "LCS" },
                      { value: "ds",       label: "Division Series" },
                      { value: "wc",       label: "Wild Card" },
                    ] as { value: GameFilter; label: string }[]
                  ).map((opt) => (
                    <Select.Item
                      key={opt.value}
                      value={opt.value}
                      className="cursor-pointer select-none rounded px-3 py-2 text-sm outline-none text-slate-800 dark:text-slate-200 data-[highlighted]:bg-blue-500 data-[highlighted]:text-white whitespace-nowrap"
                    >
                      <Select.ItemText>{opt.label}</Select.ItemText>
                    </Select.Item>
                  ))}
                </Select.Viewport>
              </Select.Content>
            </Select.Portal>
          </Select.Root>
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
            <Select.Trigger className="flex w-full items-center justify-between rounded-md border border-slate-200 dark:border-[#3e3e42] bg-white dark:bg-[#252526] px-3 py-1.5 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
              <Select.Value>
                <span className="truncate">
                  {club === "ALL" ? "All Teams" : TEAM_NAMES[club] ?? club}
                </span>
              </Select.Value>
              <Select.Icon>
                <ChevronDown className="h-4 w-4 text-slate-400 flex-shrink-0" />
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
                      <Select.ItemText>{team.name}</Select.ItemText>
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
          <div className="flex items-center gap-0.5 ml-auto rounded-md bg-slate-100 dark:bg-[#2d2d30] p-0.5">
            {dataMin < MODERN_ERA_START && (
              <button
                onClick={() => setYearRange([MODERN_ERA_START, dataMax])}
                className={`px-2 py-1 text-[11px] font-medium rounded transition-colors whitespace-nowrap ${
                  isModernEra
                    ? "bg-white dark:bg-[#3e3e42] text-slate-900 dark:text-white shadow-sm"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                }`}
              >
                Modern Era
              </button>
            )}
            <button
              onClick={() => setYearRange([dataMin, dataMax])}
              className={`px-2 py-1 text-[11px] font-medium rounded transition-colors whitespace-nowrap ${
                isAllTime
                  ? "bg-white dark:bg-[#3e3e42] text-slate-900 dark:text-white shadow-sm"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              }`}
            >
              All Time
            </button>
            <button
              onClick={() =>
                isSingleYear
                  ? setYearRange([dataMin, dataMax])
                  : setYearRange([clampYear(dataMax), clampYear(dataMax)])
              }
              className={`px-2 py-1 text-[11px] font-medium rounded transition-colors whitespace-nowrap ${
                isSingleYear
                  ? "bg-white dark:bg-[#3e3e42] text-slate-900 dark:text-white shadow-sm"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              }`}
            >
              Single Year
            </button>
          </div>
        </div>
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
            <Slider.Track className="relative grow h-1 rounded-full bg-slate-200 dark:bg-[#3e3e42]">
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
            <Slider.Track className="relative grow h-1 rounded-full bg-slate-200 dark:bg-[#3e3e42]">
              <Slider.Range className="absolute h-full rounded-full bg-blue-500 dark:bg-blue-600" />
            </Slider.Track>
            <Slider.Thumb className="block h-4 w-4 rounded-full bg-white border-2 border-blue-500 shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#1e1e1e] cursor-grab active:cursor-grabbing" />
            <Slider.Thumb className="block h-4 w-4 rounded-full bg-white border-2 border-blue-500 shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#1e1e1e] cursor-grab active:cursor-grabbing" />
          </Slider.Root>
        )}
      </div>

    </div>
  );
}
