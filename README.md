# Togomoto Automotive Dealership — website on MySQL

A **used-vehicle dealership website** (used cars, trucks, heavy equipment, and
spare parts) with a public catalogue, an inquiry form, and an admin back office
(listings, spare parts, announcements, and a Kanban inquiry pipeline).

This is the **MySQL version** of the Togomoto prototype, prepared for the COMP 018
Database Administration project. The original ran on Cloudflare (D1/SQLite + R2);
this version runs as a normal **Node.js** server on your own computer and stores
everything in a **MySQL 8** database. All names, units, and contact details are
fictional.

Built with **Astro 5**, **Drizzle ORM**, and the **mysql2** driver.

---

## 1. What you need to install first

| # | What | Why | Where to get it | Check it worked |
|---|------|-----|-----------------|-----------------|
| 1 | **Node.js 20 LTS or newer** (22 LTS recommended) | Runs the website and the setup commands. `npm` comes with it. | https://nodejs.org/ → **LTS** | `node -v` prints `v20.x` or higher |
| 2 | **MySQL Community Server 8.0 or newer** | The database. | https://dev.mysql.com/downloads/installer/ (Windows: "MySQL Installer" → choose **Server only** or **Developer Default**) | `mysql --version`, or MySQL Workbench connects |
| 3 | **MySQL Workbench** (recommended) | To look at tables, run SQL, and take screenshots for the project. | Included in MySQL Installer, or https://dev.mysql.com/downloads/workbench/ | It opens and connects to "Local instance" |
| 4 | **VS Code** | Editor + built-in terminal. | https://code.visualstudio.com/ | It opens |

**During the MySQL install, write down the root password you set.** The setup
script will ask for it.

> ⚠️ **XAMPP users:** XAMPP comes with **MariaDB**, not MySQL. This project is
> tested on MySQL 8.4. MariaDB will probably work, but use real MySQL for the
> course project so your screenshots and SQL match.

---

## 2. Set it up (one command)

Open the project folder in VS Code, open the terminal (**Terminal → New
Terminal**), make sure MySQL is running, then run:

```bash
npm run setup
```

The script will:

1. check your Node.js version,
2. install the dependencies (`npm install`),
3. **ask for your MySQL login** (host, port, username, password, database name)
   and save it in a file called `.env`,
4. create the database (`togomoto_db` by default),
5. create the 5 tables (migrations in `drizzle/migrations/`),
6. load the demo data (`scripts/seed.sql`).

When you see **"All done!"**, continue to section 3.

> Prefer not to type? On Windows you can double-click **`setup.cmd`**; on
> macOS/Linux run `bash setup.sh`. Both run the same script.

---

## 3. Run the website

```bash
npm run dev
```

Open **http://localhost:4321** in your browser.

- Public site: `http://localhost:4321`
- Admin area: `http://localhost:4321/admin` (no login in this local version)

Stop the server with **`Ctrl + C`**. To start again later, just run `npm run dev`.

---

## 4. Everyday commands

| I want to… | Command |
|------------|---------|
| Start the website (development) | `npm run dev` |
| Build and run the production version | `npm run build` then `npm start` |
| Reload the demo data (keeps the tables) | `npm run db:seed` |
| Erase the database and start fresh | `npm run db:reset` |
| After changing `src/db/schema.ts`: create a migration | `npm run db:generate` |
| Apply new migrations to the database | `npm run db:migrate` |
| Check the code for type errors | `npm run check` |

---

## 5. The database

Connection settings live in **`.env`** (created by the setup script; see
`.env.example`):

```
DATABASE_URL=mysql://root:your_password@localhost:3306/togomoto_db
```

Tables (column names follow the Phase 1 design document):

| Table | Holds | Key points |
|-------|-------|------------|
| `listings` | Units for sale | PK `listing_id`; UNIQUE `slug`, `reference_number`; CHECKs on category, sale status, condition, price, mileage, year |
| `listing_images` | Photos of each unit | FK `listing_id` → listings **ON DELETE CASCADE** |
| `inquiries` | Buyer inquiries / deal pipeline | FK `listing_id` → listings **ON DELETE SET NULL** (leads are never lost); CHECKs on source page and status |
| `spare_parts` | Spare parts catalogue | CHECK price ≥ 0 |
| `announcements` | News posts | UNIQUE `slug`; CHECK published posts have a publish date |

To look at the data: open **MySQL Workbench** → connect → in the left panel,
right-click `togomoto_db` → **Set as Default Schema**, then run for example:

```sql
SELECT listing_id, title, sale_status, price FROM listings;
SELECT inquiry_status, COUNT(*) FROM inquiries GROUP BY inquiry_status;
```

The full table definitions are in `drizzle/migrations/0000_init_mysql.sql`, and
the source of truth is `src/db/schema.ts`.

**Images:** uploaded photos are saved on disk in `storage/media/` (set by
`MEDIA_DIR` in `.env`); the database stores only each file's `storage_key`. The
demo data points to placeholder keys, so cards show a grey placeholder until you
upload real photos in the admin area.

---

## 6. What changed from the Cloudflare version

| Before (Cloudflare) | Now (MySQL version) |
|---------------------|---------------------|
| Cloudflare Workers runtime (`@astrojs/cloudflare`, Wrangler) | Node.js server (`@astrojs/node`) |
| D1 database (SQLite) | **MySQL 8** via `mysql2` + Drizzle (`drizzle-orm/mysql2`) |
| R2 bucket for images | Folder on disk (`storage/media/`) |
| Cloudflare Image Transformations (resizing) | Original file served; sized with `<img>` width/height + CSS |
| `db.batch([...])` (D1 has no transactions) | `db.transaction(...)` for writes, `Promise.all` for reads |
| `INSERT/UPDATE/DELETE ... RETURNING` | `$returningId()` or a SELECT first (MySQL has no RETURNING) |
| `.dev.vars` | `.env` |
| Column names like `id`, `status`, `condition` | Phase 1 names like `listing_id`, `sale_status`, `vehicle_condition` |

The page code was kept the same: Drizzle maps the old property names used in the
code (e.g. `listings.status`) to the new database column names (e.g.
`sale_status`) in one file, `src/db/schema.ts`.

---

## 7. Troubleshooting

**"Could not connect to MySQL"**
Make sure the MySQL server is running (Windows: *Services* → `MySQL80` →
Start, or open MySQL Workbench and connect). Check the username/password in
`.env`. To re-enter them, delete `.env` and run `npm run setup` again.

**`Access denied for user 'root'@'localhost'`**
Wrong password in `.env`. Fix it there (special characters must be URL-encoded,
e.g. `@` → `%40`), or delete `.env` and run setup again — it encodes it for you.

**"Cross-site POST form submissions are forbidden" when uploading images**
Open the site at `http://localhost:4321` (not your IP address). To use another
address (e.g. presenting from a different device on the same Wi-Fi), add it to
`.env`, for example `ALLOWED_HOSTS=192.168.1.20`, and restart the server.

**The inquiry form says "Captcha verification failed"**
The spam check (Cloudflare Turnstile) needs internet. If you are offline, set
`TURNSTILE_DISABLED=true` in `.env` and restart the server.

**"Port 4321 is already in use"**
The site is already running in another terminal. Stop it with `Ctrl + C`, or run
`npm run dev -- --port 4322`.

**`node` / `npm` is not recognized**
Install Node 20+ from https://nodejs.org/, then fully close and reopen VS Code.

---

## 8. Good to know

- **Local only.** The admin area has no login in this version (the Cloudflare
  version used Cloudflare Access). Don't expose it on a public network.
- Turnstile uses Cloudflare's public **TEST** keys by default — they always pass.
- The app connects as the user in `DATABASE_URL`. For the Phase 4 security work,
  create a dedicated MySQL user with only the privileges the app needs and put
  that user in `.env` instead of `root`.
