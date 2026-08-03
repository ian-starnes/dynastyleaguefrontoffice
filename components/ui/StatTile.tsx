import type { ReactNode } from "react";
import { Card } from "./Card";

/**
 * A single labeled metric in a card — the shared shape behind every
 * dashboard's stat row (this one, and future contender/power-rankings
 * dashboards). Deliberately generic: callers control color via
 * valueClassName rather than this component knowing about "good/bad."
 */
export function StatTile({
  label,
  value,
  valueClassName = "text-ink",
  sublabel,
}: {
  label: string;
  value: ReactNode;
  valueClassName?: string;
  sublabel?: ReactNode;
}) {
  return (
    <Card className="p-6">
      <p className="text-xs font-medium uppercase tracking-wide text-ink/50">
        {label}
      </p>
      <p className={`mt-2 font-serif text-3xl ${valueClassName}`}>{value}</p>
      {sublabel ? (
        <p className="mt-2 truncate text-xs text-ink/40">{sublabel}</p>
      ) : null}
    </Card>
  );
}
