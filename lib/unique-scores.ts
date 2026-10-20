import { readFileSync } from "node:fs";
import path from "node:path";
import { decodeYearly } from "@/lib/static-data.mjs";

export type AllTimeTotals = { scores: number; games: number };

let cached: AllTimeTotals | null | undefined;

/** All-time distinct final scores and games played, read from the static data at build time. */
export function allTimeTotals(): AllTimeTotals | null {
  if (cached !== undefined) return cached;
  try {
    const file = path.join(process.cwd(), "public/scorigami-data/traditional/ALL.json");
    const { rows } = decodeYearly(JSON.parse(readFileSync(file, "utf8")));
    const scores = new Set<string>();
    let games = 0;
    for (const r of rows as { score1: number; score2: number; occurrences: number }[]) {
      scores.add(`${r.score1}-${r.score2}`);
      games += Number(r.occurrences);
    }
    cached = { scores: scores.size, games };
  } catch {
    cached = null;
  }
  return cached;
}
