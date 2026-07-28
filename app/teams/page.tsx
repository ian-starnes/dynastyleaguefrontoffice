import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";

// Placeholder route for the "Teams" nav item. Shell only — no roster logic.
export default function TeamsPage() {
  return (
    <div>
      <PageHeader
        title="Teams"
        description="Franchise overviews and rosters will live here."
      />
      <Card className="mt-8 p-8">
        <p className="text-sm text-ink/50">Coming soon.</p>
      </Card>
    </div>
  );
}
