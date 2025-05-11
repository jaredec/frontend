/**
 * Simple Postgres connection pool
 * (Loaded automatically by Next.js from .env.local)
 */
import { Pool } from "pg";

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL, // e.g. postgres://user:pass@localhost:5432/mlb_scorigami
});
