import 'dotenv/config';
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

// Server environment for the Node.js version of the site.
//
// The Cloudflare version read its bindings from `Astro.locals.runtime.env`
// (D1 database, R2 bucket, Turnstile keys). To keep every page and API route
// unchanged, src/middleware.ts puts this object at the same place. The database
// itself is now reached through src/db/index.ts (MySQL); image files are stored
// on the local disk by MediaStore below instead of in Cloudflare R2.

const MEDIA_ROOT = path.resolve(process.env.MEDIA_DIR ?? 'storage/media');

const CONTENT_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  avif: 'image/avif',
  svg: 'image/svg+xml',
};

function contentTypeFor(key: string): string {
  const ext = key.split('.').pop()?.toLowerCase() ?? '';
  return CONTENT_TYPES[ext] ?? 'application/octet-stream';
}

// Resolve a storage key to a file path, refusing anything that would escape the
// media folder (e.g. keys containing "..").
function fileFor(key: string): string {
  const clean = key.replace(/^\/+/, '');
  const full = path.resolve(MEDIA_ROOT, clean);
  if (full !== MEDIA_ROOT && !full.startsWith(MEDIA_ROOT + path.sep)) {
    throw new Error('Invalid storage key');
  }
  return full;
}

export interface StoredObject {
  key: string;
  body: Uint8Array;
  httpEtag: string;
  httpMetadata: { contentType: string };
}

// Minimal local-disk replacement for the parts of the R2 API the site uses:
// put, get, delete (one key or many) and list (paged).
export class MediaStore {
  async put(
    key: string,
    bytes: Uint8Array | ArrayBuffer,
    _opts?: { httpMetadata?: { contentType?: string } },
  ): Promise<void> {
    const file = fileFor(key);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes));
  }

  async get(key: string): Promise<StoredObject | null> {
    let file: string;
    try {
      file = fileFor(key);
    } catch {
      return null;
    }
    try {
      const body = new Uint8Array(await readFile(file));
      const etag = `"${createHash('sha1').update(body).digest('hex')}"`;
      return { key, body, httpEtag: etag, httpMetadata: { contentType: contentTypeFor(key) } };
    } catch {
      return null;
    }
  }

  async delete(keys: string | string[]): Promise<void> {
    for (const key of Array.isArray(keys) ? keys : [keys]) {
      try {
        await rm(fileFor(key), { force: true });
      } catch {
        // Missing or invalid keys are ignored, like R2.
      }
    }
  }

  async list(opts: { cursor?: string; limit?: number } = {}): Promise<{
    objects: { key: string }[];
    truncated: boolean;
    cursor?: string;
  }> {
    const all: string[] = [];
    async function walk(dir: string): Promise<void> {
      let entries: string[];
      try {
        entries = await readdir(dir);
      } catch {
        return;
      }
      for (const name of entries) {
        const full = path.join(dir, name);
        if ((await stat(full)).isDirectory()) await walk(full);
        else all.push(path.relative(MEDIA_ROOT, full).split(path.sep).join('/'));
      }
    }
    await walk(MEDIA_ROOT);
    all.sort();
    const start = opts.cursor ? Number(opts.cursor) : 0;
    const limit = opts.limit ?? 1000;
    const page = all.slice(start, start + limit);
    const next = start + page.length;
    return {
      objects: page.map((key) => ({ key })),
      truncated: next < all.length,
      cursor: next < all.length ? String(next) : undefined,
    };
  }
}

// Cloudflare's public Turnstile TEST keys: the widget always passes. Real keys
// can be supplied in .env for a deployed site.
const TEST_SITE_KEY = '1x00000000000000000000AA';
const TEST_SECRET_KEY = '1x0000000000000000000000000000000AA';

export const serverEnv: Env = {
  BUCKET: new MediaStore(),
  TURNSTILE_SITE_KEY: process.env.TURNSTILE_SITE_KEY || TEST_SITE_KEY,
  TURNSTILE_SECRET_KEY: process.env.TURNSTILE_SECRET_KEY || TEST_SECRET_KEY,
  TURNSTILE_DISABLED: process.env.TURNSTILE_DISABLED === 'true',
};
