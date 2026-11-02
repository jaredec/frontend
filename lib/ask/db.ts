import { Pool, types, type QueryConfig, type QueryResultRow } from "pg";
import { pool } from "@/lib/db";

declare global {
  // eslint-disable-next-line no-var
  var askReaderPool: Pool | undefined;
}

/**
 * ASK_DATABASE_URL logs in as ask_reader, a Postgres role that can only SELECT
 * from gamelogs, teams and lineage. Model-written SQL only ever runs through it.
 */
function createReaderPool(): Pool | null {
  const url = process.env.ASK_DATABASE_URL;
  if (!url) return null;
  return new Pool({
    connectionString: url,
    max: 2,
    idleTimeoutMillis: 10_000,
    // Dates and timestamps stay text so model-written queries return values the
    // number check can read, with no time zone shift.
    types: {
      getTypeParser: ((oid: number) =>
        [types.builtins.DATE, types.builtins.TIMESTAMP, types.builtins.TIMESTAMPTZ].includes(oid)
          ? (v: string) => v
          : types.getTypeParser(oid)) as typeof types.getTypeParser,
    },
    ...(process.env.NODE_ENV === "production" && { ssl: { rejectUnauthorized: false } }),
  });
}

let readerPool: Pool | null;
if (process.env.NODE_ENV === "production") {
  readerPool = createReaderPool();
} else {
  global.askReaderPool ??= createReaderPool() ?? undefined;
  readerPool = global.askReaderPool ?? null;
}

export const readerConfigured = () => readerPool !== null;

/**
 * Every Ask query runs inside a READ ONLY transaction with a short timeout, so a
 * model-chosen filter can never write data or tie up the shared pool. The extended
 * protocol rejects multiple statements in one string.
 */
export async function readOnlyQuery<T extends QueryResultRow>(
  sql: string,
  params: unknown[] = [],
  { readerOnly = false } = {},
): Promise<T[]> {
  if (readerOnly && !readerPool) throw new Error("ASK_DATABASE_URL is not set");
  const client = await (readerPool ?? pool).connect();
  try {
    await client.query("BEGIN READ ONLY");
    await client.query("SET LOCAL statement_timeout = '8s'");
    const config = { text: sql, values: params, queryMode: "extended" };
    const { rows } = await client.query<T>(config as QueryConfig);
    await client.query("COMMIT");
    return rows;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
