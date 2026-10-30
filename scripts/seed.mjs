// Loads scripts/seed.sql into the MySQL database named in DATABASE_URL (.env).
// Usage: npm run db:seed
import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import mysql from 'mysql2/promise';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set. Copy .env.example to .env and fill it in.');
  process.exit(1);
}

const sql = await readFile(new URL('./seed.sql', import.meta.url), 'utf8');
const conn = await mysql.createConnection({ uri: url, multipleStatements: true });
try {
  await conn.query(sql);
  const [[l]] = await conn.query('SELECT COUNT(*) AS n FROM listings');
  const [[i]] = await conn.query('SELECT COUNT(*) AS n FROM inquiries');
  console.log(`Seed loaded: ${l.n} listings, ${i.n} inquiries.`);
} finally {
  await conn.end();
}
