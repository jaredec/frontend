import { z } from "zod";
import { readOnlyQuery } from "@/lib/ask/db";

// Plain query functions behind the Ask tools. Kept free of any AI SDK types so
// the same functions can back an MCP server or an eval harness.

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
    return `SELECT ${cols}, ${mine}_team_id AS team_id, ${mine}_team AS team_name, ${theirs}_team AS opp_name,
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
} as const;

const GROUP_SORTS = {
  avg_total_runs: "avg(team_score + opp_score)",
  avg_team_runs: "avg(team_score)",
  avg_margin: "avg(abs(team_score - opp_score))",
  games: "count(*)",
  shutout_rate: "avg((LEAST(team_score, opp_score) = 0)::int)",
  extra_inning_rate: "avg((innings > 9)::int)",
  win_pct: "avg((team_score > opp_score)::int)",
} as const;

export const groupStatsInput = z.object({
  group_by: z
    .enum(["ballpark", "season", "decade", "team", "team_season"])
    .describe(
      "team = a franchise across all the filtered years; team_season = one team in one season (e.g. the 1930 Yankees). Both rank every team unless team_ids is set.",
    ),
  filters: filtersSchema.optional(),
  sort_by: z
    .enum(["avg_total_runs", "avg_team_runs", "avg_margin", "games", "shutout_rate", "extra_inning_rate", "win_pct"])
    .optional()
    .describe(
      "Defaults to avg_team_runs (runs scored per game) for team and team_season, avg_total_runs otherwise. avg_team_runs and win_pct need a team grouping or team_ids.",
    ),
  order: z.enum(["highest", "lowest"]).optional().describe("Defaults to highest."),
  min_games: z
    .number()
    .int()
    .min(1)
    .max(5000)
    .optional()
    .describe(
      "Skip groups with fewer games. Defaults: ballpark 100 (so one-off neutral sites don't top the list), team_season 50, team 500, otherwise 1.",
    ),
  limit: z.number().int().min(1).max(25).optional().describe("Defaults to 10."),
});

/** Games grouped by ballpark, season, decade, franchise or team-season, with per-group averages. */
export async function groupStats(input: z.infer<typeof groupStatsInput>) {
  const f = input.filters ?? {};
  const byTeam = input.group_by === "team" || input.group_by === "team_season";
  const teamSide = byTeam || !!f.team_ids?.length;
  const sortBy = input.sort_by ?? (byTeam ? "avg_team_runs" : "avg_total_runs");
  if ((sortBy === "avg_team_runs" || sortBy === "win_pct") && !teamSide) {
    throw new ToolInputError(`sort_by ${sortBy} needs group_by team or team_season, or team_ids.`);
  }
  const group = GROUPS[input.group_by];
  const minGames = input.min_games ?? group.minGames;
  const params: unknown[] = [];
  const games = gamesSql(f, params, { everyTeam: byTeam });
  const dir = input.order === "lowest" ? "ASC" : "DESC";
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
       (count(*) OVER())::int AS groups
     FROM g WHERE ${resultSql(f)}${input.group_by === "ballpark" ? " AND venue_name IS NOT NULL" : ""}
     GROUP BY ${group.by}
     HAVING count(*) >= $${params.push(minGames)}
     ORDER BY ${GROUP_SORTS[sortBy]} ${dir}, count(*) DESC
     LIMIT $${params.push(input.limit ?? 10)}`,
    params,
  );
  const span = (r: { first_year: number; last_year: number }) =>
    r.first_year === r.last_year ? `${r.first_year}` : `${r.first_year}–${r.last_year}`;
  return {
    group_by: input.group_by,
    sorted_by: `${sortBy} (${input.order ?? "highest"} first)`,
    min_games: minGames,
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
          }
        : { avg_total_runs: Number(r.avg_total) }),
      avg_margin: Number(r.avg_margin),
      shutouts: r.shutouts,
      extra_inning_games: r.extra,
      ...((input.group_by === "ballpark" || input.group_by === "team") && { years: span(r) }),
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
  const min = input.min_prior ?? 1;
  const max = input.max_prior ?? 99;
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

// --- data freshness ---

export async function latestGameDate(): Promise<string | null> {
  const [row] = await readOnlyQuery<{ d: string | null }>(
    `SELECT to_char(max(date), 'YYYY-MM-DD') AS d FROM gamelogs WHERE is_negro_league = false`,
  );
  return row?.d ?? null;
}
