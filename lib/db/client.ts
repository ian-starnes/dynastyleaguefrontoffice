import { neon } from "@neondatabase/serverless";

/**
 * Single shared Postgres connection point for every repository, via
 * @neondatabase/serverless — the actively-maintained driver for Neon
 * (which is what Vercel Postgres runs on; @vercel/postgres itself is
 * deprecated as of this writing, per npm's own install warning and
 * Neon's migration guide).
 *
 * Requires POSTGRES_URL or DATABASE_URL in the environment — Vercel
 * injects one of these automatically once a Postgres database is
 * attached to the project (Storage tab → Create Database). Locally,
 * `vercel env pull .env.local` fetches the same values.
 *
 * Unlike @vercel/postgres's `sql` (which returned `{ rows, rowCount }`),
 * this `sql` resolves directly to an array of row objects — every
 * repository casts that array to its expected row type at the call site
 * rather than relying on a generic type parameter, since the tagged
 * template call itself doesn't support one (verified against the
 * package's own .d.ts, not assumed).
 */
const connectionString = process.env.POSTGRES_URL ?? process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "POSTGRES_URL (or DATABASE_URL) is not set. Provision a Postgres database " +
      "in the Vercel dashboard (Storage tab), then run `vercel env pull .env.local`."
  );
}

export const sql = neon(connectionString);
