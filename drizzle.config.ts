import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

// Drizzle Kit config for MySQL 8.
//   npm run db:generate  → writes SQL migration files from src/db/schema.ts
//   npm run db:migrate   → applies them to the database in DATABASE_URL (.env)
export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle/migrations',
  dialect: 'mysql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'mysql://root@localhost:3306/togomoto_db',
  },
  strict: true,
  verbose: true,
});
