import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { StatTile } from "@/components/ui/StatTile";
import { PlayerHeadshot } from "@/components/assets/PlayerHeadshot";
import { formatDollarValue } from "@/lib/format";
import { getFrontOfficeSummary } from "@/lib/services/frontOfficeService";
import { getLeaguePlayers } from "@/lib/league-players";

export default async function TeamDetailPage({
  params,
}: {
  params: Promise<{ ownerId: string }>;
}) {
  const { ownerId } = await params;

  const [summary, players] = await Promise.all([
    getFrontOfficeSummary(ownerId),
    getLeaguePlayers(),
  ]);

  if (!summary) notFound();

  const roster = players
    .filter((p) => p.currentOwnerId === ownerId)
    .sort((a, b) => (b.assetValue ?? 0) - (a.assetValue ?? 0));

  return (
    <div>
      <Link href="/teams" className="text-sm font-medium text-primary hover:underline">
        ← Back to Teams
      </Link>

      <div className="mt-4">
        <PageHeader
          title={summary.ownerName ?? "Franchise"}
          description={`Franchise Value rank #${summary.franchiseValueRank} of ${summary.totalFranchises}`}
        />
      </div>

      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Franchise Value"
          value={formatDollarValue(summary.franchiseValue)}
        />
        <StatTile
          label="Roster Asset Value"
          value={formatDollarValue(summary.rosterAssetValue)}
          valueClassName="text-gold"
        />
        <StatTile
          label="Future Draft/Auction Capital"
          value={formatDollarValue(summary.futurePickValue)}
        />
        <StatTile
          label="Total Keeper Surplus"
          value={`${summary.totalKeeperSurplus >= 0 ? "+" : ""}${formatDollarValue(summary.totalKeeperSurplus)}`}
          valueClassName={summary.totalKeeperSurplus >= 0 ? "text-primary" : "text-red-700"}
        />
      </div>

      <h2 className="mt-10 font-serif text-xl text-primary">Future Auction Budget</h2>
      <div className="mt-4 grid gap-6 sm:grid-cols-3">
        {summary.projectedAuctionBudgetBySeason.map((entry) => (
          <StatTile
            key={entry.season}
            label={`${entry.season}`}
            value={formatDollarValue(entry.value)}
          />
        ))}
      </div>

      <h2 className="mt-10 font-serif text-xl text-primary">Current Roster</h2>
      <Card className="mt-4 divide-y divide-black/5">
        {roster.length === 0 ? (
          <p className="p-6 text-center text-sm text-ink/40">No rostered players.</p>
        ) : (
          roster.map((player) => (
            <Link
              key={player.nflPlayer.id}
              href={`/assets/${player.nflPlayer.id}`}
              className="flex items-center justify-between gap-3 p-4 hover:bg-black/[0.02]"
            >
              <div className="flex min-w-0 items-center gap-3">
                <PlayerHeadshot playerId={player.nflPlayer.id} name={player.nflPlayer.fullName} size={36} />
                <div className="min-w-0">
                  <p className="truncate font-medium text-ink">{player.nflPlayer.fullName}</p>
                  <p className="text-xs text-ink/50">
                    {player.nflPlayer.position} · {player.nflPlayer.nflTeam}
                  </p>
                </div>
              </div>
              {/* Market Value/Keeper Cost/Years Remaining are secondary
                  detail — hidden below sm so the row never has to
                  squeeze 5 numeric columns into a narrow viewport (this
                  clipped unreadably before). Keeper Surplus + Asset
                  Value stay visible everywhere as the two numbers that
                  actually matter at a glance; the rest is one tap away
                  on the player's own Asset page. */}
              <div className="flex shrink-0 items-center gap-3 text-sm sm:gap-6">
                <span className="hidden w-14 text-right text-ink/60 sm:inline">
                  {player.marketValue !== null ? formatDollarValue(player.marketValue) : "—"}
                </span>
                <span className="hidden w-14 text-right text-ink/60 sm:inline">
                  {formatDollarValue(player.keeperCost)}
                </span>
                <span
                  className={`w-14 text-right sm:w-16 ${
                    player.keeperSurplus !== null && player.keeperSurplus >= 0
                      ? "text-primary"
                      : "text-red-700"
                  }`}
                >
                  {player.keeperSurplus !== null
                    ? `${player.keeperSurplus >= 0 ? "+" : ""}${formatDollarValue(player.keeperSurplus)}`
                    : "—"}
                </span>
                <span className="hidden w-8 text-right text-ink/40 sm:inline">
                  {player.keeperYearsRemaining}y
                </span>
                <span className="w-14 text-right font-serif text-gold sm:w-16">
                  {player.assetValue !== null ? formatDollarValue(player.assetValue) : "—"}
                </span>
              </div>
            </Link>
          ))
        )}
      </Card>
      <p className="mt-2 text-xs text-ink/40">
        <span className="sm:hidden">Keeper Surplus · Asset Value</span>
        <span className="hidden sm:inline">
          Market Value · Keeper Cost · Keeper Surplus · Years Remaining · Asset Value
        </span>
      </p>

      <h2 className="mt-10 font-serif text-xl text-primary">Recent Transactions</h2>
      <Card className="mt-4 divide-y divide-black/5">
        {summary.recentMovement.length === 0 ? (
          <p className="p-6 text-center text-sm text-ink/40">No recent moves.</p>
        ) : (
          summary.recentMovement.map((movement) => (
            <div key={movement.transactionId} className="p-4">
              <p className="text-sm text-ink">{movement.summary}</p>
              <p className="mt-0.5 text-xs text-ink/40">
                {new Date(movement.createdAt).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })}
              </p>
            </div>
          ))
        )}
      </Card>

      <p className="mt-6 text-sm text-ink/50">
        For championships, career record, and Ring of Honor, see this owner&apos;s{" "}
        <Link href={`/history/managers/${ownerId}`} className="font-medium text-primary hover:underline">
          Manager Profile →
        </Link>
      </p>
    </div>
  );
}
