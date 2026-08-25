import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { WallOfChampionsTable } from "@/components/history/WallOfChampionsTable";
import { WallOfShameTable } from "@/components/history/WallOfShameTable";
import { HeadToHeadTable } from "@/components/history/HeadToHeadTable";
import { LeagueRecordsGrid } from "@/components/history/LeagueRecordsGrid";
import { getLeagueHistory } from "@/lib/services/leagueHistoryService";
import { getManagerProfiles } from "@/lib/services/managerProfileService";
import { getLeaguePlayers } from "@/lib/league-players";
import { FranchiseValueService } from "@/lib/services/franchiseValueService";

// Server Component: all data access goes through the domain services —
// leagueHistoryService composes weeklyPerformanceService,
// seasonStandingsService, playoffResultsService, and
// transactionHistoryService, none of which persist anywhere yet (no
// database provisioned) — this is the live equivalent, same pattern as
// every other page in the app.
export default async function HistoryPage() {
  try {
    const [history, players, economicsSummary, franchiseValuations, managerProfiles] =
      await Promise.all([
        getLeagueHistory(),
        getLeaguePlayers(),
        new FranchiseValueService().getLeagueEconomicsSummary(),
        new FranchiseValueService().getFranchiseValuations(),
        getManagerProfiles(),
      ]);

    const managers = [...managerProfiles.values()].sort(
      (a, b) => (a.teamName ?? a.displayName).localeCompare(b.teamName ?? b.displayName)
    );

    const playerNameById = new Map(players.map((p) => [p.nflPlayer.id, p.nflPlayer.fullName]));

    const highestAssetValuePlayer = [...players]
      .filter((p) => p.assetValue !== null)
      .sort((a, b) => (b.assetValue ?? 0) - (a.assetValue ?? 0))[0];

    const largestKeeperSurplus = economicsSummary.largestKeeperSurplus
      ? {
          ownerName: economicsSummary.largestKeeperSurplus.player.currentOwnerName,
          playerName: economicsSummary.largestKeeperSurplus.player.nflPlayer.fullName,
          surplus: economicsSummary.largestKeeperSurplus.player.keeperSurplus ?? 0,
        }
      : null;

    const highestAssetValue = highestAssetValuePlayer
      ? {
          ownerName: highestAssetValuePlayer.currentOwnerName,
          playerName: highestAssetValuePlayer.nflPlayer.fullName,
          value: highestAssetValuePlayer.assetValue ?? 0,
        }
      : null;

    const topFranchise = franchiseValuations[0];
    const highestFranchiseValue = topFranchise
      ? { ownerName: topFranchise.ownerName, value: topFranchise.franchiseValue }
      : null;

    const sortedHeadToHead = [...history.headToHead].sort(
      (a, b) =>
        b.ownerAWins + b.ownerBWins + b.ties - (a.ownerAWins + a.ownerBWins + a.ties)
    );

    return (
      <div>
        <PageHeader
          title="History"
          description="The league's permanent museum — every champion, every rivalry, every record."
        />

        <h2 className="mt-10 font-serif text-xl text-primary">Managers</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {managers.map((manager) => {
            const headliner = manager.ringOfHonorHeadliner;
            const headlinerName = headliner
              ? playerNameById.get(headliner.playerId) ?? headliner.playerId
              : null;

            return (
              <Link key={manager.ownerId} href={`/history/managers/${manager.ownerId}`}>
                <Card className="p-4 transition hover:border-gold/40">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-ink">
                      {manager.teamName ?? manager.displayName}
                    </p>
                    <span className="shrink-0 text-ink/30">→</span>
                  </div>
                  <p className="text-xs text-ink/50">
                    {manager.championships > 0
                      ? `${manager.championships}x champion`
                      : `Best finish: ${manager.bestFinish ?? "—"}`}
                  </p>

                  <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                    <div>
                      <p className="text-ink/40">Avg Pts / Week</p>
                      <p className="font-medium text-ink">
                        {manager.averagePointsPerWeekAllTime.toFixed(1)}
                      </p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-ink/40">Ring of Honor</p>
                      <p className="truncate font-medium text-ink">
                        {headliner
                          ? `${headlinerName} (${headliner.totalStartingLineupPoints.toFixed(0)})`
                          : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-ink/40">PF Rank (All-Time)</p>
                      <p className="font-medium text-ink">
                        #{manager.careerPointsForRank} of {manager.totalManagers}
                      </p>
                    </div>
                    <div>
                      <p className="text-ink/40">Win% Rank (All-Time)</p>
                      <p className="font-medium text-ink">
                        #{manager.winningPercentageRank} of {manager.totalManagers}
                      </p>
                    </div>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>

        <h2 className="mt-10 font-serif text-xl text-primary">Wall of Champions</h2>
        <Card className="mt-4">
          <WallOfChampionsTable seasons={history.wallOfChampions} />
        </Card>

        <h2 className="mt-10 font-serif text-xl text-primary">Wall of Shame</h2>
        <p className="mt-1 text-sm text-ink/50">
          &ldquo;10th at Playoffs&rdquo; is the standing when the regular season ended,
          not the eventual consolation-bracket finish.
        </p>
        <Card className="mt-4">
          <WallOfShameTable seasons={history.wallOfShame} />
        </Card>

        <h2 className="mt-10 font-serif text-xl text-primary">League Records</h2>
        <div className="mt-4">
          <LeagueRecordsGrid
            records={history.records}
            largestKeeperSurplus={largestKeeperSurplus}
            highestAssetValue={highestAssetValue}
            highestFranchiseValue={highestFranchiseValue}
          />
        </div>

        <h2 className="mt-10 font-serif text-xl text-primary">All-Time Head-to-Head</h2>
        <Card className="mt-4">
          <HeadToHeadTable pairs={sortedHeadToHead} />
        </Card>
      </div>
    );
  } catch (error) {
    return (
      <div>
        <PageHeader
          title="History"
          description="The league's permanent museum — every champion, every rivalry, every record."
        />
        <Card className="mt-8 p-8">
          <p className="text-sm text-ink/60">
            Couldn&apos;t load league history
            {error instanceof Error ? `: ${error.message}` : "."}
          </p>
        </Card>
      </div>
    );
  }
}
