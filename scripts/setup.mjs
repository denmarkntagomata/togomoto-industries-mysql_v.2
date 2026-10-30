#!/usr/bin/env node
/*
 * One-command setup for the Togomoto website on MySQL.
 *
 * Run it with:   npm run setup            (first-time setup)
 *                npm run db:reset         (wipe the database and start fresh)
 *
 * Steps: check Node version -> install dependencies -> create .env (asks for
 * your MySQL login) -> create the database -> create the tables (migrations)
 * -> load the demo data.
 *
 * Needs a MySQL 8 server running on your computer (for example, MySQL Community
 * Server installed with MySQL Workbench). See README.md.
 */
import { execSync } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(root);

const RESET_DB = process.argv.includes('--reset');
const GREEN = '\x1b[32m', RED = '\x1b[31m', BOLD = '\x1b[1m', DIM = '\x1b[2m', RESET = '\x1b[0m';
const TOTAL = 6;
const ok = (m) => console.log(`${GREEN}✓${RESET} ${m}`);
const step = (n, m) => console.log(`\n${BOLD}[${n}/${TOTAL}] ${m}${RESET}`);
const die = (m) => { console.error(`\n${RED}✗ ${m}${RESET}`); process.exit(1); };

function run(cmd) {
  console.log(`${DIM}> ${cmd}${RESET}`);
  // stdin is not passed to child commands, so they can't swallow the answers
  // typed for the MySQL questions.
  execSync(cmd, { stdio: ['ignore', 'inherit', 'inherit'] });
}

console.log(`${BOLD}\n  Togomoto — MySQL setup${RESET}\n  ${DIM}This takes a few minutes the first time (it downloads dependencies).${RESET}`);

// 1. Node version (Astro 5 needs Node 20.3+ / 22+)
step(1, 'Checking your Node.js version');
const major = Number(process.versions.node.split('.')[0]);
if (Number.isNaN(major) || major < 20) {
  die(`Node ${process.versions.node} is too old. Install Node.js 20 LTS or newer from https://nodejs.org/ and run this again.`);
}
ok(`Node ${process.versions.node} is good.`);

// 2. Dependencies
step(2, 'Installing dependencies (npm install)');
if (RESET_DB && existsSync('node_modules')) {
  ok('Already installed — skipping.');
} else {
  try { run('npm install'); ok('Dependencies installed.'); }
  catch { die('npm install failed. Check your internet connection and try again.'); }
}

// 3. .env with the MySQL connection
step(3, 'Creating .env (your MySQL connection)');
if (existsSync('.env')) {
  ok('.env already exists — leaving it as is. (Delete it and run setup again to re-enter your login.)');
} else {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  let inputClosed = false;
  const closed = new Promise((resolve) => rl.once('close', () => { inputClosed = true; resolve(''); }));
  // If input ends early (e.g. piped), fall back to the default value.
  const ask = async (q, def) => {
    if (inputClosed) return def || '';
    const answer = await Promise.race([
      rl.question(`  ${q}${def !== undefined ? ` ${DIM}[${def}]${RESET}` : ''}: `),
      closed,
    ]);
    return String(answer).trim() || def || '';
  };
  console.log(`  ${DIM}Press Enter to accept the value in [brackets].${RESET}`);
  const host = await ask('MySQL host', 'localhost');
  const port = await ask('MySQL port', '3306');
  const user = await ask('MySQL username', 'root');
  const password = await ask('MySQL password (leave blank if none)', '');
  const database = await ask('Database name', 'togomoto_db');
  rl.close();
  const auth = encodeURIComponent(user) + (password ? `:${encodeURIComponent(password)}` : '');
  const url = `mysql://${auth}@${host}:${port}/${database}`;
  writeFileSync(
    '.env',
    [
      '# MySQL connection used by the website, migrations and seed script.',
      `DATABASE_URL=${url}`,
      '',
      '# Where uploaded images are saved (relative to the project folder).',
      'MEDIA_DIR=storage/media',
      '',
      '# Cloudflare Turnstile (spam check on inquiry forms). Leave blank to use',
      '# Cloudflare\'s public TEST keys, which always pass. Set TURNSTILE_DISABLED=true',
      '# to skip the check entirely when you have no internet connection.',
      'TURNSTILE_SITE_KEY=',
      'TURNSTILE_SECRET_KEY=',
      'TURNSTILE_DISABLED=false',
      '',
    ].join('\n'),
  );
  ok('Created .env.');
}

// 4. Database
step(4, RESET_DB ? 'Re-creating the database (all data will be erased)' : 'Creating the database');
try { run(`node scripts/create-db.mjs${RESET_DB ? ' --reset' : ''}`); }
catch { die('Could not connect to MySQL. Is the MySQL server running, and are the details in .env correct?'); }

// 5. Tables
step(5, 'Creating the tables (migrations)');
try { run('npx drizzle-kit migrate'); ok('Tables ready.'); }
catch { die('Migration failed. See the output above.'); }

// 6. Demo data
step(6, 'Loading demo data (seed)');
try { run('node scripts/seed.mjs'); ok('Demo data loaded.'); }
catch { die('Seeding failed. See the output above.'); }

console.log(`\n${GREEN}${BOLD}  All done!${RESET}\n`);
console.log(`  Start the site with:\n\n    ${BOLD}npm run dev${RESET}\n`);
console.log(`  Then open ${BOLD}http://localhost:4321${RESET} (admin: ${BOLD}http://localhost:4321/admin${RESET}).`);
console.log(`  Press ${BOLD}Ctrl + C${RESET} in the terminal to stop the server.\n`);
