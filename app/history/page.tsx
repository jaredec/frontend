import type { Metadata } from "next";
import PageFooter from "@/components/page-footer";
import NavBar from "@/components/nav-bar";
import { pool } from "@/lib/db";
import HistoryTable from "./history-table";

export const metadata: Metadata = {
  title: "Scorigami Archive",
  description:
    "Every unique final score in MLB history — the date it first occurred, the teams involved, and how many times it has happened since.",
};

export const revalidate = false; // revalidated on-demand from cron when a new scorigami type occurs

export type FilterMode = "all" | "rarigami" | "playoff";

export interface HistoryRow {
  date: string;
  home_team: string;
  visitor_team: string;
  home_score: number;
  visitor_score: number;
  win: number;
  lose: number;
  occurrences: string;
  game_id: number | null;
  source: string | null;
  game_type: string | null;
}

const PAGE_SIZE = 400;

async function getScorigamiHistory(page: number): Promise<{ rows: HistoryRow[]; total: number }> {
  const offset = (page - 1) * PAGE_SIZE;
  const [{ rows }, { rows: countRows }] = await Promise.all([
    pool.query<HistoryRow>(`
      WITH first_occurrences AS (
        SELECT
          GREATEST(home_score, visitor_score) AS win,
          LEAST(home_score, visitor_score)    AS lose,
          MIN(date)                           AS first_date
        FROM gamelogs WHERE is_negro_league = false GROUP BY win, lose
      ),
      counts AS (
        SELECT
          GREATEST(home_score, visitor_score) AS win,
          LEAST(home_score, visitor_score)    AS lose,
          COUNT(*)                            AS occurrences
        FROM gamelogs WHERE is_negro_league = false GROUP BY win, lose
      ),
      first_games AS (
        SELECT DISTINCT ON (fo.win, fo.lose)
          g.date, g.home_team, g.visitor_team,
          g.home_score, g.visitor_score,
          g.game_id, g.source, g.game_type,
          fo.win, fo.lose, c.occurrences
        FROM gamelogs g
        JOIN first_occurrences fo
          ON GREATEST(g.home_score, g.visitor_score) = fo.win
          AND LEAST(g.home_score, g.visitor_score) = fo.lose
          AND g.date = fo.first_date
        JOIN counts c ON fo.win = c.win AND fo.lose = c.lose
        WHERE g.is_negro_league = false
        ORDER BY fo.win, fo.lose, g.game_id
      )
      SELECT * FROM first_games
      ORDER BY date DESC, win DESC, lose DESC
      LIMIT $1 OFFSET $2
    `, [PAGE_SIZE, offset]),
    pool.query<{ total: string }>(`
      SELECT COUNT(DISTINCT (GREATEST(home_score, visitor_score), LEAST(home_score, visitor_score))) AS total
      FROM gamelogs WHERE is_negro_league = false
    `),
  ]);
  return { rows, total: Number(countRows[0].total) };
}

async function getRarigamiHistory(page: number): Promise<{ rows: HistoryRow[]; total: number }> {
  const offset = (page - 1) * PAGE_SIZE;
  const [{ rows }, { rows: countRows }] = await Promise.all([
    pool.query<HistoryRow>(`
      WITH counts AS (
        SELECT
          GREATEST(home_score, visitor_score) AS win,
          LEAST(home_score, visitor_score)    AS lose,
          COUNT(*)                            AS total
        FROM gamelogs WHERE is_negro_league = false GROUP BY win, lose
      ),
      ranked AS (
        SELECT
          g.date, g.home_team, g.visitor_team,
          g.home_score, g.visitor_score,
          g.game_id, g.source, g.game_type,
          GREATEST(g.home_score, g.visitor_score) AS win,
          LEAST(g.home_score, g.visitor_score)    AS lose,
          ROW_NUMBER() OVER (
            PARTITION BY GREATEST(g.home_score, g.visitor_score), LEAST(g.home_score, g.visitor_score)
            ORDER BY g.date, g.game_id
          ) AS occurrences
        FROM gamelogs g
        JOIN counts c
          ON GREATEST(g.home_score, g.visitor_score) = c.win
          AND LEAST(g.home_score, g.visitor_score) = c.lose
        WHERE g.is_negro_league = false AND c.total < 100
      )
      SELECT * FROM ranked
      ORDER BY date DESC
      LIMIT $1 OFFSET $2
    `, [PAGE_SIZE, offset]),
    pool.query<{ total: string }>(`
      WITH counts AS (
        SELECT
          GREATEST(home_score, visitor_score) AS win,
          LEAST(home_score, visitor_score)    AS lose,
          COUNT(*) AS occurrences
        FROM gamelogs WHERE is_negro_league = false GROUP BY win, lose
      )
      SELECT COUNT(*) AS total
      FROM gamelogs g
      JOIN counts c
        ON GREATEST(g.home_score, g.visitor_score) = c.win
        AND LEAST(g.home_score, g.visitor_score) = c.lose
      WHERE g.is_negro_league = false AND c.occurrences < 100
    `),
  ]);
  return { rows, total: Number(countRows[0].total) };
}

async function getPlayoffigamiHistory(page: number): Promise<{ rows: HistoryRow[]; total: number }> {
  const offset = (page - 1) * PAGE_SIZE;
  const [{ rows }, { rows: countRows }] = await Promise.all([
    pool.query<HistoryRow>(`
      WITH first_occurrences AS (
        SELECT
          GREATEST(home_score, visitor_score) AS win,
          LEAST(home_score, visitor_score)    AS lose,
          MIN(date)                           AS first_date
        FROM gamelogs
        WHERE is_negro_league = false AND game_type IN ('W','L','D','F')
        GROUP BY win, lose
      ),
      counts AS (
        SELECT
          GREATEST(home_score, visitor_score) AS win,
          LEAST(home_score, visitor_score)    AS lose,
          COUNT(*)                            AS occurrences
        FROM gamelogs WHERE is_negro_league = false GROUP BY win, lose
      ),
      first_games AS (
        SELECT DISTINCT ON (fo.win, fo.lose)
          g.date, g.home_team, g.visitor_team,
          g.home_score, g.visitor_score,
          g.game_id, g.source, g.game_type,
          fo.win, fo.lose, c.occurrences
        FROM gamelogs g
        JOIN first_occurrences fo
          ON GREATEST(g.home_score, g.visitor_score) = fo.win
          AND LEAST(g.home_score, g.visitor_score) = fo.lose
          AND g.date = fo.first_date
        JOIN counts c ON fo.win = c.win AND fo.lose = c.lose
        WHERE g.is_negro_league = false AND g.game_type IN ('W','L','D','F')
        ORDER BY fo.win, fo.lose, g.game_id
      )
      SELECT * FROM first_games
      ORDER BY date DESC, win DESC, lose DESC
      LIMIT $1 OFFSET $2
    `, [PAGE_SIZE, offset]),
    pool.query<{ total: string }>(`
      SELECT COUNT(DISTINCT (GREATEST(home_score, visitor_score), LEAST(home_score, visitor_score))) AS total
      FROM gamelogs WHERE is_negro_league = false AND game_type IN ('W','L','D','F')
    `),
  ]);
  return { rows, total: Number(countRows[0].total) };
}

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; page?: string }>;
}) {
  const { filter: filterParam, page: pageParam } = await searchParams;

  const filter: FilterMode =
    filterParam === "rarigami" ? "rarigami"
    : filterParam === "playoff" ? "playoff"
    : "all";

  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);

  const { rows, total } = await (
    filter === "rarigami" ? getRarigamiHistory(page)
    : filter === "playoff" ? getPlayoffigamiHistory(page)
    : getScorigamiHistory(page)
  );

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#1e1e1e] flex flex-col">
      <NavBar />

      <HistoryTable
        rows={rows}
        filter={filter}
        total={total}
        currentPage={page}
        totalPages={totalPages}
      />

      <PageFooter />
    </div>
  );
}
