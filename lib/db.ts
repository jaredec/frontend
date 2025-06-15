/**
 * Simple Postgres connection pool
 * (Handles production SSL and development hot-reloading)
 */
import { Pool } from "pg";

// We need to declare this for TypeScript to understand the global type.
declare global {
  // eslint-disable-next-line no-var
  var devPool: Pool;
}

let pool: Pool;

// Check if we are in a production environment (like Vercel)
if (process.env.NODE_ENV === "production") {
  // If so, use the production configuration with SSL
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false, // Required for Supabase connections from serverless environments
    },
  });
} else {
  // If in development, use a global variable to preserve the pool across hot-reloads
  if (!global.devPool) {
    global.devPool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });
  }
  pool = global.devPool;
}

// ▼▼▼ CORRECTED: Changed 'export const pool = pool' to the correct syntax ▼▼▼
export { pool };