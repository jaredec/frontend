import type { QueryResultRow } from "pg";
import { pool } from "@/lib/db";

/**
 * Every Ask query runs inside a READ ONLY transaction with a short timeout, so a
 * model-chosen filter can never write data or tie up the shared pool.
 */
export async function readOnlyQuery<T extends QueryResultRow>(sql: string, params: unknown[] = []): Promise<T[]> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN READ ONLY");
    await client.query("SET LOCAL statement_timeout = '8s'");
    const { rows } = await client.query<T>(sql, params);
    await client.query("COMMIT");
    return rows;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
