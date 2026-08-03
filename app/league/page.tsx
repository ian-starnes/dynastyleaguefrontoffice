import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatTile } from "@/components/ui/StatTile";
import { FranchiseRankingsTable } from "@/components/league/FranchiseRankingsTable";
import { FranchiseValueService } from "@/lib/services/franchiseValueService";
import { formatDollarValue } from "@/lib/format";

// Server Component: all data access goes through FranchiseValueService,
// which itself goes through lib/league-players.ts and lib/sleeper — never
// directly inside a UI component.
export default async function LeaguePage() {
  try {
    const service = new FranchiseValueService();
    const summary = await service.getLeagueEconomicsSummary();

    const largestSurplusPlayer = summary.largestKeeperSurplus?.player ?? null;
    const largestContractPlayer = summary.largestContract?.player ?? null;

    return (
      <div>
        <PageHeader
          title="League"
          description="Franchise value, roster strength, and where every team stands."
        />

        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile
            label="Average Asset Value"
            value={formatDollarValue(summary.averageAssetValue)}
          />
          <StatTile
            label="Total Keeper Surplus"
            value={`${summary.totalKeeperSurplus >= 0 ? "+" : ""}${formatDollarValue(summary.totalKeeperSurplus)}`}
            valueClassName={
              summary.totalKeeperSurplus >= 0 ? "text-primary" : "text-red-700"
            }
          />
          <StatTile
            label="Largest Keeper Surplus"
            value={
              largestSurplusPlayer
                ? `${largestSurplusPlayer.keeperSurplus! >= 0 ? "+" : ""}${formatDollarValue(largestSurplusPlayer.keeperSurplus!)}`
                : "—"
            }
            valueClassName="text-primary"
            sublabel={
              largestSurplusPlayer
                ? `${largestSurplusPlayer.nflPlayer.fullName} · ${largestSurplusPlayer.currentOwnerName ?? "Free agent"}`
                : undefined
            }
          />
          <StatTile
            label="Largest Contract"
            value={
              largestContractPlayer
                ? formatDollarValue(largestContractPlayer.keeperCost)
                : "—"
            }
            sublabel={
              largestContractPlayer
                ? `${largestContractPlayer.nflPlayer.fullName} · ${largestContractPlayer.currentOwnerName ?? "Free agent"}`
                : undefined
            }
          />
        </div>

        <h2 className="mt-10 font-serif text-xl text-primary">
          Franchise Rankings
        </h2>
        <Card className="mt-4">
          <FranchiseRankingsTable franchises={summary.franchises} />
        </Card>
      </div>
    );
  } catch (error) {
    return (
      <div>
        <PageHeader
          title="League"
          description="Franchise value, roster strength, and where every team stands."
        />
        <Card className="mt-8 p-8">
          <p className="text-sm text-ink/60">
            Couldn&apos;t load league economics
            {error instanceof Error ? `: ${error.message}` : "."}
          </p>
        </Card>
      </div>
    );
  }
}
