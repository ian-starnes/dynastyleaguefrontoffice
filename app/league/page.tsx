import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";

// Placeholder route — establishes the destination for the "League" nav
// item. Intentionally free of football/domain logic; this is shell only.
export default function LeaguePage() {
  return (
    <div>
      <PageHeader
        title="League"
        description="League-wide settings and standings will live here."
      />
      <Card className="mt-8 p-8">
        <p className="text-sm text-ink/50">Coming soon.</p>
      </Card>
    </div>
  );
}
