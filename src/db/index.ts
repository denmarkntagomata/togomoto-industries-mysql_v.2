import 'dotenv/config';
import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import * as schema from './schema';

// Single entry point for DB access (MySQL 8 via the mysql2 driver).
//
// The connection settings come from DATABASE_URL in the project's .env file, e.g.
//   DATABASE_URL=mysql://togomoto_app:password@localhost:3306/togomoto_db
//
// One connection pool is shared by the whole server. `getDb(env)` keeps the old
// call signature from the Cloudflare version so existing pages and API routes
// did not need to change; the `env` argument is no longer used.
//
// Unlike Cloudflare D1, MySQL supports real transactions. Use
// db.transaction(async (tx) => { ... }) for multi-statement writes that must
// succeed or fail together.

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error('DATABASE_URL is not set. Copy .env.example to .env and fill it in.');
}

// Reuse the pool across hot reloads in `astro dev`.
const globalForDb = globalThis as unknown as { __togomotoPool?: mysql.Pool };
function createPool(url: string): mysql.Pool {
  const p = mysql.createPool({
    uri: url,
    connectionLimit: 10,
    timezone: 'Z', // read TIMESTAMP values as UTC
  });
  // TIMESTAMP columns are stored in UTC. Make every connection use UTC too, so
  // dates read back correctly no matter what time zone the MySQL server uses.
  p.pool.on('connection', (conn) => {
    conn.query("SET time_zone = '+00:00'");
  });
  return p;
}

const pool = globalForDb.__togomotoPool ?? createPool(DATABASE_URL);
globalForDb.__togomotoPool = pool;

const db = drizzle(pool, { schema, mode: 'default' });

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function getDb(_env?: unknown) {
  return db;
}

export type Db = ReturnType<typeof getDb>;
export { schema, pool };

// MySQL duplicate-key error (e.g. a UNIQUE slug or reference number clash).
export function isDuplicateKeyError(err: unknown): boolean {
  const e = err as { code?: string; cause?: { code?: string } } | null;
  return e?.code === 'ER_DUP_ENTRY' || e?.cause?.code === 'ER_DUP_ENTRY';
}

// MySQL CHECK constraint violation (a business rule enforced by the database).
export function isCheckViolation(err: unknown): boolean {
  const e = err as { code?: string; cause?: { code?: string } } | null;
  const code = e?.code ?? e?.cause?.code;
  return code === 'ER_CHECK_CONSTRAINT_VIOLATED';
}
