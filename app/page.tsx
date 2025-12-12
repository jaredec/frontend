"use client";

import React, { useState, useMemo } from "react";
import useSWR from "swr";
import { AlertTriangle, HelpCircle } from "lucide-react";

// Component Imports
import PageHeader from "@/components/page-header";
import ScorigamiHeatmap from "@/components/scorigami-heatmap";
import PageFooter from "@/components/page-footer";

// Data & Type Imports
import { 
  TEAM_NAMES, 
  CURRENT_FRANCHISE_CODES, 
  FranchiseCode, 
  ScorigamiType 
} from "@/lib/mlb-data";

const fetcher = (u: string) => fetch(u).then((r) => r.json());

export default function Home() {
  const [scorigamiType, setScorigamiType] = useState<ScorigamiType>('traditional');
  const [club, setClub] = useState<FranchiseCode | "ALL">("ALL");
  const [selectedYear, setSelectedYear] = useState<string>("ALL");

  const { data: rows, error, isLoading } = useSWR(
    `/api/scorigami?team=${club}&year=${selectedYear}&type=${scorigamiType}`,
    fetcher
  );
  
  const totalGamesDisplayed = useMemo(() => {
    if (!rows || error) return 0;
    // Ensure rows is an array before calling reduce
    return Array.isArray(rows) ? rows.reduce((sum: number, row: { occurrences: number; }) => sum + Number(row.occurrences), 0) : 0;
  }, [rows, error]);

  const sortedTeamsForDropdown = useMemo(() => {
    return CURRENT_FRANCHISE_CODES
      .map(code => ({ code, name: TEAM_NAMES[code] ?? code }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, []);

  return (
    <>
      <main className="min-h-screen container mx-auto px-4 py-8 sm:py-12">
        <PageHeader
          scorigamiType={scorigamiType}
          setScorigamiType={setScorigamiType}
          club={club}
          setClub={setClub}
          selectedYear={selectedYear}
          setSelectedYear={setSelectedYear}
          sortedTeamsForDropdown={sortedTeamsForDropdown}
          totalGamesDisplayed={totalGamesDisplayed}
          isLoading={isLoading}
        />

        <div className="bg-white dark:bg-gray-800/50 border border-slate-200/80 dark:border-gray-700/60 rounded-2xl shadow-xl shadow-slate-900/5">
          {error ? (
            <div className="flex flex-col items-center justify-center p-6 bg-red-50 dark:bg-red-900/30 rounded-xl min-h-[450px] text-center">
              <AlertTriangle className="w-12 h-12 text-red-500 mb-4" />
              <h3 className="text-xl font-semibold text-red-700 dark:text-red-300">Data Load Error</h3>
              <p className="text-red-600 dark:text-red-400 mt-1 max-w-sm">An issue occurred while fetching data from the API. Please try refreshing.</p>
            </div>
          ) : (
            <ScorigamiHeatmap
              rows={rows}
              isLoading={isLoading}
              scorigamiType={scorigamiType}
              club={club}
            />
          )}
        </div>

        <section className="mt-16 grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
                    <HelpCircle className="w-5 h-5 text-blue-500"/> 
                    What is Scorigami?
                </h3>
                <div className="text-sm text-slate-600 dark:text-slate-400 space-y-3 leading-relaxed">
                    <p>
                        <strong className="text-slate-700 dark:text-slate-300">Scorigami</strong> tracks every unique final score in Major League Baseball history. When a game finishes with a score that has never happened before, a &quot;Scorigami&quot; is achieved.
                    </p>
                    <p>
                        This project was inspired by the original <a href="https://nflscorigami.com/" target="_blank" rel="noopener noreferrer" className="font-medium text-blue-600 dark:text-blue-400 hover:underline">NFL Scorigami</a>.
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
      
      <PageFooter />
    </>
  );
}