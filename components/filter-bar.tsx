"use client";

import React from "react";
import * as RadioGroup from "@radix-ui/react-radio-group";
import * as Select from "@radix-ui/react-select";
import * as Slider from "@radix-ui/react-slider";
import { ChevronDown } from "lucide-react";
import { TEAM_NAMES, FranchiseCode, ScorigamiType } from "@/lib/mlb-data";

const CURRENT_YEAR = new Date().getFullYear();
const MIN_YEAR = 1871;
const MODERN_ERA_START = 1901;

interface FilterBarProps {
  scorigamiType: ScorigamiType;
  setScorigamiType: (value: ScorigamiType) => void;
  club: FranchiseCode | "ALL";
  setClub: (value: FranchiseCode | "ALL") => void;
  yearRange: [number, number];
  setYearRange: (value: [number, number]) => void;
  onYearRangeCommit: (value: [number, number]) => void;
  sortedTeamsForDropdown: { code: string; name: string }[];
}

export default function FilterBar({
  scorigamiType,
  setScorigamiType,
  club,
  setClub,
  yearRange,
  setYearRange,
  onYearRangeCommit,
  sortedTeamsForDropdown,
}: FilterBarProps) {
  const isModernEra = yearRange[0] === MODERN_ERA_START && yearRange[1] === CURRENT_YEAR;
  const isAllTime = yearRange[0] === MIN_YEAR && yearRange[1] === CURRENT_YEAR;

  return (
    <div className="container mx-auto px-4 py-4">
      <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
        {/* Type toggle */}
        <div className="flex-shrink-0">
          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
            Type
          </label>
          <RadioGroup.Root
            value={scorigamiType}
            onValueChange={(v: string) => setScorigamiType(v as ScorigamiType)}
            className="flex items-center gap-0.5 rounded-md bg-slate-100 dark:bg-[#2c2c2c] p-0.5"
          >
            <RadioGroup.Item
              value="traditional"
              className="focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
            >
              <span
                className={`block rounded px-3 py-1.5 text-sm font-medium cursor-pointer transition-colors ${
                  scorigamiType === "traditional"
                    ? "bg-white dark:bg-[#383838] text-slate-900 dark:text-white shadow-sm"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                }`}
              >
                Traditional
              </span>
            </RadioGroup.Item>
            <RadioGroup.Item
              value="home_away"
              className="focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
            >
              <span
                className={`block rounded px-3 py-1.5 text-sm font-medium cursor-pointer transition-colors ${
                  scorigamiType === "home_away"
                    ? "bg-white dark:bg-[#383838] text-slate-900 dark:text-white shadow-sm"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                }`}
              >
                Home/Away
              </span>
            </RadioGroup.Item>
          </RadioGroup.Root>
        </div>

        {/* Team select */}
        <div className="w-44 flex-shrink-0">
          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
            Team
          </label>
          <Select.Root
            value={club}
            onValueChange={(val: string) => setClub(val as FranchiseCode | "ALL")}
          >
            <Select.Trigger className="flex h-9 w-full items-center justify-between rounded-md border border-slate-200 dark:border-[#383838] bg-white dark:bg-[#1e1e1e] px-3 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
              <Select.Value>
                {club === "ALL" ? "All Teams" : TEAM_NAMES[club] ?? club}
              </Select.Value>
              <Select.Icon>
                <ChevronDown className="h-4 w-4 text-slate-400" />
              </Select.Icon>
            </Select.Trigger>
            <Select.Portal>
              <Select.Content
                className="z-[99] max-h-80 w-[var(--radix-select-trigger-width)] overflow-y-auto rounded-md border border-slate-200 dark:border-[#383838] bg-white dark:bg-[#1e1e1e] p-1 text-sm shadow-lg"
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

        {/* Year range slider */}
        <div className="w-full sm:flex-1 sm:w-auto min-w-[200px]">
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Years
            </label>
            <span className="text-xs font-medium text-slate-700 dark:text-slate-300 tabular-nums">
              {yearRange[0]} – {yearRange[1]}
            </span>
          </div>
          <Slider.Root
            value={yearRange}
            onValueChange={(val: number[]) => setYearRange([val[0], val[1]])}
            onValueCommit={(val: number[]) => onYearRangeCommit([val[0], val[1]])}
            min={MIN_YEAR}
            max={CURRENT_YEAR}
            step={1}
            minStepsBetweenThumbs={1}
            className="relative flex items-center select-none touch-none h-5 w-full"
          >
            <Slider.Track className="relative grow h-1 rounded-full bg-slate-200 dark:bg-[#383838]">
              <Slider.Range className="absolute h-full rounded-full bg-blue-500 dark:bg-blue-600" />
            </Slider.Track>
            <Slider.Thumb className="block h-4 w-4 rounded-full bg-white border-2 border-blue-500 shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#121212] cursor-grab active:cursor-grabbing" />
            <Slider.Thumb className="block h-4 w-4 rounded-full bg-white border-2 border-blue-500 shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#121212] cursor-grab active:cursor-grabbing" />
          </Slider.Root>
          <div className="flex items-center gap-4 mt-1.5">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={isModernEra}
                onChange={() => {
                  setYearRange([MODERN_ERA_START, CURRENT_YEAR]);
                  onYearRangeCommit([MODERN_ERA_START, CURRENT_YEAR]);
                }}
                className="h-3.5 w-3.5 rounded border-slate-300 dark:border-[#383838] text-blue-500 focus:ring-blue-500 focus:ring-offset-0 cursor-pointer accent-blue-500"
              />
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Modern Era (1901+)
              </span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={isAllTime}
                onChange={() => {
                  setYearRange([MIN_YEAR, CURRENT_YEAR]);
                  onYearRangeCommit([MIN_YEAR, CURRENT_YEAR]);
                }}
                className="h-3.5 w-3.5 rounded border-slate-300 dark:border-[#383838] text-blue-500 focus:ring-blue-500 focus:ring-offset-0 cursor-pointer accent-blue-500"
              />
              <span className="text-xs text-slate-500 dark:text-slate-400">
                All Time
              </span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
