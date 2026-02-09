"use client";

import React from "react";
import Image from "next/image";
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

// Component to hold the logo image
const LogoImage = () => (
  <Image 
    src="/logo3.svg" 
    alt="MLB Scorigami Logo" 
    // 1. Give it "base" dimensions. Since it's taller than wide, 
    // we use a 3:4 ratio (48x64). This prevents the "tiny" look.
    width={48} 
    height={64} 
    // 2. priority is essential to stop the Vercel/LCP warning.
    priority
    // 3. style={{ width: 'auto' }} is the ONLY way to stop the console 
    // aspect-ratio warning when using height classes like h-12.
    style={{ width: 'auto' }}
    // 4. h-12 (48px) and md:h-14 (56px) are your original exact sizes.
    // w-auto ensures it doesn't stretch or cover the whole page.
    className="h-12 md:h-14 w-auto mr-3 md:mr-4 flex-shrink-0" 
  />
);
    
export default function PageHeader({
  scorigamiType, setScorigamiType,
  club, setClub,
  selectedYear, setSelectedYear,
  sortedTeamsForDropdown,
  totalGamesDisplayed,
  isLoading
}: PageHeaderProps) {
  return (
    <header className="border-b border-slate-200 dark:border-[#383838] pb-6 mb-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between md:gap-6">
        
        {/* LEFT SECTION: Logo and Text Block */}
        <div className="flex items-center justify-center md:justify-start mb-4 md:mb-0 flex-shrink-0">
            
            <LogoImage />

            <div className="flex flex-col text-center md:text-left">
                <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                    MLB Scorigami
                </h1>
                
                {isLoading && (
                    <p className="flex items-center justify-center md:justify-start text-sm text-slate-500 dark:text-slate-400">
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        <span>Loading...</span>
                    </p>
                )}
                {!isLoading && totalGamesDisplayed > 0 && (
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        Showing <span className="font-semibold text-blue-600 dark:text-blue-400">{totalGamesDisplayed.toLocaleString()}</span> games
                    </p>
                )}
            </div>
        </div>
        
        {/* RIGHT SECTION: Filters */}
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:gap-4 w-full md:w-auto">
            
            <div className="md:col-span-1">
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Type</label>
                <RadioGroup.Root value={scorigamiType} onValueChange={(v: ScorigamiType) => setScorigamiType(v)} className="flex items-center gap-1 rounded-lg bg-slate-100 dark:bg-[#2c2c2c] p-1 w-full">
                  <RadioGroup.Item value="traditional" id="rg-trad-sm" className="w-full focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-md">
                    <label htmlFor="rg-trad-sm" className={`block text-center rounded-md px-3 py-1 text-sm font-medium cursor-pointer transition-colors whitespace-nowrap ${scorigamiType === 'traditional' ? 'bg-white dark:bg-[#383838] text-blue-700 dark:text-white shadow-sm' : 'hover:bg-slate-200 dark:hover:bg-[#383838]'}`}>Traditional</label>
                  </RadioGroup.Item>
                  <RadioGroup.Item value="home_away" id="rg-ha-sm" className="w-full focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-md">
                    <label htmlFor="rg-ha-sm" className={`block text-center rounded-md px-3 py-1 text-sm font-medium cursor-pointer transition-colors whitespace-nowrap ${scorigamiType === 'home_away' ? 'bg-white dark:bg-[#383838] text-blue-700 dark:text-white shadow-sm' : 'hover:bg-slate-200 dark:hover:bg-[#383838]'}`}>Home/Away</label>
                  </RadioGroup.Item>
                </RadioGroup.Root>
            </div>

            <div className="flex gap-4">
                <div className="w-full md:w-48"> 
                    <label htmlFor="team-select" className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Team</label>
                    <Select.Root value={club} onValueChange={(val: FranchiseCode | "ALL") => setClub(val)}>
                    <Select.Trigger id="team-select" className="flex h-9 w-full items-center justify-between rounded-md border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400 dark:focus:ring-slate-400 focus:ring-offset-2 dark:focus:ring-offset-[#121212]">
                        <Select.Value aria-label={club}>{club === "ALL" ? "All Teams" : TEAM_NAMES[club] ?? club}</Select.Value>
                        <Select.Icon><ChevronDown className="h-4 w-4" /></Select.Icon>
                    </Select.Trigger>
                        <Select.Portal>
                        <Select.Content className="z-[99] max-h-80 w-[var(--radix-select-trigger-width)] overflow-y-auto rounded-lg border bg-white p-1.5 text-sm shadow-xl dark:bg-[#2c2c2c] dark:border-[#383838]" position="popper" sideOffset={6}>
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

                <div className="w-full md:w-32">
                    <label htmlFor="year-select" className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Year</label>
                    <Select.Root value={selectedYear} onValueChange={(val) => setSelectedYear(val as string)}>
                        <Select.Trigger id="year-select" className="flex h-9 w-full items-center justify-between rounded-md border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400 dark:focus:ring-slate-400 focus:ring-offset-2 dark:focus:ring-offset-[#121212]">
                        <Select.Value aria-label={selectedYear}>{selectedYear === "ALL" ? "All Years" : selectedYear}</Select.Value>
                        <Select.Icon><ChevronDown className="h-4 w-4" /></Select.Icon>
                        </Select.Trigger>
                        <Select.Portal>
                        <Select.Content className="z-[99] max-h-80 w-[var(--radix-select-trigger-width)] overflow-y-auto rounded-lg border bg-white p-1.5 text-sm shadow-xl dark:bg-[#2c2c2c] dark:border-[#383838]" position="popper" sideOffset={6}>
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
      </div>
    </header>
  );
}