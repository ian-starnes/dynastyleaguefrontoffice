#!/usr/bin/env node
// Runs lib/db/schema.sql against whatever Postgres database POSTGRES_URL
// (or DATABASE_URL) points at. Plain JS, not TypeScript, so it runs with
// a bare `node` — no build step or TS runner needed for a one-off migration.
//
// Requires the Vercel Postgres env vars locally — run
// `vercel env pull .env.local` after provisioning the database in the
// Vercel dashboard (Storage tab → Create Database → Postgres), then:
//   npm run db:migrate

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.join(__dirname, "..", ".env.local") });

const connectionString = process.env.POSTGRES_URL ?? process.env.DATABASE_URL;
if (!connectionString) {
  console.error(
    "POSTGRES_URL (or DATABASE_URL) is not set — run `vercel env pull .env.local` first."
  );
  process.exit(1);
}
const sql = neon(connectionString);

async function main() {
  const schemaPath = path.join(__dirname, "..", "lib", "db", "schema.sql");
  const schema = readFileSync(schemaPath, "utf-8");

  // The sql tag doesn't support multi-statement scripts, so split on
  // statement-terminating semicolons (schema.sql has no semicolons inside
  // string/jsonb literals, so this simple split is safe here).
  const statements = schema
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean);

  for (const statement of statements) {
    console.log(`Running: ${statement.slice(0, 60).replace(/\s+/g, " ")}...`);
    await sql.query(statement);
  }

  console.log(`Done — ran ${statements.length} statements.`);
}

main().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
