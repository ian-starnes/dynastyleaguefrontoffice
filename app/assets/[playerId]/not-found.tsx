import Link from "next/link";
import { Card } from "@/components/ui/Card";

export default function PlayerNotFound() {
  return (
    <div>
      <Link
        href="/assets"
        className="text-sm font-medium text-ink/50 hover:text-primary"
      >
        ← Assets
      </Link>
      <Card className="mt-6 p-8">
        <p className="text-sm text-ink/60">
          No player found with that ID. They may have been removed from the
          NFL, or the link may be out of date.
        </p>
      </Card>
    </div>
  );
}
