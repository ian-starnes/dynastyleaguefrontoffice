import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";

// Placeholder route for the "Trades" nav item. Shell only — no trade logic.
export default function TradesPage() {
  return (
    <div>
      <PageHeader
        title="Trades"
        description="Trade proposals and history will live here."
      />
      <Card className="mt-8 p-8">
        <p className="text-sm text-ink/50">Coming soon.</p>
      </Card>
    </div>
  );
}
