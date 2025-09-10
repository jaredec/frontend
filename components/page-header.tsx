"use client";

import React from "react";
import * as Select from "@radix-ui/react-select";
import * as RadioGroup from "@radix-ui/react-radio-group";
import { ChevronDown, Loader2 } from "lucide-react";
import { TEAM_NAMES, YEARS_FOR_DROPDOWN, FranchiseCode, ScorigamiType } from "@/lib/mlb-data";

interface PageHeaderProps {
  scorigamiType: ScorigamiType;
  setScorigamiType: (value: ScorigamiType) => void;
  club: FranchiseCode | "ALL";
  setClub: (value: FranchiseCode | "ALL") => void;
  selectedYear: string;
  setSelectedYear: (value: string) => void;
  sortedTeamsForDropdown: { code: string; name: string }[];
  totalGamesDisplayed: number;
  isLoading: boolean;
}

export default function PageHeader({
  scorigamiType, setScorigamiType,
  club, setClub,
  selectedYear, setSelectedYear,
  sortedTeamsForDropdown,
  totalGamesDisplayed,
  isLoading
}: PageHeaderProps) {
  return (
    <header className="border-b border-slate-200 dark:border-slate-700 pb-6 mb-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div className="text-center md:text-left">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            MLB Scorigami
          </h1>
          {isLoading && (
            <p className="flex items-center justify-center md:justify-start text-sm text-slate-500 dark:text-slate-400 mt-2">
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              <span>Loading...</span>
            </p>
          )}
          {!isLoading && totalGamesDisplayed > 0 && (
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Showing <span className="font-semibold text-blue-600 dark:text-blue-400">{totalGamesDisplayed.toLocaleString()}</span> games
            </p>
          )}
        </div>
        
        <div className="grid grid-cols-2 gap-4 md:flex md:items-end">
            <div className="col-span-2 md:col-span-1">
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Type</label>
                <RadioGroup.Root value={scorigamiType} onValueChange={(v: ScorigamiType) => setScorigamiType(v)} className="flex items-center gap-1 rounded-lg bg-slate-100 dark:bg-gray-800 p-1 w-full">
                  <RadioGroup.Item value="traditional" id="rg-trad-sm" className="w-full focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-md">
                    <label htmlFor="rg-trad-sm" className={`block text-center rounded-md px-3 py-1 text-sm font-medium cursor-pointer transition-colors whitespace-nowrap ${scorigamiType === 'traditional' ? 'bg-white dark:bg-blue-600 text-blue-700 dark:text-white shadow-sm' : 'hover:bg-slate-200 dark:hover:bg-gray-700'}`}>Traditional</label>
                  </RadioGroup.Item>
                  <RadioGroup.Item value="oriented" id="rg-ori-sm" className="w-full focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-md">
                    <label htmlFor="rg-ori-sm" className={`block text-center rounded-md px-3 py-1 text-sm font-medium cursor-pointer transition-colors whitespace-nowrap ${scorigamiType === 'oriented' ? 'bg-white dark:bg-blue-600 text-blue-700 dark:text-white shadow-sm' : 'hover:bg-slate-200 dark:hover:bg-gray-700'}`}>Oriented</label>
                  </RadioGroup.Item>
                </RadioGroup.Root>
            </div>
            <div className="md:w-48">
                <label htmlFor="team-select" className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Team</label>
                <Select.Root value={club} onValueChange={(val: FranchiseCode | "ALL") => setClub(val)}>
                  <Select.Trigger id="team-select" className="flex h-9 w-full items-center justify-between rounded-md border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400 dark:focus:ring-slate-400 focus:ring-offset-2 dark:focus:ring-offset-slate-900">
                    <Select.Value aria-label={club}>{club === "ALL" ? "All Teams" : TEAM_NAMES[club] ?? club}</Select.Value>
                    <Select.Icon><ChevronDown className="h-4 w-4" /></Select.Icon>
                  </Select.Trigger>
                    <Select.Portal>
                    <Select.Content className="z-[99] max-h-80 w-[var(--radix-select-trigger-width)] overflow-y-auto rounded-lg border bg-white p-1.5 text-sm shadow-xl dark:bg-gray-800 dark:border-gray-700" position="popper" sideOffset={6}>
                        <Select.Viewport className="p-1">
                          <Select.Item value="ALL" className="cursor-pointer select-none rounded-md px-3 py-2 text-sm leading-none outline-none text-gray-800 dark:text-gray-100 data-[highlighted]:bg-blue-500 data-[highlighted]:text-white dark:data-[highlighted]:bg-blue-600"><Select.ItemText>All Teams</Select.ItemText></Select.Item>
                          {sortedTeamsForDropdown.map((team) => (
                            <Select.Item key={team.code} value={team.code} className="cursor-pointer select-none rounded-md px-3 py-2 text-sm leading-none outline-none text-gray-800 dark:text-gray-100 data-[highlighted]:bg-blue-500 data-[highlighted]:text-white dark:data-[highlighted]:bg-blue-600"><Select.ItemText>{team.name}</Select.ItemText></Select.Item>
                          ))}
                        </Select.Viewport>
                    </Select.Content>
                  </Select.Portal>
                </Select.Root>
            </div>
            <div className="md:w-32">
                <label htmlFor="year-select" className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Year</label>
                <Select.Root value={selectedYear} onValueChange={(val) => setSelectedYear(val as string)}>
                    <Select.Trigger id="year-select" className="flex h-9 w-full items-center justify-between rounded-md border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400 dark:focus:ring-slate-400 focus:ring-offset-2 dark:focus:ring-offset-slate-900">
                      <Select.Value aria-label={selectedYear}>{selectedYear === "ALL" ? "All Years" : selectedYear}</Select.Value>
                      <Select.Icon><ChevronDown className="h-4 w-4" /></Select.Icon>
                    </Select.Trigger>
                      <Select.Portal>
                      <Select.Content className="z-[99] max-h-80 w-[var(--radix-select-trigger-width)] overflow-y-auto rounded-lg border bg-white p-1.5 text-sm shadow-xl dark:bg-gray-800 dark:border-gray-700" position="popper" sideOffset={6}>
                        <Select.Viewport className="p-1">
                            {YEARS_FOR_DROPDOWN.map((year) => (
                              <Select.Item key={year} value={year} className="cursor-pointer select-none rounded-md px-3 py-2 text-sm leading-none outline-none text-gray-800 dark:text-gray-100 data-[highlighted]:bg-blue-500 data-[highlighted]:text-white dark:data-[highlighted]:bg-blue-600"><Select.ItemText>{year === 'ALL' ? 'All Years' : year}</Select.ItemText></Select.Item>
                            ))}
                        </Select.Viewport>
                      </Select.Content>
                    </Select.Portal>
                </Select.Root>
            </div>
        </div>
      </div>
    </header>
  );
}