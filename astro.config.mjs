// @ts-check
import 'dotenv/config';
import { defineConfig } from 'astro/config';
import node from '@astrojs/node';

// Host names the server accepts. Astro uses this list to build each request's
// URL; form uploads (admin images, spare parts, announcements) are rejected as
// "cross-site" if the browser's host is not listed. Add extra hosts (e.g. your
// laptop's LAN IP when presenting from another device) with ALLOWED_HOSTS in
// .env, comma-separated.
const allowedHosts = [
  'localhost',
  '127.0.0.1',
  ...(process.env.ALLOWED_HOSTS ?? '').split(',').map((h) => h.trim()).filter(Boolean),
];

// Astro 5 + @astrojs/node (standalone server) + MySQL.
// Previously ran on Cloudflare Workers with D1 (SQLite) and R2; it now runs as a
// normal Node.js server so it can use a MySQL database on your own computer.
// https://docs.astro.build/en/guides/integrations-guide/node/
export default defineConfig({
  site: 'https://togomoto-industries.example.com',
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  security: {
    allowedDomains: allowedHosts.map((hostname) => ({ hostname })),
  },
  // Images are served by the /media route (src/pages/media/[...key].ts); Astro's
  // own image pipeline is not used.
  image: { service: { entrypoint: 'astro/assets/services/noop' } },
});
