import { formatDollarValue } from "@/lib/format";
import type { MarketValueChange } from "@/lib/services/marketValueSnapshotService";

function formatShortDate(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

/**
 * A stock-ticker-style change indicator — up/down arrow, color-coded,
 * versus the real "last week" benchmark (see
 * marketValueSnapshotService.ts's getMarketValueChanges — a real
 * snapshot at least 7 days old, never a same-day/next-day comparison
 * masquerading as a weekly one). Null (not zero) when there's no
 * benchmark yet — this feature hasn't been recording real history for a
 * full week yet, so most players won't have one at first.
 */
export function MarketValueChangeBadge({
  change,
}: {
  change: MarketValueChange | null;
}) {
  if (!change) {
    return <span className="text-xs text-ink/25">No benchmark yet</span>;
  }

  if (change.change === 0) {
    return (
      <span
        className="text-xs text-ink/40"
        title={`Unchanged since ${formatShortDate(change.benchmarkDate)}`}
      >
        — $0
      </span>
    );
  }

  const isUp = change.change > 0;
  return (
    <span
      className={`text-xs font-medium ${isUp ? "text-primary" : "text-red-700"}`}
      title={`${formatDollarValue(change.benchmarkValue)} on ${formatShortDate(change.benchmarkDate)}`}
    >
      {isUp ? "▲" : "▼"} {formatDollarValue(Math.abs(change.change))}
    </span>
  );
}
