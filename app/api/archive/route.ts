import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

export const revalidate = false;

const PAGE_SIZE = 100;

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

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);

  const data = await getScorigamiHistory(page);

  return NextResponse.json({
    ...data,
    totalPages: Math.ceil(data.total / PAGE_SIZE),
  });
}
