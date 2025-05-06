import { create } from "zustand"

/* ----------------------------------------------------------------
 *  Types
 * ---------------------------------------------------------------- */
export type League = "AL" | "NL"

export type Division =
  | "AL East" | "AL Central" | "AL West"
  | "NL East" | "NL Central" | "NL West"

export interface Team {
  id:    string
  name:  string
  color: string
}

/* ----------------------------------------------------------------
 *  Teams organised by division
 * ---------------------------------------------------------------- */
export const teams: Record<Division, Team[]> = {
  // ---------------- American League ----------------
  "AL East": [
    { id: "nyy", name: "New York Yankees",     color: "#003087" },
    { id: "bos", name: "Boston Red Sox",       color: "#BD3039" },
    { id: "tor", name: "Toronto Blue Jays",    color: "#134A8E" },
    { id: "bal", name: "Baltimore Orioles",    color: "#DF4601" },
    { id: "tb",  name: "Tampa Bay Rays",       color: "#092C5C" },
  ],
  "AL Central": [
    { id: "cle", name: "Cleveland Guardians",  color: "#00385D" },
    { id: "min", name: "Minnesota Twins",      color: "#002B5C" },
    { id: "det", name: "Detroit Tigers",       color: "#0C2340" },
    { id: "kc",  name: "Kansas City Royals",   color: "#004687" },
    { id: "cws", name: "Chicago White Sox",    color: "#27251F" },
  ],
  "AL West": [
    { id: "hou", name: "Houston Astros",       color: "#002D62" },
    { id: "sea", name: "Seattle Mariners",     color: "#0C2C56" },
    { id: "tex", name: "Texas Rangers",        color: "#003278" },
    { id: "oak", name: "Oakland Athletics",    color: "#003831" },
    { id: "laa", name: "Los Angeles Angels",   color: "#BA0021" },
  ],
  // ---------------- National League ----------------
  "NL East": [
    { id: "atl", name: "Atlanta Braves",       color: "#CE1141" },
    { id: "phi", name: "Philadelphia Phillies",color: "#E81828" },
    { id: "nym", name: "New York Mets",        color: "#002D72" },
    { id: "mia", name: "Miami Marlins",        color: "#00A3E0" },
    { id: "wsh", name: "Washington Nationals", color: "#AB0003" },
  ],
  "NL Central": [
    { id: "mil", name: "Milwaukee Brewers",    color: "#12284B" },
    { id: "chc", name: "Chicago Cubs",         color: "#0E3386" },
    { id: "cin", name: "Cincinnati Reds",      color: "#C6011F" },
    { id: "pit", name: "Pittsburgh Pirates",   color: "#27251F" },
    { id: "stl", name: "St. Louis Cardinals",  color: "#C41E3A" },
  ],
  "NL West": [
    { id: "lad", name: "Los Angeles Dodgers",  color: "#005A9C" },
    { id: "ari", name: "Arizona Diamondbacks", color: "#A71930" },
    { id: "sd",  name: "San Diego Padres",     color: "#2F241D" },
    { id: "sf",  name: "San Francisco Giants", color: "#FD5A1E" },
    { id: "col", name: "Colorado Rockies",     color: "#33006F" },
  ],
}

/* ----------------------------------------------------------------
 *  Helpers
 * ---------------------------------------------------------------- */
const getAllTeamIds = (): string[] =>
  Object.values(teams).flat().map((t) => t.id)

const getLeagueTeamIds = (league: League): string[] =>
  (Object.keys(teams) as Division[])
    .filter((d) => d.startsWith(league))
    .flatMap((d) => teams[d].map((t) => t.id))

/* ----------------------------------------------------------------
 *  Zustand store
 * ---------------------------------------------------------------- */
interface TeamStore {
  selectedTeams: string[]
  selectTeam:      (id: string) => void
  deselectTeam:    (id: string) => void
  selectAll:       () => void
  deselectAll:     () => void
  selectDivision:  (ids: string[]) => void
  selectLeague:    (league: League) => void
}

export const useTeamStore = create<TeamStore>((set, get) => ({
  selectedTeams: [],

  selectTeam: (id) =>
    set((s) =>
      s.selectedTeams.includes(id)
        ? s
        : { selectedTeams: [...s.selectedTeams, id] }),

  deselectTeam: (id) =>
    set((s) => ({ selectedTeams: s.selectedTeams.filter((t) => t !== id) })),

  selectAll: () => set({ selectedTeams: getAllTeamIds() }),
  deselectAll: () => set({ selectedTeams: [] }),

  selectDivision: (ids) =>
    set((s) => ({ selectedTeams: Array.from(new Set([...s.selectedTeams, ...ids])) })),

  selectLeague: (lg) =>
    set((s) => ({
      selectedTeams: Array.from(
        new Set([
          ...s.selectedTeams,
          ...getLeagueTeamIds(lg),
        ]),
      ),
    })),
}))

/* ----------------------------------------------------------------
 *  Flattened list for search chips etc.
 * ---------------------------------------------------------------- */
export const allTeams: Team[] = Object.values(teams).flat()
