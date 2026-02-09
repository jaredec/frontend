"use client";

import React, { useState, useMemo } from "react";
import useSWR from "swr";
import { AlertTriangle, HelpCircle } from "lucide-react";

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
          // The header will never show a spinner after the initial load
          isLoading={isLoading && !rows} 
        />

        <div className="relative bg-white dark:bg-[#1e1e1e] border border-slate-200/80 dark:border-[#2c2c2c] rounded-2xl shadow-xl overflow-hidden min-h-[500px]">
          
          {/* Subtle Top Loading Line (1.5px) */}
          {isValidating && (
            <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-blue-500/10 z-50">
              <div className="h-full bg-blue-600 animate-loading-bar w-full origin-left" />
            </div>
          )}

          {error ? (
            <div className="flex flex-col items-center justify-center p-6 min-h-[450px] text-center">
              <AlertTriangle className="w-12 h-12 text-red-500 mb-4" />
              <h3 className="text-xl font-semibold text-red-700">Data Offline</h3>
              <p className="text-red-600">The connection to Supabase was interrupted.</p>
            </div>
          ) : (
            /* No transitions or scale changes = Perfect Smoothness */
            <ScorigamiHeatmap
              rows={rows}
              isLoading={isLoading && !rows} 
              scorigamiType={scorigamiType}
              club={club}
            />
          )}
        </div>

        <section className="mt-16 grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
                    <HelpCircle className="w-5 h-5 text-blue-500"/> What is Scorigami?
                </h3>
                <div className="text-sm text-slate-600 dark:text-slate-400 space-y-3 leading-relaxed">
                    <p>Scorigami tracks every unique final score in MLB history. When a game finishes with a score that has never happened before, a Scorigami is achieved.</p>
                </div>
            </div>
            <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-3">Data Attribution</h3>
                <div className="text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-[#1e1e1e] p-4 rounded-lg border border-slate-200 dark:border-[#2c2c2c]">
                    <p>Modern game results provided by the MLB Stats API. Federal League data and 1871–1900 records were obtained from and are copyrighted by Retrosheet.</p>
                </div>
            </div>
        </section>
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
          animation: loading-bar 0.7s cubic-bezier(0.65, 0, 0.35, 1) infinite;
        }
      `}</style>
    </>
  );
}