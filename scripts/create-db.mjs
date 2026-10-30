// Creates the MySQL database named in DATABASE_URL (.env) if it does not exist.
// With --reset, drops it first (erases all data). Used by scripts/setup.mjs.
import 'dotenv/config';
import mysql from 'mysql2/promise';

const raw = process.env.DATABASE_URL;
if (!raw) {
  console.error('DATABASE_URL is not set in .env');
  process.exit(1);
}

const url = new URL(raw);
const database = decodeURIComponent(url.pathname.replace(/^\//, ''));
if (!/^[A-Za-z0-9_]+$/.test(database)) {
  console.error(`Database name "${database}" should use only letters, numbers and underscores.`);
  process.exit(1);
}

const conn = await mysql.createConnection({
  host: url.hostname,
  port: Number(url.port || 3306),
  user: decodeURIComponent(url.username),
  password: decodeURIComponent(url.password),
});
try {
  if (process.argv.includes('--reset')) {
    await conn.query(`DROP DATABASE IF EXISTS \`${database}\``);
    console.log(`Dropped database ${database}.`);
  }
  await conn.query(
    `CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`,
  );
  console.log(`Database ${database} is ready.`);
} finally {
  await conn.end();
}
