import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";

// Placeholder route for the "Settings" nav item. Shell only.
export default function SettingsPage() {
  return (
    <div>
      <PageHeader
        title="Settings"
        description="Account and league configuration will live here."
      />
      <Card className="mt-8 p-8">
        <p className="text-sm text-ink/50">Coming soon.</p>
      </Card>
    </div>
  );
}
