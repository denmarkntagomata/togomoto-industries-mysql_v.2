import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  decimal,
  index,
  int,
  json,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from 'drizzle-orm/mysql-core';
import {
  CATEGORIES,
  CONDITIONS,
  FUEL_TYPES,
  INQUIRY_SOURCES,
  INQUIRY_STATUSES,
  SALE_STATUSES,
  TRANSMISSION_TYPES,
} from './enums';

// ─────────────────────────────────────────────────────────────────────────────
// MySQL 8 schema for the Togomoto Automotive Dealership database.
//
// Ported from the original Cloudflare D1 (SQLite) schema. Two naming layers:
//   • The DATABASE column names follow the Phase 1 design document
//     (e.g. listings.listing_id, listings.sale_status, listings.vehicle_condition).
//   • The TypeScript property names are unchanged from the prototype
//     (e.g. listings.id, listings.status, listings.condition), so every page and
//     API route keeps working without edits. Drizzle maps one to the other.
//
// Phase 1 tables not yet built here (makers, staff, inquiry_status_history,
// part_compatibility, announcement_listings) are added in Phase 3.
// ─────────────────────────────────────────────────────────────────────────────

// Builds a SQL `IN ('a', 'b', ...)` list from an enum array so CHECK constraints
// stay in sync with src/db/enums.ts. A NULL value never fails a CHECK in MySQL,
// so nullable enum columns need no extra guard.
const inList = (values: readonly string[]) =>
  sql.raw(`(${values.map((v) => `'${v}'`).join(', ')})`);

// Structured, display-only extended specs. Unknown keys are ignored by the
// renderer; details that don't fit here go in listings.description.
export interface ListingSpecs {
  net_weight?: string | number;
  gross_weight?: string | number;
  payload?: string | number;
  engine?: string;
  top_speed?: string | number;
  acceleration_0_62?: string | number;
  drive_type?: string;
  gearbox?: string;
  dimensions?: string | { length?: string | number; width?: string | number; height?: string | number };
  weight?: string | number;
}

// Shared column helpers ------------------------------------------------------
const createdAt = () => timestamp('created_at').notNull().defaultNow();
const updatedAt = () => timestamp('updated_at').notNull().defaultNow().onUpdateNow();
const price = (name: string) => decimal(name, { precision: 12, scale: 2, mode: 'number' });

// ── listings ────────────────────────────────────────────────────────────────
export const listings = mysqlTable(
  'listings',
  {
    id: int('listing_id').primaryKey().autoincrement(),
    slug: varchar('slug', { length: 255 }).notNull().unique(),
    category: varchar('category', { length: 30 }).notNull(),
    title: varchar('title', { length: 200 }).notNull(),
    referenceNumber: varchar('reference_number', { length: 120 }).unique(),
    maker: varchar('maker', { length: 120 }), // becomes maker_id → makers in Phase 3
    model: varchar('model', { length: 120 }),
    body: varchar('body_type', { length: 120 }),
    yearOfManufacture: int('year_of_manufacture'),
    mileage: int('mileage'),
    color: varchar('color', { length: 80 }),
    location: varchar('location', { length: 120 }),
    condition: varchar('vehicle_condition', { length: 20 }),
    transmissionType: varchar('transmission_type', { length: 20 }),
    fuelType: varchar('fuel_type', { length: 20 }),
    status: varchar('sale_status', { length: 20 }).notNull().default('available'),
    price: price('price'),
    priceOnApplication: boolean('price_on_application').notNull().default(false),
    description: text('description'),
    specs: json('specs').$type<ListingSpecs>(),
    isFeatured: boolean('is_featured').notNull().default(false),
    isPublished: boolean('is_published').notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('listings_category_status_idx').on(t.category, t.status),
    index('listings_is_published_idx').on(t.isPublished),
    check('listings_category_ck', sql`${t.category} in ${inList(CATEGORIES)}`),
    check('listings_status_ck', sql`${t.status} in ${inList(SALE_STATUSES)}`),
    check('listings_condition_ck', sql`${t.condition} in ${inList(CONDITIONS)}`),
    check('listings_transmission_ck', sql`${t.transmissionType} in ${inList(TRANSMISSION_TYPES)}`),
    check('listings_fuel_ck', sql`${t.fuelType} in ${inList(FUEL_TYPES)}`),
    // BR-04: a unit that is not "Inquire for Price" must have a price; price >= 0.
    check('listings_price_ck', sql`${t.price} >= 0`),
    check('listings_price_required_ck', sql`${t.priceOnApplication} = true or ${t.price} is not null`),
    // BR-05: mileage >= 0 and year of manufacture >= 1950.
    check('listings_mileage_ck', sql`${t.mileage} >= 0`),
    check('listings_year_ck', sql`${t.yearOfManufacture} >= 1950`),
  ],
);

// ── listing_images ──────────────────────────────────────────────────────────
export const listingImages = mysqlTable(
  'listing_images',
  {
    id: int('image_id').primaryKey().autoincrement(),
    listingId: int('listing_id')
      .notNull()
      .references(() => listings.id, { onDelete: 'cascade' }), // BR-06
    r2Key: varchar('storage_key', { length: 255 }).notNull(),
    alt: varchar('alt_text', { length: 300 }),
    sortOrder: int('sort_order').notNull().default(0),
    isPrimary: boolean('is_primary').notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index('listing_images_listing_sort_idx').on(t.listingId, t.sortOrder)],
);

// ── inquiries ───────────────────────────────────────────────────────────────
export const inquiries = mysqlTable(
  'inquiries',
  {
    id: int('inquiry_id').primaryKey().autoincrement(),
    source: varchar('source_page', { length: 20 }).notNull(),
    listingId: int('listing_id').references(() => listings.id, {
      onDelete: 'set null', // BR-08: keep the lead if the unit is deleted
    }),
    name: varchar('buyer_name', { length: 200 }).notNull(),
    email: varchar('email', { length: 254 }).notNull(),
    contactNumber: varchar('contact_number', { length: 50 }).notNull(),
    company: varchar('company', { length: 200 }),
    message: text('message').notNull(),
    status: varchar('inquiry_status', { length: 20 }).notNull().default('new'),
    userAgent: varchar('user_agent', { length: 512 }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('inquiries_source_status_created_idx').on(t.source, t.status, t.createdAt),
    index('inquiries_created_at_idx').on(t.createdAt),
    check('inquiries_source_ck', sql`${t.source} in ${inList(INQUIRY_SOURCES)}`),
    check('inquiries_status_ck', sql`${t.status} in ${inList(INQUIRY_STATUSES)}`),
  ],
);

// ── announcements ───────────────────────────────────────────────────────────
export const announcements = mysqlTable(
  'announcements',
  {
    id: int('announcement_id').primaryKey().autoincrement(),
    slug: varchar('slug', { length: 255 }).notNull().unique(),
    title: varchar('title', { length: 200 }).notNull(),
    excerpt: varchar('excerpt', { length: 500 }),
    body: text('body').notNull(), // Markdown source
    coverImageR2Key: varchar('cover_image_key', { length: 255 }),
    author: varchar('author', { length: 120 }), // becomes author_staff_id → staff in Phase 3
    isPublished: boolean('is_published').notNull().default(false),
    publishedAt: timestamp('published_at'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('announcements_published_idx').on(t.isPublished, t.publishedAt),
    // BR-14: a published announcement must have a publish date.
    check('announcements_published_ck', sql`${t.isPublished} = false or ${t.publishedAt} is not null`),
  ],
);

// ── spare_parts ─────────────────────────────────────────────────────────────
export const spareParts = mysqlTable(
  'spare_parts',
  {
    id: int('part_id').primaryKey().autoincrement(),
    name: varchar('part_name', { length: 200 }).notNull(),
    category: varchar('part_category', { length: 120 }),
    description: text('description'),
    price: price('price'),
    imageR2Key: varchar('image_storage_key', { length: 255 }),
    isPublished: boolean('is_published').notNull().default(false),
    sortOrder: int('sort_order').notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('spare_parts_published_sort_idx').on(t.isPublished, t.sortOrder),
    check('spare_parts_price_ck', sql`${t.price} >= 0`), // BR-16
  ],
);

// Inferred row types for use across queries.
export type Listing = typeof listings.$inferSelect;
export type NewListing = typeof listings.$inferInsert;
export type ListingImage = typeof listingImages.$inferSelect;
export type NewListingImage = typeof listingImages.$inferInsert;
export type Inquiry = typeof inquiries.$inferSelect;
export type NewInquiry = typeof inquiries.$inferInsert;
export type Announcement = typeof announcements.$inferSelect;
export type NewAnnouncement = typeof announcements.$inferInsert;
export type SparePart = typeof spareParts.$inferSelect;
export type NewSparePart = typeof spareParts.$inferInsert;
