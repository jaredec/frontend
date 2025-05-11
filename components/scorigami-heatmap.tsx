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
const TEAMS = ["ALL", "SDN", "TBA", "NYA", "PIT", "DET", "ANA"] as const; // add more codes as desired
const CELL_SIZE = 24; // px – tweak for larger / smaller boxes
const fetcher = (url: string) => fetch(url).then((r) => r.json());

/* ----------------------------------------------------------------
 *  Helper functions
 * ---------------------------------------------------------------- */
const getColor = (f: number) => {
  if (f === 0) return "#f3f4f6";
  if (f <= 10) return "#dbeafe";
  if (f <= 50) return "#bfdbfe";
  if (f <= 200) return "#93c5fd";
  if (f <= 500) return "#60a5fa";
  if (f <= 1000) return "#3b82f6";
  if (f <= 2500) return "#2563eb";
  return "#1d4ed8";
};

const getFrequencyText = (f: number) =>
  f === 0 ? "Never happened" : f === 1 ? "Happened once" : `Happened ${f} times`;

/* ----------------------------------------------------------------
 *  Component
 * ---------------------------------------------------------------- */
export default function ScorigamiHeatmap() {
  const [club, setClub] = useState<(typeof TEAMS)[number]>("ALL");
  const { data: rows } = useSWR<ApiRow[]>(
    `/api/scorigami?team=${club}`,
    fetcher
  );

  const [data, setData] = useState<Record<string, number>>({}); // "5-3" ⇒ 27
  const [maxScore, setMaxScore] = useState(0);
  const [hovered, setHovered] = useState<string | null>(null);

  /* ---- Convert API rows to lookup map ------------------------- */
  useEffect(() => {
    if (!rows) return;

    const map: Record<string, number> = {};
    let localMax = 0;

    rows.forEach(({ score1, score2, occurrences }) => {
      const key = `${score1}-${score2}`;
      map[key] = occurrences;
      localMax = Math.max(localMax, score1, score2);
    });

    setData(map);
    setMaxScore(localMax);
  }, [rows]);

  /* ---- Guard until data loads --------------------------------- */
  if (!rows || maxScore === 0) return null;

  /* ---- Render -------------------------------------------------- */
  return (
    <TooltipProvider>
      {/* ─────────── Team selector ─────────── */}
      <select
        value={club}
        onChange={(e) => setClub(e.target.value as any)}
        className="mb-4 border rounded px-2 py-1 text-sm"
      >
        {TEAMS.map((t) => (
          <option key={t} value={t}>
            {t === "ALL" ? "All Teams" : t}
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
            gridTemplateRows: `40px repeat(${maxScore + 1}, ${CELL_SIZE}px)`,
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
              const key = `${home}-${away}`;
              const freq = data[key] ?? 0;
              const active = hovered === key;

              return (
                <Tooltip key={key}>
                  <TooltipTrigger asChild>
                    <div
                      style={{
                        gridColumn: away + 2,
                        gridRow: home + 2,
                        backgroundColor: getColor(freq),
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
