import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { WallOfChampionsTable } from "@/components/history/WallOfChampionsTable";
import { WallOfShameTable } from "@/components/history/WallOfShameTable";
import { HeadToHeadTable } from "@/components/history/HeadToHeadTable";
import { LeagueRecordsGrid } from "@/components/history/LeagueRecordsGrid";
import { getLeagueHistory } from "@/lib/services/leagueHistoryService";
import { getManagerProfiles } from "@/lib/services/managerProfileService";
import { getAllPlayerNames } from "@/lib/sleeper";

// Server Component: all data access goes through the domain services —
// leagueHistoryService composes weeklyPerformanceService,
// seasonStandingsService, playoffResultsService, and
// transactionHistoryService, none of which persist anywhere yet (no
// database provisioned) — this is the live equivalent, same pattern as
// every other page in the app.
export default async function HistoryPage() {
  try {
    const [history, playerNameById, managerProfiles] = await Promise.all([
      getLeagueHistory(),
      // Unfiltered name lookup, not getLeaguePlayers() — Ring of Honor
      // entries can reference a player who's since retired or hit free
      // agency, and this page only ever needs their name, not their
      // current market value/keeper economics.
      getAllPlayerNames(),
      getManagerProfiles(),
    ]);

    const managers = [...managerProfiles.values()].sort(
      (a, b) => (a.teamName ?? a.displayName).localeCompare(b.teamName ?? b.displayName)
    );

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
          {managers.map((manager) => (
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

                <div className="mt-3 grid grid-cols-3 gap-x-2 gap-y-2 text-xs">
                  <div>
                    <p className="text-ink/40">Avg Pts / Week</p>
                    <p className="font-medium text-ink">
                      {manager.averagePointsPerWeekAllTime.toFixed(1)}
                    </p>
                  </div>
                  <div>
                    <p className="text-ink/40">PF Rank (All-Time)</p>
                    <p className="font-medium text-ink">
                      #{manager.careerPointsForRank} of {manager.totalManagers}
                    </p>
                  </div>
                  <div>
                    <p className="text-ink/40">Win% Rank (Reg. Season)</p>
                    <p className="font-medium text-ink">
                      #{manager.regularSeasonWinPercentageRank} of {manager.totalManagers}
                    </p>
                  </div>
                </div>

                <div className="mt-3 border-t border-black/5 pt-2">
                  <p className="text-xs text-ink/40">Ring of Honor</p>
                  {manager.ringOfHonorQualifiers.length === 0 ? (
                    <p className="mt-1 text-xs font-medium text-ink">—</p>
                  ) : (
                    <ul className="mt-1 space-y-0.5">
                      {manager.ringOfHonorQualifiers.map((entry) => (
                        <li
                          key={entry.playerId}
                          className="flex items-baseline justify-between gap-2 text-xs"
                        >
                          <span className="truncate text-ink">
                            {playerNameById.get(entry.playerId) ?? entry.playerId}
                          </span>
                          <span className="shrink-0 font-medium text-ink/70">
                            {entry.totalStartingLineupPoints.toFixed(0)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </Card>
            </Link>
          ))}
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
          <LeagueRecordsGrid records={history.records} />
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
