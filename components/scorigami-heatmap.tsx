"use client"

import { useEffect, useState } from "react"
import Papa from "papaparse"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

/* ----------------------------------------------------------------
 *  Types
 * ---------------------------------------------------------------- */
type CsvRow = {
  score1: string   // home / first team score
  score2: string   // away / second team score
  occurrences: string
}

/* ----------------------------------------------------------------
 *  Constants
 * ---------------------------------------------------------------- */
const MAX_SCORE = 30                       // render 0-30 on both axes
const CSV_PATH  = "/data/mlb_scorigami_scores.csv"  // file lives in /public/data

/* ----------------------------------------------------------------
 *  Helper functions
 * ---------------------------------------------------------------- */
const getColor = (f: number) => {
  if (f === 0) return "#f3f4f6"
  if (f <= 10) return "#dbeafe"
  if (f <= 50) return "#bfdbfe"
  if (f <= 200) return "#93c5fd"
  if (f <= 500) return "#60a5fa"
  if (f <= 1000) return "#3b82f6"
  if (f <= 2500) return "#2563eb"
  return "#1d4ed8"
}

const getFrequencyText = (f: number) =>
  f === 0 ? "Never happened" : f === 1 ? "Happened once" : `Happened ${f} times`

/* ----------------------------------------------------------------
 *  Component
 * ---------------------------------------------------------------- */
export default function ScorigamiHeatmap() {
  const [data, setData] = useState<Record<string, number>>({}) // "5-3" => 27
  const [hovered, setHovered] = useState<string | null>(null)

  /* ---- Load CSV once on mount --------------------------------- */
  useEffect(() => {
    Papa.parse<CsvRow>(CSV_PATH, {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: ({ data: rows }) => {
        const map: Record<string, number> = {}
        rows.forEach(({ score1, score2, occurrences }) => {
          const h = parseInt(score1, 10)
          const a = parseInt(score2, 10)
          const n = parseInt(occurrences, 10)
          if (!isNaN(h) && !isNaN(a) && !isNaN(n)) {
            map[`${h}-${a}`] = n
          }
        })
        setData(map)
      },
    })
  }, [])

  /* ---- Render -------------------------------------------------- */
  return (
    <TooltipProvider>
      <div className="w-full overflow-auto" style={{ maxHeight: 700 }}>
        {/* Column headers */}
        <div className="flex border-b border-gray-300 sticky top-0 bg-white z-10 pl-10">
          <div className="w-10 flex-shrink-0" />
          {Array.from({ length: MAX_SCORE + 1 }, (_, i) => (
            <div key={i} className="w-6 flex-shrink-0 text-xs text-center font-medium">
              {i}
            </div>
          ))}
        </div>

        <div className="flex">
          {/* Row headers */}
          <div className="sticky left-0 bg-white z-10">
            {Array.from({ length: MAX_SCORE + 1 }, (_, i) => (
              <div
                key={i}
                className="h-6 w-10 flex items-center justify-center text-xs font-medium border-r border-gray-300"
              >
                {i}
              </div>
            ))}
          </div>

          {/* Grid */}
          <div>
            {Array.from({ length: MAX_SCORE + 1 }, (_, home) => (
              <div key={home} className="flex h-6">
                {Array.from({ length: MAX_SCORE + 1 }, (_, away) => {
                  const key = `${home}-${away}`
                  const freq = data[key] ?? 0
                  const active = hovered === key

                  return (
                    <Tooltip key={key}>
                      <TooltipTrigger asChild>
                        <div
                          className={`w-6 h-6 cursor-pointer border transition-colors ${
                            active ? "border-black" : "border-gray-100"
                          }`}
                          style={{ backgroundColor: getColor(freq) }}
                          onMouseEnter={() => setHovered(key)}
                          onMouseLeave={() => setHovered(null)}
                        />
                      </TooltipTrigger>
                      <TooltipContent>
                        <div className="text-sm font-medium">Score {key}</div>
                        <div className="text-xs text-gray-600">{getFrequencyText(freq)}</div>
                      </TooltipContent>
                    </Tooltip>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}
