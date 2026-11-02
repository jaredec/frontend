import { parse } from "libpg-query";

// Second line of defense for model-written SQL. The ask_reader role is what
// actually prevents writes; this rejects anything that isn't a plain SELECT
// over the game tables before it reaches the database.

const TABLES = new Set(["gamelogs", "teams", "lineage"]);

const FUNCTIONS = new Set([
  // aggregates
  "count", "sum", "avg", "min", "max", "stddev", "stddev_pop", "stddev_samp", "variance", "var_pop", "var_samp",
  "corr", "percentile_cont", "percentile_disc", "mode", "bool_and", "bool_or", "every", "string_agg", "array_agg",
  // window
  "row_number", "rank", "dense_rank", "percent_rank", "cume_dist", "ntile", "lag", "lead", "first_value",
  "last_value", "nth_value",
  // math
  "abs", "round", "floor", "ceil", "ceiling", "trunc", "power", "sqrt", "mod", "sign", "div",
  // dates
  "extract", "date_part", "date_trunc", "to_char", "to_date", "make_date", "age",
  // text
  "lower", "upper", "initcap", "length", "char_length", "concat", "concat_ws", "substring", "substr", "left",
  "right", "replace", "btrim", "ltrim", "rtrim", "split_part", "strpos", "position", "format",
  // sets and arrays
  "generate_series", "unnest", "array_length", "cardinality",
]);

export const MAX_ROWS = 200;

type Visit = (key: string, value: unknown, ctes: ReadonlySet<string>) => void;
type Cte = { ctename: string; ctequery: unknown };

/**
 * Visits every node, tracking which CTE names are in scope the way Postgres
 * resolves them, so a CTE can't make a real table of the same name look allowed
 * outside its query (or inside its own non-recursive body).
 */
function walk(node: unknown, ctes: ReadonlySet<string>, visit: Visit) {
  if (Array.isArray(node)) {
    for (const n of node) walk(n, ctes, visit);
    return;
  }
  if (!node || typeof node !== "object") return;
  for (const [k, v] of Object.entries(node)) {
    visit(k, v, ctes);
    // UNION/INTERSECT/EXCEPT branches (larg, rarg) are bare SelectStmt bodies.
    const isSelect = k === "SelectStmt" || k === "larg" || k === "rarg";
    if (!isSelect || !v || typeof v !== "object") {
      walk(v, ctes, visit);
      continue;
    }
    const { withClause, ...rest } = v as { withClause?: { recursive?: boolean; ctes?: { CommonTableExpr: Cte }[] } };
    const defs = (withClause?.ctes ?? []).map((c) => c.CommonTableExpr);
    const all = new Set([...ctes, ...defs.map((c) => c.ctename)]);
    defs.forEach((c, i) => {
      const before = new Set([...ctes, ...defs.slice(0, i).map((d) => d.ctename)]);
      walk(c.ctequery, withClause?.recursive ? all : before, visit);
    });
    walk(rest, all, visit);
  }
}

const names = (list: unknown): string[] =>
  Array.isArray(list) ? list.map((n) => (n as { String?: { sval?: string } }).String?.sval ?? "") : [];

/**
 * Returns the exact SQL to run (the query wrapped in a row cap) or why it was
 * rejected. Checks run on the wrapped text, so nothing unchecked can execute.
 */
export async function checkSql(sql: string): Promise<{ sql: string } | { error: string }> {
  const body = sql.trim().replace(/;\s*$/, "");
  const wrapped = `SELECT * FROM (\n${body}\n) AS q LIMIT ${MAX_ROWS + 1}`;

  let tree: { stmts?: { stmt?: Record<string, unknown> }[] };
  try {
    tree = await parse(wrapped);
  } catch (err) {
    return { error: `SQL syntax error: ${(err as Error).message}` };
  }
  if (tree.stmts?.length !== 1 || !tree.stmts[0].stmt?.SelectStmt) {
    return { error: "Write exactly one SELECT statement." };
  }

  let error: string | null = null;
  walk(tree, new Set(), (k, v, ctes) => {
    if (error) return;
    if (k.endsWith("Stmt") && k !== "SelectStmt") {
      error = "Only SELECT queries are allowed.";
    } else if (k === "intoClause" || k === "lockingClause") {
      error = "SELECT INTO and FOR UPDATE aren't allowed.";
    } else if (k === "ParamRef") {
      error = "Write values directly into the SQL; $1-style parameters aren't supported.";
    } else if (k === "RangeVar") {
      const { schemaname, relname } = v as { schemaname?: string; relname: string };
      const isCte = !schemaname && ctes.has(relname) && !relname.startsWith("pg_");
      if (!isCte && !(TABLES.has(relname) && (!schemaname || schemaname === "public"))) {
        error = `Table "${relname}" isn't available. Use gamelogs, teams or lineage.`;
      }
    } else if (k === "FuncCall") {
      const fn = names((v as { funcname: unknown }).funcname);
      const qualified = fn.length > 1 && !(fn.length === 2 && fn[0] === "pg_catalog");
      if (qualified || !FUNCTIONS.has(fn[fn.length - 1])) {
        error = `Function ${fn.join(".")}() isn't allowed.`;
      }
    }
  });
  return error ? { error } : { sql: wrapped };
}
