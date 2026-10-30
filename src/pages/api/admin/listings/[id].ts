import type { APIContext } from 'astro';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '../../../../db';
import { listingImages, listings } from '../../../../db/schema';
import { cleanSpecs, listingUpdateSchema } from '../../../../db/validators';
import { dbConflict } from '../../../../lib/db-errors';
import { generateUniqueSlug } from '../../../../lib/admin-listings';

// Admin listing update + delete (spec §8.2, §4.8, PLAN P1-8). Access-gated
// (AGENTS.md §5); Zod-validated before any write (AGENTS.md §4). DELETE removes
// the R2 objects in app code — the FK CASCADE only drops the image ROWS
// (AGENTS.md §3). Bindings via context.locals.runtime.env.
export const prerender = false;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function parseId(context: APIContext): number | null {
  const id = Number(context.params.id);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function PATCH(context: APIContext): Promise<Response> {
  const id = parseId(context);
  if (id === null) return json({ error: 'Invalid listing id' }, 400);

  let payload: unknown;
  try {
    payload = await context.request.json();
  } catch {
    return json({ error: 'Body must be JSON' }, 400);
  }

  const parsed = listingUpdateSchema.safeParse(payload);
  if (!parsed.success) {
    return json({ error: 'Validation failed', fields: z.flattenError(parsed.error).fieldErrors }, 422);
  }

  const env = context.locals.runtime.env;
  const db = getDb(env);
  const { specs, slug, ...rest } = parsed.data;

  // The edit form re-submits the slug; de-dupe it against other rows (excluding
  // this one) so an unchanged slug stays put and a clashing one gets a suffix.
  const uniqueSlug = await generateUniqueSlug(env, slug, id);

  const [existing] = await db
    .select({ id: listings.id })
    .from(listings)
    .where(eq(listings.id, id))
    .limit(1);
  if (!existing) return json({ error: 'Listing not found' }, 404);

  try {
    await db
      .update(listings)
      .set({ ...rest, slug: uniqueSlug, specs: cleanSpecs(specs) ?? null, updatedAt: new Date() })
      .where(eq(listings.id, id));
  } catch (err) {
    const conflict = dbConflict(err);
    if (conflict) return json(conflict.body, conflict.status);
    throw err;
  }
  return json({ ok: true, listing: { id, slug: uniqueSlug } });
}

export async function DELETE(context: APIContext): Promise<Response> {
  const id = parseId(context);
  if (id === null) return json({ error: 'Invalid listing id' }, 400);

  const env = context.locals.runtime.env;
  const db = getDb(env);

  // Collect the R2 keys BEFORE the cascade removes the image rows.
  const imgs = await db
    .select({ r2Key: listingImages.r2Key })
    .from(listingImages)
    .where(eq(listingImages.listingId, id));

  const [existing] = await db
    .select({ id: listings.id })
    .from(listings)
    .where(eq(listings.id, id))
    .limit(1);
  if (!existing) return json({ error: 'Listing not found' }, 404);

  // ON DELETE CASCADE removes the listing_images rows; ON DELETE SET NULL keeps
  // the listing's inquiries (BR-06, BR-08).
  await db.delete(listings).where(eq(listings.id, id));

  // App-level image file cleanup (not part of the DB cascade).
  const keys = imgs.map((i) => i.r2Key);
  if (keys.length) await env.BUCKET.delete(keys);

  return json({ ok: true, id });
}
