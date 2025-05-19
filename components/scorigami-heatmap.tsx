"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import {
  Tooltip,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import * as Select from "@radix-ui/react-select";
import { ChevronDown, ChevronUp } from "lucide-react";

/* ───────── Types ───────── */
interface ApiRow {
  score1: number;
  score2: number;
  occurrences: number; // Typed as number, but we'll be extra careful
  last_date: string | null;
  last_home_team: string | null;
  last_visitor_team: string | null;
}

/* ───────── Helpers ───────── */
const formatDisplayDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });

/* Tooltip w/out arrow */
type TCProps = React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>;
const TooltipContent = ({ className = "", ...props }: TCProps) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      side="right"
      sideOffset={8}
      className={
        "rounded-md bg-white dark:bg-gray-900 shadow-lg ring-1 ring-gray-200 " +
        "dark:ring-gray-700 px-3 py-2 text-xs " +
        className
      }
      {...props}
    />
  </TooltipPrimitive.Portal>
);

/* ───────── Teams Data ───────── */
const CURRENT_FRANCHISE_CODES = [
  "ANA", "ARI", "ATL", "BAL", "BOS", "CHA", "CHN", "CIN", "CLE", "COL",
  "DET", "HOU", "KCA", "LAN", "MIA", "MIL", "MIN", "NYA", "NYN",
  "OAK", "PHI", "PIT", "SDN", "SEA", "SFN", "SLN", "TBA", "TEX", "TOR", "WAS",
] as const;

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

const TEAM_CODE_TO_MODERN_FRANCHISE: Record<string, string> = {
  ANA: "ANA", ARI: "ARI", ATL: "ATL", BAL: "BAL", BLA: "NYA",
  BOS: "BOS", BR3: "LAN", BRO: "LAN", BS1: "ATL", BSN: "ATL",
  CAL: "ANA", CH1: "CHN", CH2: "CHN", CHA: "CHA", CHN: "CHN",
  CIN: "CIN", CLE: "CLE", CN2: "CIN", COL: "COL", DET: "DET",
  FLO: "MIA", HOU: "HOU", KC1: "OAK", KCA: "KCA", LAA: "ANA",
  LAN: "LAN", MIA: "MIA", MIL: "MIL", MIN: "MIN", MLA: "BAL",
  MLN: "ATL", MON: "WAS", NY1: "SFN", NYA: "NYA", NYN: "NYN",
  OAK: "OAK", PHA: "OAK", PHI: "PHI", PIT: "PIT", PT1: "PIT",
  SDN: "SDN", SE1: "MIL", SEA: "SEA", SFN: "SFN", SL4: "SLN",
  SLA: "BAL", SLN: "SLN", TBA: "TBA", TEX: "TEX", TOR: "TOR",
  WAS: "WAS", WS1: "MIN", WS2: "TEX"
};
CURRENT_FRANCHISE_CODES.forEach(code => {
    if (!TEAM_CODE_TO_MODERN_FRANCHISE[code]) {
        TEAM_CODE_TO_MODERN_FRANCHISE[code] = code;
    }
});

const getDisplayTeamName = (apiTeamCode: string | null): string => {
  if (!apiTeamCode) return "N/A";
  const modernFranchiseCode = TEAM_CODE_TO_MODERN_FRANCHISE[apiTeamCode] ?? apiTeamCode;
  return TEAM_NAMES[modernFranchiseCode] ?? modernFranchiseCode;
};

/* ───────── Date Filter Years ───────── */
const CURRENT_YEAR = new Date().getFullYear();
const EARLIEST_MLB_YEAR = 1871;
const YEARS_FOR_DROPDOWN: string[] = ["ALL"];
for (let y = CURRENT_YEAR; y >= EARLIEST_MLB_YEAR; y--) {
  YEARS_FOR_DROPDOWN.push(y.toString());
}

/* ───────── Misc constants ───────── */
const CELL_SIZE = 22;
const fetcher = (u: string) => fetch(u).then((r) => r.json());
const MAX_DISPLAY_SCORE = 30;
const GRID_DIMENSION = MAX_DISPLAY_SCORE + 1;

const stops = [0, 10, 50, 200, 500, 1000, 2500];
const hex = [
  "#f3f4f6", "#dbeafe", "#bfdbfe", "#93c5fd", "#60a5fa",
  "#3b82f6", "#2563eb", "#1d4ed8",
];
const getColor = (f: number) => {
  for (let i = 0; i < stops.length; i++) if (f <= stops[i]) return hex[i];
  return hex.at(-1)!;
};
const freqText = (f: number) =>
  f === 0 ? "Never happened" : f === 1 ? "Happened once" : `Happened ${f} times`;

/* ───────── Component ───────── */
export default function ScorigamiHeatmap() {
  const [club, setClub] = useState<(typeof CURRENT_FRANCHISE_CODES[number] | "ALL")>("ALL");
  const [selectedYear, setSelectedYear] = useState<string>("ALL");

  const { data: rows, error, isLoading } = useSWR<ApiRow[]>(
    `/api/scorigami?team=${club}&year=${selectedYear}`,
    fetcher
  );

  const lastRows = useRef<ApiRow[] | null>(null);
  if (rows) lastRows.current = rows;
  const effectiveRows = rows ?? lastRows.current;
  const hasData = !!effectiveRows && effectiveRows.length > 0;

  const [data, setData] = useState<Record<string, ApiRow | undefined>>({});
  useEffect(() => {
    if (!hasData || !effectiveRows) {
      setData({});
      return;
    }
    const map: Record<string, ApiRow> = {};
    effectiveRows!.forEach((r) => (map[`${r.score1}-${r.score2}`] = r));
    setData(map);
  }, [effectiveRows, hasData]);

  const [hover, setHover] = useState<string | null>(null);

  const sortedTeamsForDropdown = useMemo(() => {
    return CURRENT_FRANCHISE_CODES
      .map(code => ({ code, name: TEAM_NAMES[code] ?? code }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, []);

  const totalGamesDisplayed = useMemo(() => {
    if (!effectiveRows || effectiveRows.length === 0) return 0;
    return effectiveRows.reduce((sum, row) => {
      return sum + Number(row.occurrences); // Ensure numerical addition
    }, 0);
  }, [effectiveRows]);

  if (error) return <div className="text-center py-10 text-red-600 dark:text-red-400">Failed to load data. Please try again.</div>;
  if (isLoading) return <div className="text-center py-10 text-gray-500 dark:text-gray-400">Loading heatmap data...</div>;
  if (!hasData && !isLoading) return <div className="text-center py-10 text-gray-500 dark:text-gray-400">No Scorigami data found for the current selection.</div>;

  return (
    <TooltipProvider>
      <div className="mb-6 flex flex-col sm:flex-row justify-between items-center gap-3 sm:gap-4">
        <Select.Root value={club} onValueChange={(val) => setClub(val as any)}>
          <Select.Trigger className="flex w-full sm:w-56 items-center justify-between rounded border dark:border-gray-700 px-2 py-1 text-sm text-gray-800 dark:text-gray-100 bg-white dark:bg-gray-800">
            <Select.Value aria-label={club}>{club === "ALL" ? "All Teams" : TEAM_NAMES[club as string] ?? club}</Select.Value>
            <Select.Icon><ChevronDown className="h-4 w-4 opacity-70" /></Select.Icon>
          </Select.Trigger>
          <Select.Portal>
            <Select.Content className="z-50 max-h-72 w-[var(--radix-select-trigger-width)] overflow-y-auto rounded border bg-white p-1 text-sm shadow-lg dark:bg-gray-800 dark:border-gray-600" position="popper" sideOffset={5}>
              <Select.ScrollUpButton className="flex justify-center py-1 text-gray-700 dark:text-gray-300"><ChevronUp className="h-4 w-4" /></Select.ScrollUpButton>
              <Select.Viewport>
                <Select.Item key="ALL" value="ALL" className="cursor-pointer select-none rounded px-2 py-1 leading-none outline-none text-gray-800 dark:text-gray-100 data-[highlighted]:bg-blue-500 data-[highlighted]:text-white dark:data-[highlighted]:bg-blue-600">
                  <Select.ItemText>All Teams</Select.ItemText>
                </Select.Item>
                {sortedTeamsForDropdown.map((team) => (
                  <Select.Item key={team.code} value={team.code} className="cursor-pointer select-none rounded px-2 py-1 leading-none outline-none text-gray-800 dark:text-gray-100 data-[highlighted]:bg-blue-500 data-[highlighted]:text-white dark:data-[highlighted]:bg-blue-600">
                    <Select.ItemText>{team.name}</Select.ItemText>
                  </Select.Item>
                ))}
              </Select.Viewport>
              <Select.ScrollDownButton className="flex justify-center py-1 text-gray-700 dark:text-gray-300"><ChevronDown className="h-4 w-4" /></Select.ScrollDownButton>
            </Select.Content>
          </Select.Portal>
        </Select.Root>

        <Select.Root value={selectedYear} onValueChange={(val) => setSelectedYear(val as string)}>
          <Select.Trigger
            className="flex w-full sm:w-56 items-center justify-between rounded border dark:border-gray-700
                       px-2 py-1 text-sm text-gray-800 dark:text-gray-100 bg-white dark:bg-gray-800"
          >
            <Select.Value aria-label={selectedYear}>
              {selectedYear === "ALL" ? "All Years" : selectedYear}
            </Select.Value>
            <Select.Icon>
              <ChevronDown className="h-4 w-4 opacity-70" />
            </Select.Icon>
          </Select.Trigger>
          <Select.Portal>
            <Select.Content
              className="z-50 max-h-72 w-[var(--radix-select-trigger-width)] overflow-y-auto rounded border bg-white
                         p-1 text-sm shadow-lg dark:bg-gray-800 dark:border-gray-600"
              position="popper" sideOffset={5}
            >
              <Select.ScrollUpButton className="flex justify-center py-1 text-gray-700 dark:text-gray-300">
                <ChevronUp className="h-4 w-4" />
              </Select.ScrollUpButton>
              <Select.Viewport>
                {YEARS_FOR_DROPDOWN.map((year) => (
                  <Select.Item
                    key={year}
                    value={year}
                    className="cursor-pointer select-none rounded px-2 py-1 leading-none
                               outline-none text-gray-800 dark:text-gray-100
                               data-[highlighted]:bg-blue-500 data-[highlighted]:text-white
                               dark:data-[highlighted]:bg-blue-600"
                  >
                    <Select.ItemText>{year === "ALL" ? "All Years" : year}</Select.ItemText>
                  </Select.Item>
                ))}
              </Select.Viewport>
              <Select.ScrollDownButton className="flex justify-center py-1 text-gray-700 dark:text-gray-300">
                <ChevronDown className="h-4 w-4" />
              </Select.ScrollDownButton>
            </Select.Content>
          </Select.Portal>
        </Select.Root>
      </div>

      {hasData && (
        <div className="mb-4 text-sm text-center text-gray-600 dark:text-gray-400">
          Displaying Scorigami from {totalGamesDisplayed.toLocaleString()} games.
        </div>
      )}

      {hasData && (
        <div className="relative inline-block">
          <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-sm font-medium dark:text-gray-300">
            Visitor&nbsp;Team
          </div>
          <div
            className="absolute top-1/2 -translate-y-1/2 -rotate-90 origin-center
                      text-sm font-medium dark:text-gray-300"
            style={{ left: -48 }}
          >
            Home&nbsp;Team
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `40px repeat(${GRID_DIMENSION}, ${CELL_SIZE}px)`,
              gridTemplateRows: `40px repeat(${GRID_DIMENSION}, ${CELL_SIZE}px)`,
            }}
          >
            <div className="border-b border-r border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-800" />
            {Array.from({ length: GRID_DIMENSION }, (_, i) => (
              <div
                key={`c${i}`}
                style={{ gridColumn: i + 2, gridRow: 1 }}
                className="flex items-center justify-center border-b border-gray-300
                          bg-white text-xs font-medium dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
              >
                {i}
              </div>
            ))}
            {Array.from({ length: GRID_DIMENSION }, (_, i) => (
              <div
                key={`r${i}`}
                style={{ gridColumn: 1, gridRow: i + 2 }}
                className="flex items-center justify-center border-r border-gray-300
                          bg-white text-xs font-medium dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
              >
                {i}
              </div>
            ))}
            {Array.from({ length: GRID_DIMENSION }, (_, home) =>
              Array.from({ length: GRID_DIMENSION }, (_, away) => {
                const k = `${home}-${away}`;
                const row = data[k];
                const f = row?.occurrences ?? 0;
                const active = hover === k;

                return (
                  <Tooltip key={k}>
                    <TooltipTrigger asChild>
                      <div
                        style={{
                          gridColumn: away + 2,
                          gridRow: home + 2,
                          backgroundColor: getColor(f),
                          width: CELL_SIZE,
                          height: CELL_SIZE,
                        }}
                        className={`border cursor-pointer transition-colors ${
                          active ? "border-black dark:border-white" : "border-gray-100 dark:border-gray-750"
                        }`}
                        onMouseEnter={() => setHover(k)}
                        onMouseLeave={() => setHover(null)}
                      />
                    </TooltipTrigger>
                    <TooltipContent>
                      <div className="mb-1 text-sm font-semibold text-gray-900 dark:text-gray-50">
                        Home {home} – Visitor {away}
                      </div>
                      <div className="text-xs text-gray-700 dark:text-gray-300">
                        {freqText(f)}
                      </div>
                      {row?.last_date && (
                        <>
                          <hr className="my-1 border-gray-300 dark:border-gray-700" />
                          <div className="space-y-0.5">
                            <div className="font-medium text-gray-900 dark:text-gray-50">
                              Last game
                            </div>
                            <div className="text-gray-700 dark:text-gray-300">
                              {formatDisplayDate(row.last_date)}
                            </div>
                            <div className="text-gray-700 dark:text-gray-300">
                              {getDisplayTeamName(row.last_home_team)}
                              {" vs "}
                              {getDisplayTeamName(row.last_visitor_team)}
                            </div>
                          </div>
                        </>
                      )}
                    </TooltipContent>
                  </Tooltip>
                );
              })
            )}
          </div>
        </div>
      )}
    </TooltipProvider>
  );
}