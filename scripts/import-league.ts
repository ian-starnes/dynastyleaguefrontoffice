#!/usr/bin/env tsx
// Runs the full historical import for the league configured via
// NEXT_PUBLIC_SLEEPER_LEAGUE_ID. Requires the Vercel Postgres env vars
// locally (see scripts/migrate.mjs's header comment) — run
// `npm run db:migrate` once before this.
//
//   npm run import:league

import { config } from "dotenv";
import path from "node:path";
import { getSleeperLeagueId } from "@/lib/sleeper";
import { importLeague } from "@/lib/import/leagueImportService";

// Resolved from cwd (this script is run via `npm run import:league`, whose
// cwd is always the project root) rather than __dirname, since that global
// isn't reliably available depending on how tsx treats module scope.
config({ path: path.join(process.cwd(), ".env.local") });

async function main() {
  const rootLeagueId = getSleeperLeagueId();
  console.log(`Importing league history starting from ${rootLeagueId}...`);

  const summary = await importLeague(rootLeagueId, (message) =>
    console.log(message)
  );

  console.log("\nImport complete:");
  console.log(summary);
}

main().catch((error) => {
  console.error("Import failed:", error);
  process.exit(1);
});
