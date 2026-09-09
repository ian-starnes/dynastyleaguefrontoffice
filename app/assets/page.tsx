import { getLeaguePlayers } from "@/lib/league-players";
import { getLeague } from "@/lib/sleeper";
import {
  ensureTodaysMarketValueSnapshot,
  getMarketValueChanges,
} from "@/lib/services/marketValueSnapshotService";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { AssetsExplorer } from "@/components/assets/AssetsExplorer";

// Server Component: all Sleeper access happens through lib/sleeper (and the
// lib/league-players join on top of it) — never directly inside a UI
// component.
export default async function AssetsPage() {
  try {
    const [players, league] = await Promise.all([getLeaguePlayers(), getLeague()]);
    const currentSeason = Number(league.season);

    // Order matters: write today's snapshot first, THEN read prior
    // snapshots — getMarketValueChanges only ever looks at snapshot_date
    // < today, so running these in parallel would be equally correct,
    // but sequencing them removes any doubt a query planner quirk could
    // make today's just-written row visible to the "prior" read.
    await ensureTodaysMarketValueSnapshot(currentSeason, players);
    const marketValueChangesMap = await getMarketValueChanges(players);
    // Plain object, not the Map itself — the safe, unambiguous shape for
    // a Server Component to hand to a Client Component as a prop.
    const marketValueChanges = Object.fromEntries(marketValueChangesMap);

    return (
      <div>
        <PageHeader
          title="Assets"
          description={`Every player, contract, and the economics behind what they're actually worth to your franchise — Market Value is each player's real, live ${currentSeason} valuation, recomputed from current-season data every time this page loads.`}
        />
        <div className="mt-8">
          <AssetsExplorer
            players={players}
            currentSeason={currentSeason}
            marketValueChanges={marketValueChanges}
          />
        </div>
      </div>
    );
  } catch (error) {
    return (
      <div>
        <PageHeader
          title="Assets"
          description="Every player, contract, and the economics behind what they're actually worth to your franchise."
        />
        <Card className="mt-8 p-8">
          <p className="text-sm text-ink/60">
            Couldn&apos;t load Sleeper data
            {error instanceof Error ? `: ${error.message}` : "."}
          </p>
        </Card>
      </div>
    );
  }
}
