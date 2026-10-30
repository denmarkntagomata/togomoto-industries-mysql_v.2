import { defineMiddleware } from 'astro:middleware';
import { serverEnv } from './lib/server-env';

// Makes the server environment available as `Astro.locals.runtime.env` (and
// `context.locals.runtime.env` in API routes), the same place the Cloudflare
// version provided its bindings. This lets the existing pages run unchanged on
// Node.js + MySQL.
export const onRequest = defineMiddleware((context, next) => {
  context.locals.runtime = { env: serverEnv };
  return next();
});
