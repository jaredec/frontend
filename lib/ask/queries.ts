import { z } from "zod";
import { readOnlyQuery } from "@/lib/ask/db";
import { checkSql, MAX_ROWS } from "@/lib/ask/sql-guard";

// Plain query functions behind the Ask tools. Kept free of any AI SDK types so
// the same functions can back an MCP server or an eval harness.
// run_sql is the only one that executes model-written SQL.

const GAME_TYPE_CODES = {
  all: null,
  regular: ["R"],
  postseason: ["W", "L", "D", "F"],
  world_series: ["W"],
  lcs: ["L"],
  division_series: ["D"],
  wild_card: ["F"],
} as const;

const ROUND_NAMES: Record<string, string> = {
  W: "World Series",
  L: "League Championship Series",
  D: "Division Series",
  F: "Wild Card round",
  C: "Negro League championship",
};

const year = z.number().int().min(1871).max(2100);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
const runs = z.number().int().min(0).max(60);

export const filtersSchema = z
  .object({
    team_ids: z
      .array(z.number().int())
      .max(5)
      .optional()
      .describe("team_ids for ONE team, from lookup_team. Results are then from that team's point of view."),
    opponent_ids: z
      .array(z.number().int())
      .max(5)
      .optional()
      .describe("Only games against this opponent (team_ids from lookup_team). Requires team_ids."),
    team_result: z.enum(["won", "lost"]).optional().describe("Only games the team won or lost. Requires team_ids."),
    team_side: z.enum(["home", "away"]).optional().describe("Only the team's home or road games. Requires team_ids."),
    venue: z.string().max(80).optional().describe("Ballpark name, partial match, e.g. 'Coors Field' or 'Wrigley'."),
    start_year: year.optional(),
    end_year: year.optional(),
    start_date: isoDate.optional(),
    end_date: isoDate.optional(),
    game_type: z
      .enum(["all", "regular", "postseason", "world_series", "lcs", "division_series", "wild_card"])
      .optional()
      .describe("Defaults to all (regular season and postseason)."),
    extra_innings: z.boolean().optional().describe("true = only extra-inning games, false = only 9 innings or fewer."),
    min_innings: z
      .number()
      .int()
      .min(1)
      .max(30)
      .optional()
      .describe("Games that lasted at least this many innings. For exactly N innings, set min_innings and max_innings to N."),
    max_innings: z.number().int().min(1).max(30).optional().describe("Games that lasted at most this many innings."),
    include_negro_leagues: z
      .boolean()
      .optional()
      .describe("Defaults to false. Site records, including scorigami, exclude Negro League games."),
  })
  .describe("Optional filters. Omit anything the question doesn't ask for.");

export type Filters = z.infer<typeof filtersSchema>;

/** What the UI needs to link a game the model cited. */
export interface GameLink {
  ref: string;
  date: string;
  label: string;
  ballpark: string | null;
  url: string | null;
}
export type GameSink = Map<string, GameLink>;

interface GameRow {
  gid: string;
  d: string;
  game_type: string;
  venue_name: string | null;
  innings: number;
  source: string | null;
  box_url: string | null;
  home_team: string;
  team_name: string;
  opp_name: string;
  team_score: number;
  opp_score: number;
  side: "home" | "away" | null;
}

export class ToolInputError extends Error {}

function requireTeam(f: Filters) {
  if (!f.team_ids?.length && (f.opponent_ids?.length || f.team_result || f.team_side)) {
    throw new ToolInputError("opponent_ids, team_result and team_side need team_ids. Call lookup_team first.");
  }
}

/**
 * One row per game, seen from the filtered team's side (team_score = their runs),
 * or from the winner's side when no team is given. With everyTeam and no team
 * filter, every game appears twice, once from each side. Appends its parameters to `params`.
 */
function gamesSql(f: Filters, params: unknown[], { everyTeam = false } = {}): string {
  requireTeam(f);
  const p = (v: unknown) => `$${params.push(v)}`;
  const where: string[] = [];
  if (!f.include_negro_leagues) where.push("is_negro_league = false");
  const codes = GAME_TYPE_CODES[f.game_type ?? "all"];
  if (codes) where.push(`game_type = ANY(${p(codes)}::text[])`);
  if (f.start_year) where.push(`date >= ${p(`${f.start_year}-01-01`)}::date`);
  if (f.end_year) where.push(`date < ${p(`${f.end_year + 1}-01-01`)}::date`);
  if (f.start_date) where.push(`date >= ${p(f.start_date)}::date`);
  if (f.end_date) where.push(`date <= ${p(f.end_date)}::date`);
  if (f.venue) where.push(`venue_name ILIKE ${p(`%${f.venue}%`)}`);
  if (f.extra_innings === true) where.push("innings > 9");
  if (f.extra_innings === false) where.push("innings <= 9");
  if (f.min_innings) where.push(`innings >= ${p(f.min_innings)}`);
  if (f.max_innings) where.push(`innings <= ${p(f.max_innings)}`);

  // gid: Retrosheet ids exceed 2^53, so they must cross into JS as text.
  const cols = `game_id, game_id::text AS gid, date, to_char(date, 'YYYY-MM-DD') AS d, game_type, venue_name, innings, source, box_url,
    home_team, home_team_id, visitor_team_id`;

  if (!f.team_ids?.length && !everyTeam) {
    const w = where.length ? `WHERE ${where.join(" AND ")}` : "";
    return `SELECT ${cols},
      CASE WHEN visitor_score > home_score THEN visitor_team ELSE home_team END AS team_name,
      CASE WHEN visitor_score > home_score THEN home_team ELSE visitor_team END AS opp_name,
      GREATEST(home_score, visitor_score) AS team_score,
      LEAST(home_score, visitor_score) AS opp_score,
      NULL::text AS side
      FROM gamelogs ${w}`;
  }

  const team = f.team_ids?.length ? p(f.team_ids) : null;
  const opp = f.opponent_ids?.length ? p(f.opponent_ids) : null;
  const branch = (side: "home" | "away") => {
    const [mine, theirs] = side === "home" ? ["home", "visitor"] : ["visitor", "home"];
    const w = [...where];
    if (team) w.push(`${mine}_team_id = ANY(${team}::bigint[])`);
    if (opp) w.push(`${theirs}_team_id = ANY(${opp}::bigint[])`);
    return `SELECT ${cols}, ${mine}_team_id AS team_id, ${theirs}_team_id AS opp_id, ${mine}_team AS team_name, ${theirs}_team AS opp_name,
      ${mine}_score AS team_score, ${theirs}_score AS opp_score, '${side}'::text AS side
      FROM gamelogs ${w.length ? `WHERE ${w.join(" AND ")}` : ""}`;
  };
  const sides: ("home" | "away")[] = f.team_side ? [f.team_side] : ["home", "away"];
  return sides.map(branch).join(" UNION ALL ");
}

function resultSql(f: Filters): string {
  if (f.team_result === "won") return "team_score > opp_score";
  if (f.team_result === "lost") return "team_score < opp_score";
  return "TRUE";
}

function boxScoreUrl(r: Pick<GameRow, "gid" | "source" | "box_url">): string | null {
  return r.source === "mlb_api" ? `https://www.mlb.com/gameday/${r.gid}` : r.box_url ?? null;
}

function toGame(r: GameRow, sink?: GameSink) {
  const ref = `g${r.gid}`;
  const tie = r.team_score === r.opp_score;
  const teamWon = r.team_score > r.opp_score;
  const winner = teamWon || tie ? r.team_name : r.opp_name;
  const loser = teamWon || tie ? r.opp_name : r.team_name;
  const hi = Math.max(r.team_score, r.opp_score);
  const lo = Math.min(r.team_score, r.opp_score);
  sink?.set(ref, {
    ref,
    date: r.d,
    label: tie ? `${winner} ${hi}, ${loser} ${lo} (tie)` : `${winner} ${hi}, ${loser} ${lo}`,
    ballpark: r.venue_name,
    url: boxScoreUrl(r),
  });
  return {
    ref,
    date: r.d,
    winner,
    loser,
    score: `${hi}-${lo}`,
    ...(tie && { tie: true }),
    home_team: r.home_team,
    ballpark: r.venue_name,
    ...(r.innings !== 9 && { innings: r.innings }),
    ...(ROUND_NAMES[r.game_type] && { round: ROUND_NAMES[r.game_type] }),
    ...(r.side && { team_result: tie ? "tied" : teamWon ? "won" : "lost" }),
  };
}

function pct(n: number, total: number): string {
  if (!total) return "0%";
  const v = (n / total) * 100;
  return `${v >= 10 ? v.toFixed(0) : v >= 1 ? v.toFixed(1) : v.toFixed(2)}%`;
}

// --- lookup_team ---

const TEAM_ALIASES: Record<string, string> = {
  "a's": "Athletics",
  as: "Athletics",
  "d-backs": "Diamondbacks",
  dbacks: "Diamondbacks",
  nats: "Nationals",
  cards: "Cardinals",
  yanks: "Yankees",
  jays: "Blue Jays",
  halos: "Angels",
  bucs: "Pirates",
  "o's": "Orioles",
  stros: "Astros",
  "m's": "Mariners",
};

export const lookupTeamInput = z.object({
  name: z.string().min(2).max(60).describe("City, nickname, full name or abbreviation, e.g. 'Cubs', 'Brooklyn Dodgers', 'NYY'."),
});

export async function lookupTeam({ name }: z.infer<typeof lookupTeamInput>) {
  const q = TEAM_ALIASES[name.trim().toLowerCase()] ?? name.trim();
  const rows = await readOnlyQuery<{
    team_id: string;
    team: string;
    franchise: string | null;
    is_negro_league: boolean;
    names: { name: string; years: string }[] | null;
    first_year: number | null;
    last_year: number | null;
  }>(
    `WITH hits AS (
       SELECT team_id FROM teams WHERE team ILIKE $1 OR abbr ILIKE $2 OR franchise ILIKE $2
       UNION
       SELECT team_id FROM lineage WHERE display_name ILIKE $1 OR franchise_code ILIKE $2
     )
     SELECT t.team_id, t.team, t.franchise, t.is_negro_league,
       (SELECT json_agg(json_build_object('name', l.display_name, 'years', l.years_active) ORDER BY l.start_year)
          FROM lineage l WHERE l.team_id = t.team_id) AS names,
       (SELECT min(EXTRACT(YEAR FROM date))::int FROM gamelogs WHERE home_team_id = t.team_id) AS first_year,
       (SELECT max(EXTRACT(YEAR FROM date))::int FROM gamelogs WHERE home_team_id = t.team_id) AS last_year
     FROM teams t
     WHERE t.team_id IN (SELECT team_id FROM hits)
     ORDER BY t.is_negro_league, t.franchise IS NULL, t.team_id
     LIMIT 8`,
    [`%${q}%`, q],
  );
  if (!rows.length) {
    return { matches: [], hint: "No team matched. Try the city, the nickname, or a historical name." };
  }
  return {
    matches: rows.map((r) => ({
      team_id: Number(r.team_id),
      name: r.team,
      years: r.first_year ? `${r.first_year}–${r.last_year}` : null,
      ...(r.franchise && { current_franchise: true }),
      ...(r.names && r.names.length > 1 && { names_over_time: r.names }),
      ...(r.is_negro_league && { negro_league: true }),
    })),
  };
}

// --- score_history ---

export const scoreHistoryInput = z.object({
  score_a: runs.describe("One team's runs. Order doesn't matter: 14-2 and 2-14 are the same score."),
  score_b: runs,
  filters: filtersSchema.optional(),
});

export async function scoreHistory({ score_a, score_b, filters = {} }: z.infer<typeof scoreHistoryInput>, sink?: GameSink) {
  const hi = Math.max(score_a, score_b);
  const lo = Math.min(score_a, score_b);
  const params: unknown[] = [];
  const games = gamesSql(filters, params);
  const w = `$${params.push(hi)}`;
  const l = `$${params.push(lo)}`;
  const [row] = await readOnlyQuery<{
    n: number;
    wins: number;
    losses: number;
    first: GameRow | null;
    recent: GameRow[] | null;
  }>(
    `WITH g AS (${games}),
     m AS (SELECT * FROM g WHERE GREATEST(team_score, opp_score) = ${w} AND LEAST(team_score, opp_score) = ${l} AND ${resultSql(filters)})
     SELECT
       (SELECT count(*)::int FROM m) AS n,
       (SELECT count(*)::int FROM m WHERE team_score > opp_score) AS wins,
       (SELECT count(*)::int FROM m WHERE team_score < opp_score) AS losses,
       (SELECT row_to_json(x) FROM (SELECT * FROM m ORDER BY date, game_id LIMIT 1) x) AS first,
       (SELECT json_agg(x) FROM (SELECT * FROM m ORDER BY date DESC, game_id DESC LIMIT 5) x) AS recent`,
    params,
  );
  const score = `${hi}-${lo}`;
  if (!row.n) return { score, occurrences: 0, note: "This score has never happened with these filters." };
  const hasTeam = !!filters.team_ids?.length;
  return {
    score,
    occurrences: row.n,
    ...(hasTeam && !filters.team_result && { team_wins: row.wins, team_losses: row.losses }),
    first_game: row.first ? toGame(row.first, sink) : null,
    most_recent_games: (row.recent ?? []).map((r) => toGame(r, sink)),
  };
}

// --- find_games ---

const SORTS = {
  most_recent: "date DESC, game_id DESC",
  oldest: "date, game_id",
  biggest_margin: "abs(team_score - opp_score) DESC, date DESC",
  most_total_runs: "(team_score + opp_score) DESC, date DESC",
  most_team_runs: "team_score DESC, date DESC",
  most_innings: "innings DESC NULLS LAST, date DESC",
} as const;

export const findGamesInput = z.object({
  filters: filtersSchema.optional(),
  score_a: runs.optional().describe("With score_b, only games with this final score (either order)."),
  score_b: runs.optional(),
  min_margin: z.number().int().min(0).max(60).optional().describe("Minimum run differential."),
  max_margin: z.number().int().min(0).max(60).optional(),
  min_total_runs: z.number().int().min(0).max(80).optional().describe("Minimum combined runs."),
  max_total_runs: z.number().int().min(0).max(80).optional(),
  min_team_runs: runs.optional().describe("Minimum runs by the filtered team (or by the winner if no team)."),
  shutouts_only: z.boolean().optional().describe("Only games where the losing side (or the filtered team's opponent) scored 0."),
  sort: z.enum(Object.keys(SORTS) as [keyof typeof SORTS, ...(keyof typeof SORTS)[]]).optional().describe("Defaults to most_recent."),
  limit: z.number().int().min(1).max(20).optional().describe("Defaults to 10."),
});

export async function findGames(input: z.infer<typeof findGamesInput>, sink?: GameSink) {
  const f = input.filters ?? {};
  const params: unknown[] = [];
  const p = (v: unknown) => `$${params.push(v)}`;
  const games = gamesSql(f, params);
  const where = [resultSql(f)];
  if (input.score_a !== undefined && input.score_b !== undefined) {
    where.push(`GREATEST(team_score, opp_score) = ${p(Math.max(input.score_a, input.score_b))}`);
    where.push(`LEAST(team_score, opp_score) = ${p(Math.min(input.score_a, input.score_b))}`);
  }
  if (input.min_margin !== undefined) where.push(`abs(team_score - opp_score) >= ${p(input.min_margin)}`);
  if (input.max_margin !== undefined) where.push(`abs(team_score - opp_score) <= ${p(input.max_margin)}`);
  if (input.min_total_runs !== undefined) where.push(`team_score + opp_score >= ${p(input.min_total_runs)}`);
  if (input.max_total_runs !== undefined) where.push(`team_score + opp_score <= ${p(input.max_total_runs)}`);
  if (input.min_team_runs !== undefined) where.push(`team_score >= ${p(input.min_team_runs)}`);
  if (input.shutouts_only) where.push("opp_score = 0");
  const limit = p(input.limit ?? 10);
  const rows = await readOnlyQuery<GameRow & { total: number }>(
    `WITH g AS (${games})
     SELECT *, count(*) OVER()::int AS total FROM g
     WHERE ${where.join(" AND ")}
     ORDER BY ${SORTS[input.sort ?? "most_recent"]}
     LIMIT ${limit}`,
    params,
  );
  return {
    total_matching: rows[0]?.total ?? 0,
    sorted_by: input.sort ?? "most_recent",
    games: rows.map((r) => toGame(r, sink)),
  };
}

// --- common_scores ---

export const commonScoresInput = z.object({
  filters: filtersSchema.optional(),
  order: z.enum(["most_common", "least_common"]).optional().describe("Defaults to most_common."),
  limit: z.number().int().min(1).max(25).optional().describe("Defaults to 10."),
});

export async function commonScores(input: z.infer<typeof commonScoresInput>) {
  const f = input.filters ?? {};
  const params: unknown[] = [];
  const games = gamesSql(f, params);
  const dir = input.order === "least_common" ? "ASC" : "DESC";
  const limit = `$${params.push(input.limit ?? 10)}`;
  const rows = await readOnlyQuery<{
    hi: number;
    lo: number;
    n: number;
    wins: number;
    losses: number;
    last_date: string;
    distinct_scores: number;
    total_games: number;
  }>(
    `WITH g AS (${games})
     SELECT GREATEST(team_score, opp_score) AS hi, LEAST(team_score, opp_score) AS lo,
       count(*)::int AS n,
       count(*) FILTER (WHERE team_score > opp_score)::int AS wins,
       count(*) FILTER (WHERE team_score < opp_score)::int AS losses,
       max(d) AS last_date,
       (count(*) OVER())::int AS distinct_scores,
       (sum(count(*)) OVER())::int AS total_games
     FROM g WHERE ${resultSql(f)}
     GROUP BY 1, 2
     ORDER BY n ${dir}, last_date DESC
     LIMIT ${limit}`,
    params,
  );
  const total = rows[0]?.total_games ?? 0;
  const hasTeam = !!f.team_ids?.length && !f.team_result;
  return {
    total_games: total,
    distinct_scores: rows[0]?.distinct_scores ?? 0,
    order: input.order ?? "most_common",
    scores: rows.map((r) => ({
      score: `${r.hi}-${r.lo}`,
      occurrences: r.n,
      share_of_games: pct(r.n, total),
      ...(hasTeam && { team_wins: r.wins, team_losses: r.losses }),
      most_recent: r.last_date,
    })),
  };
}

// --- group_stats ---

const YEAR = "extract(year FROM date)::int";

const GROUPS = {
  ballpark: { cols: "venue_name AS grp", by: "venue_name", minGames: 100 },
  season: { cols: `${YEAR} AS grp`, by: YEAR, minGames: 1 },
  decade: { cols: `(${YEAR} / 10) * 10 AS grp`, by: `(${YEAR} / 10) * 10`, minGames: 1 },
  team: { cols: "(SELECT t.team FROM teams t WHERE t.team_id = g.team_id) AS grp", by: "team_id", minGames: 500 },
  team_season: { cols: `${YEAR} || ' ' || max(team_name) AS grp`, by: `team_id, ${YEAR}`, minGames: 50 },
  matchup: {
    cols: "(SELECT t.team FROM teams t WHERE t.team_id = g.team_id) || ' vs ' || (SELECT t.team FROM teams t WHERE t.team_id = g.opp_id) AS grp",
    by: "team_id, opp_id",
    minGames: 100,
  },
} as const;

const GROUP_SORTS = {
  avg_total_runs: "avg(team_score + opp_score)",
  avg_team_runs: "avg(team_score)",
  avg_margin: "avg(abs(team_score - opp_score))",
  games: "count(*)",
  shutout_rate: "avg((LEAST(team_score, opp_score) = 0)::int)",
  extra_inning_rate: "avg((innings > 9)::int)",
  win_pct: "avg((team_score > opp_score)::int)",
  win_loss_gap: "sum((team_score > opp_score)::int) - sum((team_score < opp_score)::int)",
  first_game: "min(date)",
} as const;

export const groupStatsInput = z.object({
  group_by: z
    .enum(["ballpark", "season", "decade", "team", "team_season", "matchup"])
    .describe(
      "team = a franchise across all the filtered years; team_season = one team in one season (e.g. the 1930 Yankees); matchup = one franchise's head-to-head record against another (each pair appears once from each side). All rank every team unless team_ids is set; with team_ids, matchup gives that team's record against each opponent.",
    ),
  filters: filtersSchema.optional(),
  sort_by: z
    .enum([
      "avg_total_runs",
      "avg_team_runs",
      "avg_margin",
      "games",
      "shutout_rate",
      "extra_inning_rate",
      "win_pct",
      "win_loss_gap",
      "first_game",
    ])
    .optional()
    .describe(
      "Defaults to win_loss_gap for matchup, avg_team_runs (runs scored per game) for team and team_season, avg_total_runs otherwise. avg_team_runs, win_pct and win_loss_gap (wins minus losses) need a team grouping or team_ids. first_game ranks by each group's earliest game, for oldest ballparks or franchises.",
    ),
  order: z
    .enum(["highest", "lowest"])
    .optional()
    .describe("Defaults to highest, except first_game defaults to lowest (oldest first)."),
  still_active: z
    .boolean()
    .optional()
    .describe(
      "Only groups that played in the latest season in the data, e.g. ballparks still in use or franchises still playing. Don't combine with year filters when asking about the oldest.",
    ),
  min_games: z
    .number()
    .int()
    .min(1)
    .max(5000)
    .optional()
    .describe(
      "Skip groups with fewer games. Defaults: ballpark 100 (so one-off neutral sites don't top the list), matchup 100, team_season 50, team 500, otherwise 1.",
    ),
  limit: z.number().int().min(1).max(25).optional().describe("Defaults to 10."),
});

/** Games grouped by ballpark, season, decade, franchise, team-season or matchup, with per-group averages. */
export async function groupStats(input: z.infer<typeof groupStatsInput>) {
  const f = input.filters ?? {};
  const byTeam = ["team", "team_season", "matchup"].includes(input.group_by);
  const teamSide = byTeam || !!f.team_ids?.length;
  const sortBy =
    input.sort_by ?? (input.group_by === "matchup" ? "win_loss_gap" : byTeam ? "avg_team_runs" : "avg_total_runs");
  if ((sortBy === "avg_team_runs" || sortBy === "win_pct" || sortBy === "win_loss_gap") && !teamSide) {
    throw new ToolInputError(`sort_by ${sortBy} needs group_by team or team_season, or team_ids.`);
  }
  const group = GROUPS[input.group_by];
  const minGames = input.min_games ?? group.minGames;
  const params: unknown[] = [];
  const games = gamesSql(f, params, { everyTeam: byTeam });
  const order = input.order ?? (sortBy === "first_game" ? "lowest" : "highest");
  const dir = order === "lowest" ? "ASC" : "DESC";
  const active = input.still_active
    ? ` AND max(date) >= (SELECT make_date(max(${YEAR}), 1, 1) FROM gamelogs)`
    : "";
  const rows = await readOnlyQuery<{
    grp: string | number;
    games: number;
    avg_total: string;
    avg_team: string;
    avg_opp: string;
    avg_margin: string;
    runs_scored: number;
    runs_allowed: number;
    shutouts: number;
    extra: number;
    wins: number;
    losses: number;
    first_year: number;
    last_year: number;
    first_game: string;
    last_game: string;
    seasons: number;
    groups: number;
  }>(
    `WITH g AS (${games})
     SELECT ${group.cols},
       count(*)::int AS games,
       round(avg(team_score + opp_score), 2)::text AS avg_total,
       round(avg(team_score), 2)::text AS avg_team,
       round(avg(opp_score), 2)::text AS avg_opp,
       round(avg(abs(team_score - opp_score)), 2)::text AS avg_margin,
       sum(team_score)::int AS runs_scored,
       sum(opp_score)::int AS runs_allowed,
       count(*) FILTER (WHERE LEAST(team_score, opp_score) = 0)::int AS shutouts,
       count(*) FILTER (WHERE innings > 9)::int AS extra,
       count(*) FILTER (WHERE team_score > opp_score)::int AS wins,
       count(*) FILTER (WHERE team_score < opp_score)::int AS losses,
       min(${YEAR}) AS first_year,
       max(${YEAR}) AS last_year,
       min(date)::text AS first_game,
       max(date)::text AS last_game,
       count(DISTINCT ${YEAR})::int AS seasons,
       (count(*) OVER())::int AS groups
     FROM g WHERE ${resultSql(f)}${input.group_by === "ballpark" ? " AND venue_name IS NOT NULL" : ""}
     GROUP BY ${group.by}
     HAVING count(*) >= $${params.push(minGames)}${active}
     ORDER BY ${GROUP_SORTS[sortBy]} ${dir}, count(*) DESC
     LIMIT $${params.push(input.limit ?? 10)}`,
    params,
  );
  const span = (r: { first_year: number; last_year: number }) =>
    r.first_year === r.last_year ? `${r.first_year}` : `${r.first_year}–${r.last_year}`;
  return {
    group_by: input.group_by,
    sorted_by: `${sortBy} (${order} first)`,
    min_games: minGames,
    ...(input.still_active && { still_active: "only groups that played in the latest season" }),
    groups_meeting_min_games: rows[0]?.groups ?? 0,
    groups: rows.map((r) => ({
      [input.group_by]: r.grp,
      games: r.games,
      ...(teamSide
        ? {
            avg_team_runs: Number(r.avg_team),
            avg_opponent_runs: Number(r.avg_opp),
            runs_scored: r.runs_scored,
            runs_allowed: r.runs_allowed,
            wins: r.wins,
            losses: r.losses,
            win_loss_gap: r.wins - r.losses,
          }
        : { avg_total_runs: Number(r.avg_total) }),
      avg_margin: Number(r.avg_margin),
      shutouts: r.shutouts,
      extra_inning_games: r.extra,
      ...(["ballpark", "team", "matchup"].includes(input.group_by) && {
        years: span(r),
        seasons: r.seasons,
        first_game: r.first_game,
        last_game: r.last_game,
      }),
    })),
  };
}

// --- scorigamis ---

export const scorigamisInput = z.object({
  start_year: year.optional(),
  end_year: year.optional(),
  team_ids: z.array(z.number().int()).max(5).optional().describe("team_ids for ONE team, from lookup_team."),
  scope: z
    .enum(["mlb", "team", "postseason", "modern_era"])
    .optional()
    .describe(
      "mlb (default): scores new to all of MLB history (Scorigami). team: scores new for that team (Franchisigami), requires team_ids. postseason: scores new to postseason history (Playoffigami). modern_era: first time since 1901 for a score that had only happened before 1901 (Modern Era Scorigami). With mlb, postseason or modern_era, team_ids keeps only games involving that team.",
    ),
  limit: z.number().int().min(1).max(25).optional().describe("Defaults to 15."),
});

export async function scorigamis(input: z.infer<typeof scorigamisInput>, sink?: GameSink) {
  const scope = input.scope ?? "mlb";
  if (scope === "team" && !input.team_ids?.length) {
    throw new ToolInputError("scope 'team' needs team_ids. Call lookup_team first.");
  }
  const params: unknown[] = [];
  const p = (v: unknown) => `$${params.push(v)}`;
  const source: Filters =
    scope === "team"
      ? { team_ids: input.team_ids }
      : scope === "postseason"
        ? { game_type: "postseason" }
        : scope === "modern_era"
          ? { start_year: 1901 }
          : {};
  const games = gamesSql(source, params);
  const where = ["TRUE"];
  if (input.start_year) where.push(`date >= ${p(`${input.start_year}-01-01`)}::date`);
  if (input.end_year) where.push(`date < ${p(`${input.end_year + 1}-01-01`)}::date`);
  if (scope === "modern_era") {
    // Only scores that already existed before 1901; true firsts are plain Scorigami.
    where.push(`EXISTS (
      SELECT 1 FROM gamelogs o
      WHERE o.is_negro_league = false AND o.date < '1901-01-01'
        AND GREATEST(o.home_score, o.visitor_score) = GREATEST(team_score, opp_score)
        AND LEAST(o.home_score, o.visitor_score) = LEAST(team_score, opp_score))`);
  }
  if (scope !== "team" && input.team_ids?.length) {
    const t = p(input.team_ids);
    where.push(`(home_team_id = ANY(${t}::bigint[]) OR visitor_team_id = ANY(${t}::bigint[]))`);
  }
  const limit = p(input.limit ?? 15);
  const rows = await readOnlyQuery<GameRow & { total: number }>(
    `WITH g AS (${games}),
     firsts AS (
       SELECT DISTINCT ON (GREATEST(team_score, opp_score), LEAST(team_score, opp_score)) *
       FROM g
       ORDER BY GREATEST(team_score, opp_score), LEAST(team_score, opp_score), date, game_id
     )
     SELECT *, count(*) OVER()::int AS total FROM firsts
     WHERE ${where.join(" AND ")}
     ORDER BY date DESC, game_id DESC
     LIMIT ${limit}`,
    params,
  );
  return {
    scope,
    total: rows[0]?.total ?? 0,
    newest_first: rows.map((r) => toGame(r, sink)),
  };
}

// --- rare_games ---

export const rareGamesInput = z.object({
  label: z
    .enum(["socloseigami", "rarigami"])
    .optional()
    .describe(
      "Sets the range for you: socloseigami is 1–4 times before, rarigami is 1–99 (fewer than 100, so it includes Socloseigamis). Use for every Socloseigami or Rarigami question.",
    ),
  min_prior: z
    .number()
    .int()
    .min(0)
    .max(5000)
    .optional()
    .describe("Minimum times the score had happened before that game. Defaults to 1 (0 would include Scorigamis)."),
  max_prior: z
    .number()
    .int()
    .min(0)
    .max(5000)
    .optional()
    .describe("Maximum times the score had happened before that game. Defaults to 99."),
  filters: filtersSchema.optional().describe("Which games to list. Prior counts always use all of MLB history."),
  limit: z.number().int().min(1).max(20).optional().describe("Defaults to 10."),
});

/** Games whose final score was rare at the time, newest first, with how many times it had happened before. */
export async function rareGames(input: z.infer<typeof rareGamesInput>, sink?: GameSink) {
  const f = input.filters ?? {};
  const min = input.label ? 1 : input.min_prior ?? 1;
  const max = input.label === "socloseigami" ? 4 : input.label === "rarigami" ? 99 : input.max_prior ?? 99;
  if (min > max) throw new ToolInputError("min_prior must be less than or equal to max_prior.");
  const params: unknown[] = [];
  const p = (v: unknown) => `$${params.push(v)}`;
  const games = gamesSql({ ...f, include_negro_leagues: false }, params);
  const rows = await readOnlyQuery<GameRow & { prior: number; total: number }>(
    `WITH ranked AS (
       SELECT game_id,
         (ROW_NUMBER() OVER (
            PARTITION BY GREATEST(home_score, visitor_score), LEAST(home_score, visitor_score)
            ORDER BY date, game_id) - 1)::int AS prior
       FROM gamelogs WHERE is_negro_league = false
     ),
     g AS (${games})
     SELECT g.*, r.prior, count(*) OVER()::int AS total
     FROM g JOIN ranked r USING (game_id)
     WHERE r.prior BETWEEN ${p(min)} AND ${p(max)} AND ${resultSql(f)}
     ORDER BY g.date DESC, g.game_id DESC
     LIMIT ${p(input.limit ?? 10)}`,
    params,
  );
  return {
    total_matching: rows[0]?.total ?? 0,
    prior_range: `${min}–${max}`,
    newest_first: rows.map((r) => ({ ...toGame(r, sink), times_happened_before: r.prior })),
  };
}

// --- gamis ---

export const gamisInput = z.object({
  filters: filtersSchema
    .optional()
    .describe("Which games to list. With team_ids, Franchisigami means a first for that team. Labels always use all of MLB history."),
  limit: z.number().int().min(1).max(20).optional().describe("Defaults to 10."),
});

/**
 * CTEs ending in `labeled` (game_id, date, prior, labels): every gami label each
 * game earned, using all of MLB history. A Scorigami is a first for both
 * franchises and the postseason, so it gets only that label. With `team`,
 * Franchisigami means a first for that team.
 */
function labeledSql(p: (v: unknown) => string, team: string | null): string {
  const post = p(GAME_TYPE_CODES.postseason);
  return `s AS MATERIALIZED (
       SELECT game_id, date, game_type, home_team_id, visitor_team_id,
         GREATEST(home_score, visitor_score) AS w, LEAST(home_score, visitor_score) AS l
       FROM gamelogs WHERE is_negro_league = false
     ),
     ranked AS (
       SELECT game_id, date, game_type,
         (ROW_NUMBER() OVER w0 - 1)::int AS prior,
         (count(*) FILTER (WHERE game_type = ANY(${post}::text[])) OVER w1)::int AS prior_post,
         (count(*) FILTER (WHERE date >= '1901-01-01') OVER w1)::int AS prior_modern
       FROM s
       WINDOW w0 AS (PARTITION BY w, l ORDER BY date, game_id),
              w1 AS (w0 ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING)
     ),
     sides AS MATERIALIZED (
       SELECT s.game_id, s.date, s.w, s.l, t.team_id, coalesce(t.franchise, t.team_id::text) AS fr
       FROM s CROSS JOIN LATERAL (VALUES (s.home_team_id), (s.visitor_team_id)) v(team_id)
       JOIN teams t ON t.team_id = v.team_id
     ),
     first_dates AS (SELECT fr, w, l, min(date) AS d FROM sides GROUP BY fr, w, l),
     franchise_firsts AS (
       SELECT DISTINCT ON (x.fr, x.w, x.l) x.game_id, x.team_id
       FROM sides x JOIN first_dates fd ON fd.fr = x.fr AND fd.w = x.w AND fd.l = x.l AND fd.d = x.date
       ORDER BY x.fr, x.w, x.l, x.game_id
     ),
     labeled AS (
       SELECT r.game_id, r.date, r.prior,
         CASE WHEN r.prior = 0 THEN ARRAY['Scorigami'] ELSE array_remove(ARRAY[
           CASE WHEN r.date >= '1901-01-01' AND r.prior_modern = 0 THEN 'Modern Era Scorigami' END,
           CASE WHEN r.game_type = ANY(${post}::text[]) AND r.prior_post = 0 THEN 'Playoffigami' END,
           CASE WHEN r.prior <= 4 THEN 'Socloseigami' END,
           CASE WHEN ff.game_id IS NOT NULL THEN 'Franchisigami' END,
           CASE WHEN r.prior <= 99 THEN 'Rarigami' END
         ], NULL) END AS labels
       FROM ranked r
       LEFT JOIN (
         SELECT DISTINCT game_id FROM franchise_firsts
         ${team ? `WHERE team_id = ANY(${team}::bigint[])` : ""}
       ) ff USING (game_id)
     )`;
}

/** Games of any gami type, newest first, each with every label it earned. */
export async function gamis(input: z.infer<typeof gamisInput>, sink?: GameSink) {
  const f = input.filters ?? {};
  const params: unknown[] = [];
  const p = (v: unknown) => `$${params.push(v)}`;
  const games = gamesSql({ ...f, include_negro_leagues: false }, params);
  const labeled = labeledSql(p, f.team_ids?.length ? p(f.team_ids) : null);
  const rows = await readOnlyQuery<GameRow & { prior: number; labels: string[]; total: number }>(
    `WITH ${labeled},
     g AS (${games})
     SELECT g.*, l.prior, l.labels, count(*) OVER()::int AS total
     FROM g JOIN labeled l USING (game_id)
     WHERE cardinality(l.labels) > 0 AND ${resultSql(f)}
     ORDER BY g.date DESC, g.game_id DESC
     LIMIT ${p(input.limit ?? 10)}`,
    params,
  );
  return {
    total_matching: rows[0]?.total ?? 0,
    newest_first: rows.map((r) => ({ ...toGame(r, sink), labels: r.labels, times_happened_before: r.prior })),
  };
}

// --- missing_scores ---

/** Run distribution for the odds estimate: recent enough to match today's scoring. */
const ODDS_SINCE = 2000;
const GAMES_PER_SEASON = 2430;
const TEAM_GAMES_PER_SEASON = 162;
const MISSING_MAX_RUNS = 50;

export const missingScoresInput = z.object({
  sort: z
    .enum(["most_likely", "lowest_total"])
    .optional()
    .describe("most_likely (default) ranks by estimated chance per game; lowest_total ranks by fewest total runs."),
  team_ids: z
    .array(z.number().int())
    .max(5)
    .optional()
    .describe("team_ids for ONE team, from lookup_team: scores that franchise has never played (possible Franchisigamis)."),
  limit: z.number().int().min(1).max(20).optional().describe("Defaults to 10."),
});

/**
 * Final scores that have never happened (possible future Scorigamis), with an
 * estimated chance per game: each team's runs are treated as independent draws
 * from how often MLB teams have scored each run total since ODDS_SINCE.
 */
export async function missingScores(input: z.infer<typeof missingScoresInput>, opts: { seasonGames?: number } = {}) {
  const params: unknown[] = [];
  const p = (v: unknown) => `$${params.push(v)}`;
  const team = input.team_ids?.length ? p(input.team_ids) : null;
  const rows = await readOnlyQuery<{
    w: number;
    l: number;
    chance: number;
    total_chance: number;
    missing: number;
    missing_30: number;
  }>(
    `WITH base AS (
       SELECT home_score, visitor_score FROM gamelogs
       WHERE is_negro_league = false AND date >= ${p(`${ODDS_SINCE}-01-01`)}::date
     ),
     runs AS (
       SELECT r, count(*)::float8 / (2 * (SELECT count(*) FROM base)) AS share
       FROM (SELECT home_score AS r FROM base UNION ALL SELECT visitor_score FROM base) x
       GROUP BY r
     ),
     seen AS (
       SELECT DISTINCT GREATEST(home_score, visitor_score) AS w, LEAST(home_score, visitor_score) AS l
       FROM gamelogs WHERE is_negro_league = false
       ${team ? `AND (home_team_id = ANY(${team}::bigint[]) OR visitor_team_id = ANY(${team}::bigint[]))` : ""}
     ),
     missing AS (
       SELECT c.w, d.l, 2 * coalesce(a.share, 0) * coalesce(b.share, 0) AS chance
       FROM generate_series(1, ${p(MISSING_MAX_RUNS)}::int) c(w)
       CROSS JOIN LATERAL generate_series(0, c.w - 1) d(l)
       LEFT JOIN seen s ON s.w = c.w AND s.l = d.l
       LEFT JOIN runs a ON a.r = c.w
       LEFT JOIN runs b ON b.r = d.l
       WHERE s.w IS NULL
     )
     SELECT w, l, chance,
       (sum(chance) OVER ())::float8 AS total_chance,
       count(*) OVER ()::int AS missing,
       (count(*) FILTER (WHERE w <= 30) OVER ())::int AS missing_30
     FROM missing
     ORDER BY ${input.sort === "lowest_total" ? "w + l, w" : "chance DESC, w + l"}
     LIMIT ${p(input.limit ?? 10)}`,
    params,
  );
  const sig = (n: number) => Number(n.toPrecision(3)).toLocaleString("en-US");
  const seasonGames = opts.seasonGames ?? (team ? TEAM_GAMES_PER_SEASON : GAMES_PER_SEASON);
  const anyPerGame = rows[0]?.total_chance ?? 0;
  const anyPerSeason = 1 - (1 - anyPerGame) ** seasonGames;
  return {
    never_happened_with_winner_up_to_30_runs: rows[0]?.missing_30 ?? 0,
    [team ? "chance_of_at_least_one_new_score_for_this_team_in_a_season" : "chance_of_at_least_one_scorigami_in_a_season"]:
      `${sig(anyPerSeason * 100)}%`,
    sorted_by: input.sort ?? "most_likely",
    how_chance_is_estimated: `Each team's runs treated as independent, using how often MLB teams scored each run total since ${ODDS_SINCE}. A rough estimate, not a prediction.`,
    scores: rows.map((r) => ({
      score: `${r.w}-${r.l}`,
      total_runs: r.w + r.l,
      ...(r.chance > 0
        ? {
            chance_per_game: `1 in ${sig(1 / r.chance)}`,
            expected_about_once_every: `${sig(1 / (r.chance * seasonGames))} seasons`,
          }
        : { chance_per_game: `no team has scored that many runs since ${ODDS_SINCE}` }),
    })),
  };
}

// --- gami_odds ---

const GAMI_TYPES = ["Scorigami", "Modern Era Scorigami", "Playoffigami", "Socloseigami", "Franchisigami", "Rarigami"];

export const gamiOddsInput = z.object({});

/**
 * Chance of each gami type next season and, while a season is underway, in the
 * rest of it. Scorigamis are too rare since ODDS_SINCE for history to say much,
 * so they use the missing_scores estimate; the rest use the share of past
 * seasons since ODDS_SINCE with at least one (after the same date, for the rest
 * of a season). `asOf` (YYYY-MM-DD) stands in for the latest game date in tests.
 */
export async function gamiOdds(asOf?: string) {
  const params: unknown[] = [];
  const p = (v: unknown) => `$${params.push(v)}`;
  const labeled = labeledSql(p, null);
  const since = p(ODDS_SINCE);
  const latest = asOf ? `${p(asOf)}::date` : "(SELECT max(date) FROM gamelogs WHERE is_negro_league = false)";
  const rows = await readOnlyQuery<{
    yr: number | null;
    label: string | null;
    n: number;
    n_after: number;
    cur: number;
    from_md: string;
    rest_games: number;
    season_over: boolean;
  }>(
    `WITH ${labeled},
     cutoff AS (SELECT d, extract(year FROM d)::int AS cur, to_char(d + 1, 'MM-DD') AS md FROM (SELECT ${latest} AS d) x),
     rest AS (
       SELECT count(*)::float8 / greatest(1, (SELECT cur FROM cutoff) - ${since}::int) AS games
       FROM gamelogs
       WHERE is_negro_league = false
         AND date >= make_date(${since}::int, 1, 1) AND date < make_date((SELECT cur FROM cutoff), 1, 1)
         AND to_char(date, 'MM-DD') >= (SELECT md FROM cutoff)
     ),
     ws_wins AS (
       SELECT count(*) AS n FROM gamelogs
       WHERE game_type = 'W' AND date >= make_date((SELECT cur FROM cutoff), 1, 1) AND date <= (SELECT d FROM cutoff)
       GROUP BY CASE WHEN home_score > visitor_score THEN home_team_id ELSE visitor_team_id END
     ),
     counts AS (
       SELECT extract(year FROM date)::int AS yr, x.label, count(*)::int AS n,
         (count(*) FILTER (WHERE to_char(date, 'MM-DD') >= (SELECT md FROM cutoff)))::int AS n_after
       FROM labeled CROSS JOIN LATERAL unnest(labels) x(label)
       WHERE date >= make_date(${since}::int, 1, 1) AND date <= (SELECT d FROM cutoff)
       GROUP BY 1, 2
     )
     SELECT c.yr, c.label, c.n, c.n_after, k.cur, k.md AS from_md, r.games AS rest_games,
       coalesce((SELECT max(n) FROM ws_wins), 0) >= 4 AS season_over
     FROM cutoff k CROSS JOIN rest r LEFT JOIN counts c ON TRUE`,
    params,
  );
  const { cur, from_md: fromMd, rest_games: restGames, season_over: seasonOver } = rows[0];
  // A season is over once someone wins the World Series, or once past seasons had no games left by this date.
  const inSeason = !seasonOver && restGames >= 1;
  const lastFull = inSeason ? cur - 1 : cur;
  const seasons = lastFull - ODDS_SINCE + 1;
  const pastSeasons = cur - ODDS_SINCE;
  const [full, rest] = await Promise.all([
    missingScores({ limit: 1 }),
    inSeason ? missingScores({ limit: 1 }, { seasonGames: Math.min(Math.round(restGames), GAMES_PER_SEASON) }) : null,
  ]);
  const sig = (n: number) => Number(n.toPrecision(3)).toLocaleString("en-US");
  const share = (withOne: number, of: number) => (withOne === of ? "nearly 100%" : `${sig((withOne / of) * 100)}%`);
  const from = new Date(`2000-${fromMd}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  const byType = (type: string) => rows.filter((r) => r.label === type && r.yr !== null) as { yr: number; n: number; n_after: number }[];

  return {
    next_season: {
      season: cur + 1,
      seasons_counted: `${ODDS_SINCE}–${lastFull} (${seasons} seasons)`,
      types: GAMI_TYPES.map((type) => {
        const done = byType(type).filter((r) => r.yr <= lastFull);
        const withOne = done.length;
        const total = done.reduce((a, r) => a + r.n, 0);
        const perSeason = total / seasons;
        return {
          type,
          chance_of_at_least_one:
            type === "Scorigami" ? (full.chance_of_at_least_one_scorigami_in_a_season as string) : share(withOne, seasons),
          how_chance_is_estimated:
            type === "Scorigami"
              ? `From the scores that have never happened and how often teams score each run total. History alone says little: ${total} since ${ODDS_SINCE}.`
              : `${withOne} of the ${seasons} seasons since ${ODDS_SINCE} had at least one.`,
          how_often:
            perSeason === 0
              ? `none since ${ODDS_SINCE}`
              : perSeason < 1
                ? `about one every ${sig(1 / perSeason)} seasons since ${ODDS_SINCE}`
                : `about ${sig(perSeason)} per season since ${ODDS_SINCE}`,
          [`in_${lastFull}`]: done.find((r) => r.yr === lastFull)?.n ?? 0,
        };
      }),
    },
    ...(inSeason && {
      rest_of_this_season: {
        season: cur,
        from,
        types: GAMI_TYPES.map((type) => {
          const past = byType(type).filter((r) => r.yr < cur && r.n_after > 0).length;
          return {
            type,
            chance_of_at_least_one:
              type === "Scorigami" ? (rest!.chance_of_at_least_one_scorigami_in_a_season as string) : share(past, pastSeasons),
            how_chance_is_estimated:
              type === "Scorigami"
                ? "From the scores that have never happened, how often teams score each run total, and the games left."
                : `${past} of the ${pastSeasons} seasons since ${ODDS_SINCE} had at least one from ${from} on.`,
            so_far_this_season: byType(type).find((r) => r.yr === cur)?.n ?? 0,
          };
        }),
      },
    }),
  };
}

// --- run_sql ---

export const runSqlInput = z.object({
  sql: z
    .string()
    .min(10)
    .max(4000)
    .describe("One PostgreSQL SELECT over gamelogs, teams and lineage. Aggregate in SQL; at most 200 rows come back."),
});

async function registerGames(ids: string[], sink: GameSink) {
  const params: unknown[] = [];
  const games = gamesSql({ include_negro_leagues: true }, params);
  const rows = await readOnlyQuery<GameRow>(
    `SELECT * FROM (${games}) g WHERE game_id = ANY($${params.push(ids)}::bigint[])`,
    params,
  );
  for (const r of rows) toGame(r, sink);
}

export async function runSql({ sql }: z.infer<typeof runSqlInput>, sink?: GameSink) {
  const checked = await checkSql(sql);
  if ("error" in checked) throw new ToolInputError(checked.error);
  let rows: Record<string, unknown>[];
  try {
    rows = await readOnlyQuery<Record<string, unknown>>(checked.sql, [], { readerOnly: true });
  } catch (err) {
    // The model needs Postgres's message (unknown column, bad GROUP BY) to fix its query.
    throw new ToolInputError(`Query failed: ${(err as Error).message}`);
  }
  const truncated = rows.length > MAX_ROWS;
  const kept = rows.slice(0, MAX_ROWS).map(({ game_id, ...rest }) =>
    game_id != null ? { ref: `g${game_id}`, ...rest } : rest,
  );
  const ids = rows.slice(0, MAX_ROWS).flatMap((r) => (r.game_id != null ? [String(r.game_id)] : []));
  if (sink && ids.length) await registerGames(ids, sink);
  return {
    row_count: kept.length,
    ...(truncated && { truncated: `Only the first ${MAX_ROWS} rows are shown. Aggregate or add LIMIT.` }),
    rows: kept,
  };
}

// --- data freshness ---

export async function latestGameDate(): Promise<string | null> {
  const [row] = await readOnlyQuery<{ d: string | null }>(
    `SELECT to_char(max(date), 'YYYY-MM-DD') AS d FROM gamelogs WHERE is_negro_league = false`,
  );
  return row?.d ?? null;
}
