import { unstable_cache } from "next/cache";
import { pool } from "@/lib/db";

export interface ArchiveRow {
  date: string;
  home_team: string;
  visitor_team: string;
  home_score: number;
  visitor_score: number;
  win: number;
  lose: number;
  occurrences: string;
  venue_name: string | null;
  game_id: number | null;
  source: string | null;
  game_type: string | null;
  box_url: string | null;
}

export const PAGE_SIZE = 100;

async function fetchScorigamiArchive(page: number): Promise<{ rows: ArchiveRow[]; total: number }> {
  const offset = (page - 1) * PAGE_SIZE;
  const [{ rows }, { rows: countRows }] = await Promise.all([
    pool.query<ArchiveRow>(`
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
          g.game_id, g.source, g.game_type, g.box_url, g.venue_name,
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

// Cached per page. gamelogs only changes during the nightly ingest, so the
// 1h fallback mainly ensures the archive picks up new rows the morning after;
// the cron also busts the 'archive' tag when a scorigami-class result lands.
export function getScorigamiArchive(page: number): Promise<{ rows: ArchiveRow[]; total: number }> {
  return unstable_cache(
    () => fetchScorigamiArchive(page),
    ["archive", String(page)],
    { tags: ["archive"], revalidate: 3600 }
  )();
}
