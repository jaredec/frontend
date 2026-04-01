import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

export const revalidate = false;

const PAGE_SIZE = 400;

async function getScorigamiHistory(page: number) {
  const offset = (page - 1) * PAGE_SIZE;
  const [{ rows }, { rows: countRows }] = await Promise.all([
    pool.query(`
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
    pool.query(`
      SELECT COUNT(DISTINCT (GREATEST(home_score, visitor_score), LEAST(home_score, visitor_score))) AS total
      FROM gamelogs WHERE is_negro_league = false
    `),
  ]);
  return { rows, total: Number(countRows[0].total) };
}

async function getRarigamiHistory(page: number) {
  const offset = (page - 1) * PAGE_SIZE;
  const [{ rows }, { rows: countRows }] = await Promise.all([
    pool.query(`
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
    pool.query(`
      WITH counts AS (
        SELECT
          GREATEST(home_score, visitor_score) AS win,
          LEAST(home_score, visitor_score)    AS lose,
          COUNT(*) AS total
        FROM gamelogs WHERE is_negro_league = false GROUP BY win, lose
      )
      SELECT COUNT(*) AS total
      FROM gamelogs g
      JOIN counts c
        ON GREATEST(g.home_score, g.visitor_score) = c.win
        AND LEAST(g.home_score, g.visitor_score) = c.lose
      WHERE g.is_negro_league = false AND c.total < 100
    `),
  ]);
  return { rows, total: Number(countRows[0].total) };
}

async function getPlayoffigamiHistory(page: number) {
  const offset = (page - 1) * PAGE_SIZE;
  const [{ rows }, { rows: countRows }] = await Promise.all([
    pool.query(`
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
    pool.query(`
      SELECT COUNT(DISTINCT (GREATEST(home_score, visitor_score), LEAST(home_score, visitor_score))) AS total
      FROM gamelogs WHERE is_negro_league = false AND game_type IN ('W','L','D','F')
    `),
  ]);
  return { rows, total: Number(countRows[0].total) };
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const filter = searchParams.get("filter") ?? "all";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);

  const data =
    filter === "rarigami" ? await getRarigamiHistory(page)
    : filter === "playoff" ? await getPlayoffigamiHistory(page)
    : await getScorigamiHistory(page);

  return NextResponse.json({
    ...data,
    totalPages: Math.ceil(data.total / PAGE_SIZE),
  });
}
