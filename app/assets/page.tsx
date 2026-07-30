import { getLeaguePlayers } from "@/lib/league-players";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { AssetsExplorer } from "@/components/assets/AssetsExplorer";

// Server Component: all Sleeper access happens through lib/sleeper (and the
// lib/league-players join on top of it) — never directly inside a UI
// component.
export default async function AssetsPage() {
  try {
    const players = await getLeaguePlayers();

    return (
      <div>
        <PageHeader
          title="Assets"
          description="Every player, contract, and the economics behind what they're actually worth to your franchise."
        />
        <div className="mt-8">
          <AssetsExplorer players={players} />
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
