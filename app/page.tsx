"use client";

import React, { useState, useMemo } from "react";
import useSWR from "swr";
import { AlertTriangle } from "lucide-react";
import PageHeader from "@/components/page-header";
import ScorigamiHeatmap from "@/components/scorigami-heatmap";
import PageFooter from "@/components/page-footer";
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

  const { data: rows, error, isLoading, isValidating } = useSWR(
    `/api/scorigami?team=${club}&year=${selectedYear}&type=${scorigamiType}`,
    fetcher,
    {
        revalidateOnFocus: false,
        revalidateIfStale: false,
        dedupingInterval: 3600000, 
        keepPreviousData: true 
    }
  );
  
  const totalGamesDisplayed = useMemo(() => {
    if (!rows || error || !Array.isArray(rows)) return 0;
    return rows.reduce((sum: number, row: { occurrences: number; }) => sum + Number(row.occurrences), 0);
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
          isLoading={isLoading && !rows}
        />

        <div className="relative bg-white dark:bg-gray-800/50 border border-slate-200/80 dark:border-gray-700/60 rounded-2xl shadow-xl overflow-hidden min-h-[500px]">
          
          {/* High-Precision 1px Loading Bar */}
          <div className={`absolute top-0 left-0 right-0 h-[1.5px] bg-blue-500/10 z-50 transition-opacity duration-300 ${isValidating ? 'opacity-100' : 'opacity-0'}`}>
            <div className="h-full bg-blue-600 animate-loading-bar w-full origin-left" />
          </div>

          {error ? (
            <div className="flex flex-col items-center justify-center p-6 min-h-[450px] text-center">
              <AlertTriangle className="w-12 h-12 text-red-500 mb-4" />
              <h3 className="text-xl font-semibold text-red-700">Data Load Error</h3>
              <p className="text-red-600 mt-1 max-w-sm">Please refresh the page.</p>
            </div>
          ) : (
            <div className="transition-opacity duration-200">
              <ScorigamiHeatmap
                rows={rows}
                isLoading={isLoading && !rows}
                scorigamiType={scorigamiType}
                club={club}
              />
            </div>
          )}
        </div>
      </main>
      <PageFooter />

      <style jsx global>{`
        @keyframes loading-bar {
          0% { transform: scaleX(0); opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { transform: scaleX(1); opacity: 0; }
        }
        .animate-loading-bar {
          animation: loading-bar 0.6s cubic-bezier(0.4, 0, 0.2, 1) infinite;
        }
      `}</style>
    </>
  );
}