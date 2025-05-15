"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/* ----------------------------------------------------------------
 *  Types
 * ---------------------------------------------------------------- */
interface ApiRow {
  score1: number;
  score2: number;
  occurrences: number;
}

/* ----------------------------------------------------------------
 *  Constants
 * ---------------------------------------------------------------- */
const TEAMS = [
  "ALL",
  "ARI", "ATL", "BAL", "BOS", "CHA", "CHN", "CIN", "CLE", "COL",
  "DET", "HOU", "KCA", "LAN", "MIL", "MIN", "MIA", "NYA", "NYN",
  "OAK", "PHI", "PIT", "SDN", "SEA", "SFN", "SLN", "TBA", "TEX",
  "TOR", "WAS",
] as const;

/** ▸ Human-readable names */
const TEAM_NAMES: Record<string, string> = {
  ARI: "Arizona Diamondbacks",
  ATL: "Atlanta Braves",
  BAL: "Baltimore Orioles",
  BOS: "Boston Red Sox",
  CHA: "Chicago White Sox",
  CHN: "Chicago Cubs",
  CIN: "Cincinnati Reds",
  CLE: "Cleveland Guardians",
  COL: "Colorado Rockies",
  DET: "Detroit Tigers",
  HOU: "Houston Astros",
  KCA: "Kansas City Royals",
  LAN: "Los Angeles Dodgers",
  MIA: "Miami Marlins",
  MIL: "Milwaukee Brewers",
  MIN: "Minnesota Twins",
  NYA: "New York Yankees",
  NYN: "New York Mets",
  OAK: "Oakland Athletics",
  PHI: "Philadelphia Phillies",
  PIT: "Pittsburgh Pirates",
  SDN: "San Diego Padres",
  SEA: "Seattle Mariners",
  SFN: "San Francisco Giants",
  SLN: "St. Louis Cardinals",
  TBA: "Tampa Bay Rays",
  TEX: "Texas Rangers",
  TOR: "Toronto Blue Jays",
  WAS: "Washington Nationals",
};

const CELL_SIZE = 24;                       // px – tweak for larger / smaller boxes
const fetcher = (url: string) => fetch(url).then((r) => r.json());

/* ----------------------------------------------------------------
 *  Helper functions
 * ---------------------------------------------------------------- */
/** Shade based on relative frequency so filtering keeps deep colors. */
const getColor = (f: number, max: number) => {
  if (f === 0) return "#f3f4f6";            // never happened → light gray

  // proportion of max (0 – 1)
  const p = f / max;

  if (p <= 0.02) return "#dbeafe";
  if (p <= 0.10) return "#bfdbfe";
  if (p <= 0.25) return "#93c5fd";
  if (p <= 0.50) return "#60a5fa";
  if (p <= 0.75) return "#3b82f6";
  if (p <= 0.90) return "#2563eb";
  return "#1d4ed8";
};

const getFrequencyText = (f: number) =>
  f === 0 ? "Never happened" : f === 1 ? "Happened once" : `Happened ${f} times`;

/* ----------------------------------------------------------------
 *  Component
 * ---------------------------------------------------------------- */
export default function ScorigamiHeatmap() {
  const [club, setClub] = useState<(typeof TEAMS)[number]>("ALL");
  const { data: rows } = useSWR<ApiRow[]>(`/api/scorigami?team=${club}`, fetcher);

  const [grid, setGrid] = useState<Record<string, number>>({}); // "5-3" ⇒ 27
  const [maxScore, setMaxScore] = useState(0);                  // axis size
  const [maxFreq, setMaxFreq] = useState(1);                    // brightest cell
  const [hovered, setHovered] = useState<string | null>(null);

  /* ---- Convert API rows to lookup map ------------------------- */
  useEffect(() => {
    if (!rows) return;

    const map: Record<string, number> = {};
    let localMaxScore = 0;
    let localMaxFreq  = 0;

    rows.forEach(({ score1, score2, occurrences }) => {
      const key = `${score1}-${score2}`;
      map[key] = occurrences;
      localMaxScore = Math.max(localMaxScore, score1, score2);
      localMaxFreq  = Math.max(localMaxFreq, occurrences);
    });

    setGrid(map);
    setMaxScore(localMaxScore);
    setMaxFreq(localMaxFreq || 1);          // avoid divide-by-zero
  }, [rows]);

  /* ---- Guard until data loads --------------------------------- */
  if (!rows || maxScore === 0) return null;

  /* ---- Render -------------------------------------------------- */
  return (
    <TooltipProvider>
      {/* ─────────── Team selector ─────────── */}
      <select
        value={club}
        onChange={(e) => setClub(e.target.value as (typeof TEAMS)[number])}
        className="mb-4 border rounded px-2 py-1 text-sm"
      >
        {TEAMS.map((code) => (
          <option key={code} value={code}>
            {code === "ALL" ? "All Teams" : TEAM_NAMES[code]}
          </option>
        ))}
      </select>

      {/* ─────────── Heat-map grid ─────────── */}
      <div className="overflow-auto" style={{ maxHeight: 700 }}>
        <div
          className="relative"
          style={{
            display: "grid",
            gridTemplateColumns: `40px repeat(${maxScore + 1}, ${CELL_SIZE}px)`,
            gridTemplateRows:    `40px repeat(${maxScore + 1}, ${CELL_SIZE}px)`,
          }}
        >
          {/* Corner */}
          <div className="sticky top-0 left-0 z-20 bg-white border-b border-r border-gray-300" />

          {/* Column headers (x-axis) */}
          {Array.from({ length: maxScore + 1 }, (_, i) => (
            <div
              key={`col-${i}`}
              style={{ gridColumn: i + 2, gridRow: 1 }}
              className="sticky top-0 z-10 flex items-center justify-center text-xs font-medium bg-white border-b border-gray-300"
            >
              {i}
            </div>
          ))}

          {/* Row headers (y-axis) */}
          {Array.from({ length: maxScore + 1 }, (_, i) => (
            <div
              key={`row-${i}`}
              style={{ gridColumn: 1, gridRow: i + 2 }}
              className="sticky left-0 z-10 flex items-center justify-center text-xs font-medium bg-white border-r border-gray-300"
            >
              {i}
            </div>
          ))}

          {/* Cells */}
          {Array.from({ length: maxScore + 1 }, (_, home) =>
            Array.from({ length: maxScore + 1 }, (_, away) => {
              const key  = `${home}-${away}`;
              const freq = grid[key] ?? 0;
              const active = hovered === key;

              return (
                <Tooltip key={key}>
                  <TooltipTrigger asChild>
                    <div
                      style={{
                        gridColumn: away + 2,
                        gridRow: home + 2,
                        backgroundColor: getColor(freq, maxFreq),
                        width: CELL_SIZE,
                        height: CELL_SIZE,
                      }}
                      className={`border transition-colors ${
                        active ? "border-black" : "border-gray-100"
                      } cursor-pointer`}
                      onMouseEnter={() => setHovered(key)}
                      onMouseLeave={() => setHovered(null)}
                    />
                  </TooltipTrigger>

                  <TooltipContent>
                    <div className="text-sm font-medium">
                      Home {home} – Visitor {away}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {getFrequencyText(freq)}
                    </div>
                  </TooltipContent>
                </Tooltip>
              );
            })
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
