import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";

// Placeholder route for the "Players" nav item. Shell only — no player data.
export default function PlayersPage() {
  return (
    <div>
      <PageHeader
        title="Players"
        description="Player profiles and valuations will live here."
      />
      <Card className="mt-8 p-8">
        <p className="text-sm text-ink/50">Coming soon.</p>
      </Card>
    </div>
  );
}
