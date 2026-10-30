/// <reference types="astro/client" />

// Server environment available in pages and API routes as
// Astro.locals.runtime.env / context.locals.runtime.env (set by src/middleware.ts).
// The database is NOT in here: use getDb() from src/db (MySQL via DATABASE_URL).
interface Env {
  // Local-disk image storage (replaces the Cloudflare R2 bucket).
  BUCKET: import('./lib/server-env').MediaStore;
  // Turnstile SITE key (public) and SECRET key. Defaults are Cloudflare's test keys.
  TURNSTILE_SITE_KEY: string;
  TURNSTILE_SECRET_KEY: string;
  // When true, the inquiry endpoint skips the Turnstile check (offline demos).
  TURNSTILE_DISABLED: boolean;
}

declare namespace App {
  interface Locals {
    runtime: { env: Env };
  }
}
