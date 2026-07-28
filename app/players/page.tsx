import { getLeaguePlayers } from "@/lib/sleeper";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { PlayersExplorer } from "@/components/players/PlayersExplorer";

// Server Component: all Sleeper access happens through lib/sleeper here —
// never directly inside a UI component.
export default async function PlayersPage() {
  try {
    const players = await getLeaguePlayers();

    return (
      <div>
        <PageHeader
          title="Players"
          description="Live NFL player and roster data from Sleeper."
        />
        <div className="mt-8">
          <PlayersExplorer players={players} />
        </div>
      </div>
    );
  } catch (error) {
    return (
      <div>
        <PageHeader
          title="Players"
          description="Live NFL player and roster data from Sleeper."
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
