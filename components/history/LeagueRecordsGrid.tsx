import { StatTile } from "@/components/ui/StatTile";
import { formatDollarValue } from "@/lib/format";
import type { LeagueRecords } from "@/lib/services/leagueHistoryService";

export function LeagueRecordsGrid({ records }: { records: LeagueRecords }) {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
      <StatTile
        label="Highest Weekly Score"
        value={records.highestWeeklyScore ? records.highestWeeklyScore.score.toFixed(1) : "—"}
        sublabel={
          records.highestWeeklyScore
            ? `${records.highestWeeklyScore.ownerName} · ${records.highestWeeklyScore.season} wk${records.highestWeeklyScore.week}`
            : undefined
        }
      />
      <StatTile
        label="Lowest Weekly Score"
        value={records.lowestWeeklyScore ? records.lowestWeeklyScore.score.toFixed(1) : "—"}
        sublabel={
          records.lowestWeeklyScore
            ? `${records.lowestWeeklyScore.ownerName} · ${records.lowestWeeklyScore.season} wk${records.lowestWeeklyScore.week}`
            : undefined
        }
      />
      <StatTile
        label="Highest Season Score"
        value={records.highestSeasonScore ? records.highestSeasonScore.points.toFixed(0) : "—"}
        sublabel={
          records.highestSeasonScore
            ? `${records.highestSeasonScore.ownerName} · ${records.highestSeasonScore.season}`
            : undefined
        }
      />
      <StatTile
        label="Lowest Season Score"
        value={records.lowestSeasonScore ? records.lowestSeasonScore.points.toFixed(0) : "—"}
        sublabel={
          records.lowestSeasonScore
            ? `${records.lowestSeasonScore.ownerName} · ${records.lowestSeasonScore.season}`
            : undefined
        }
      />
      <StatTile
        label="Most Championships"
        value={records.mostChampionships?.count ?? "—"}
        sublabel={records.mostChampionships?.ownerName ?? undefined}
      />
      <StatTile
        label="Most Finals Appearances"
        value={records.mostFinalsAppearances?.count ?? "—"}
        sublabel={records.mostFinalsAppearances?.ownerName ?? undefined}
      />
      <StatTile
        label="Most Third-Place Finishes"
        value={records.mostThirdPlaceFinishes?.count ?? "—"}
        sublabel={records.mostThirdPlaceFinishes?.ownerName ?? undefined}
      />
      <StatTile
        label="Largest Blowout"
        value={records.largestBlowout ? `+${records.largestBlowout.margin.toFixed(1)}` : "—"}
        sublabel={
          records.largestBlowout
            ? `${records.largestBlowout.winnerOwnerName} · ${records.largestBlowout.season} wk${records.largestBlowout.week}`
            : undefined
        }
      />
      <StatTile
        label="Closest Victory"
        value={records.closestVictory ? `+${records.closestVictory.margin.toFixed(2)}` : "—"}
        sublabel={
          records.closestVictory
            ? `${records.closestVictory.winnerOwnerName} · ${records.closestVictory.season} wk${records.closestVictory.week}`
            : undefined
        }
      />
      <StatTile
        label="Most Trades"
        value={records.mostTrades?.trades ?? "—"}
        sublabel={records.mostTrades?.ownerName ?? undefined}
      />
      <StatTile
        label="Most Waiver Claims"
        value={records.mostWaiverClaims?.waiverClaims ?? "—"}
        sublabel={records.mostWaiverClaims?.ownerName ?? undefined}
      />
      <StatTile
        label="Most FAAB Spent"
        value={records.mostFaabSpent ? formatDollarValue(records.mostFaabSpent.faabSpent) : "—"}
        sublabel={records.mostFaabSpent?.ownerName ?? undefined}
      />
      <StatTile
        label="Highest Auction Purchase"
        value={
          records.highestAuctionPurchase
            ? formatDollarValue(records.highestAuctionPurchase.price)
            : "—"
        }
        sublabel={
          records.highestAuctionPurchase
            ? `${records.highestAuctionPurchase.ownerName} · ${records.highestAuctionPurchase.season}`
            : undefined
        }
      />
    </div>
  );
}
