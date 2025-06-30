// app/page.tsx

"use client";

import React, { useState, useMemo } from "react";
import useSWR from "swr";
import ScorigamiHeatmap from "@/components/scorigami-heatmap";
import * as Select from "@radix-ui/react-select";
import * as RadioGroup from "@radix-ui/react-radio-group";
import { Mail, Twitter, ChevronDown, HelpCircle, Loader2 } from "lucide-react";

// --- Helpers & Data ---
const fetcher = (u: string) => fetch(u).then((r) => r.json());

const CURRENT_FRANCHISE_CODES = [
    "ANA", "ARI", "ATL", "BAL", "BOS", "CHA", "CHN", "CIN", "CLE", "COL",
    "DET", "HOU", "KCA", "LAN", "MIA", "MIL", "MIN", "NYA", "NYN",
    "OAK", "PHI", "PIT", "SDN", "SEA", "SFN", "SLN", "TBA", "TEX", "TOR", "WAS",
] as const;

type FranchiseCode = typeof CURRENT_FRANCHISE_CODES[number];
type ScorigamiType = "oriented" | "traditional";

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

const CURRENT_YEAR = new Date().getFullYear();
const EARLIEST_MLB_YEAR = 1871;
const YEARS_FOR_DROPDOWN: string[] = ["ALL"];
for (let y = CURRENT_YEAR; y >= EARLIEST_MLB_YEAR; y--) {
  YEARS_FOR_DROPDOWN.push(y.toString());
}

export default function Home() {
  const [scorigamiType, setScorigamiType] = useState<ScorigamiType>('traditional');
  const [club, setClub] = useState<FranchiseCode | "ALL">("ALL");
  const [selectedYear, setSelectedYear] = useState<string>("ALL");

  const { data: rows, error, isLoading } = useSWR(
    `/api/scorigami?team=${club}&year=${selectedYear}&type=${scorigamiType}`,
    fetcher
  );
  
  const totalGamesDisplayed = useMemo(() => {
    if (!rows) return 0;
    return rows.reduce((sum: number, row: { occurrences: number; }) => sum + Number(row.occurrences), 0);
  }, [rows]);

  const sortedTeamsForDropdown = useMemo(() => {
    return CURRENT_FRANCHISE_CODES
      .map(code => ({ code, name: TEAM_NAMES[code] ?? code }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, []);

  return (
    <>
      <main className="min-h-screen container mx-auto px-4 py-8 sm:py-12">
        <header className="border-b border-slate-200 dark:border-slate-700 pb-6 mb-8">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                        MLB Scorigami
                    </h1>
                     {isLoading && (
                         <p className="flex items-center text-sm text-slate-500 dark:text-slate-400 mt-2">
                           <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                           <span>Loading...</span>
                         </p>
                     )}
                     {!isLoading && rows && (
                         <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                           Showing <span className="font-semibold text-blue-600 dark:text-blue-400">{totalGamesDisplayed.toLocaleString()}</span> games
                         </p>
                     )}
                </div>
                <div className="flex flex-col sm:flex-row sm:items-end gap-x-4 gap-y-4">
                    <div>
                        <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Type</label>
                        <RadioGroup.Root value={scorigamiType} onValueChange={(v: ScorigamiType) => setScorigamiType(v)} className="flex items-center gap-1 rounded-lg bg-slate-100 dark:bg-gray-800 p-1">
                          <RadioGroup.Item value="traditional" id="rg-trad-sm" className="focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-md">
                            <label htmlFor="rg-trad-sm" className={`block text-center rounded-md px-3 py-1 text-sm font-medium cursor-pointer transition-colors whitespace-nowrap ${scorigamiType === 'traditional' ? 'bg-white dark:bg-blue-600 text-blue-700 dark:text-white shadow-sm' : 'hover:bg-slate-200 dark:hover:bg-gray-700'}`}>Traditional</label>
                          </RadioGroup.Item>
                          <RadioGroup.Item value="oriented" id="rg-ori-sm" className="focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-md">
                            <label htmlFor="rg-ori-sm" className={`block text-center rounded-md px-3 py-1 text-sm font-medium cursor-pointer transition-colors whitespace-nowrap ${scorigamiType === 'oriented' ? 'bg-white dark:bg-blue-600 text-blue-700 dark:text-white shadow-sm' : 'hover:bg-slate-200 dark:hover:bg-gray-700'}`}>Oriented</label>
                          </RadioGroup.Item>
                        </RadioGroup.Root>
                    </div>
                    <div>
                        <label htmlFor="team-select" className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Team</label>
                        <Select.Root value={club} onValueChange={(val: FranchiseCode | "ALL") => setClub(val)}>
                          <Select.Trigger id="team-select" className="flex h-9 w-full sm:w-48 items-center justify-between rounded-md border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400 dark:focus:ring-slate-400 focus:ring-offset-2 dark:focus:ring-offset-slate-900">
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
                    <div>
                        <label htmlFor="year-select" className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Year</label>
                        <Select.Root value={selectedYear} onValueChange={(val) => setSelectedYear(val as string)}>
                            <Select.Trigger id="year-select" className="flex h-9 w-full sm:w-32 items-center justify-between rounded-md border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400 dark:focus:ring-slate-400 focus:ring-offset-2 dark:focus:ring-offset-slate-900">
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

        <div className="bg-white dark:bg-gray-800/50 border border-slate-200/80 dark:border-gray-700/60 rounded-2xl shadow-xl shadow-slate-900/5">
            <ScorigamiHeatmap
              rows={rows}
              isLoading={isLoading}
              error={error}
              scorigamiType={scorigamiType}
              club={club}
            />
        </div>

        <section className="mt-16 grid md:grid-cols-2 gap-x-12 gap-y-8">
            <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
                    <HelpCircle className="w-5 h-5 text-blue-500"/> 
                    What is Scorigami?
                </h3>
                <div className="text-sm text-slate-600 dark:text-slate-400 space-y-3">
                    <p>
                        <strong className="text-slate-700 dark:text-slate-300">Scorigami</strong> tracks every unique final score in Major League Baseball history. When a game finishes with a score that has never happened before, a &quot;Scorigami&quot; is achieved.
                    </p>
                    <p>
                        This project was inspired by the original <a href="https://nflscorigami.com/" target="_blank" rel="noopener noreferrer" className="font-medium text-blue-600 dark:text-blue-400 hover:underline">NFL Scorigami</a> by Jon Bois.
                    </p>
                </div>
            </div>
            <div>
                 <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-3">
                    Data & Attribution
                </h3>
                <div className="text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-gray-800/50 p-4 rounded-lg space-y-2 border border-slate-200 dark:border-slate-700">
                    <p>The information used here was obtained free of charge from and is copyrighted by Retrosheet.</p>
                    <p>Interested parties may contact Retrosheet at 20 Sunset Rd., Newark, DE 19711.</p>
                </div>
            </div>
        </section>
      </main>
      
      <footer className="w-full mt-8 pb-8">
         <div className="container mx-auto px-4 text-center text-slate-500 dark:text-slate-400 text-sm">
              <div className="border-t border-slate-200 dark:border-gray-700 pt-8 flex flex-col sm:flex-row justify-center items-center gap-x-6 gap-y-4">
                  <p>Created by <a href="https://www.linkedin.com/in/jared-connolly/" target="_blank" rel="noopener noreferrer" className="font-medium hover:underline text-blue-600 dark:text-blue-400">Jared Connolly</a></p>
                  <div className="h-4 w-px bg-slate-300 dark:bg-gray-600 hidden sm:block"></div>
                  <div className="flex items-center gap-4">
                     <a href="https://x.com/MLB_Scorigami_" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"><Twitter className="w-4 h-4" /><span>@MLB_Scorigami_</span></a>
                     <a href="mailto:jaredconnolly5@gmail.com" className="flex items-center gap-2 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"><Mail className="w-4 h-4" /><span>Contact</span></a>
                  </div>
              </div>
          </div>
      </footer>
    </>
  );
}