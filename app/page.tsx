import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatTile } from "@/components/ui/StatTile";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { PlayerHeadshot } from "@/components/assets/PlayerHeadshot";
import { getMyOwnerId } from "@/lib/sleeper";
import { getFrontOfficeSummary, type RecentMovement } from "@/lib/services/frontOfficeService";
import { formatDollarValue } from "@/lib/format";

const PLATFORM_PILLARS = [
  "Franchise Value",
  "Keeper Surplus",
  "Auction Budget",
  "Contract Timeline",
  "League Intelligence",
];

/**
 * Orientation hero shown when NEXT_PUBLIC_SLEEPER_MY_OWNER_ID isn't
 * configured (or doesn't match a current franchise) — Front Office is
 * inherently "my franchise," so without knowing who "I" am there's
 * nothing real to personalize here.
 */
function MarketingHero() {
  return (
    <section className="flex min-h-[70vh] flex-col justify-center">
      <p className="font-serif text-sm tracking-[0.3em] text-gold">DLFO</p>
      <h1 className="mt-4 max-w-2xl font-serif text-5xl leading-[1.05] text-primary sm:text-6xl">
        Run Your Franchise.
      </h1>
      <p className="mt-6 max-w-xl text-lg italic text-ink/60">
        &ldquo;The operating system for keeper and dynasty fantasy
        football.&rdquo;
      </p>
      <ul className="mt-10 flex max-w-2xl flex-wrap items-center gap-x-4 gap-y-2 border-t border-gold/30 pt-6">
        {PLATFORM_PILLARS.map((pillar, index) => (
          <li key={pillar} className="flex items-center gap-4">
            {index > 0 ? (
              <span aria-hidden className="h-1 w-1 rounded-full bg-gold" />
            ) : null}
            <span className="text-xs font-medium uppercase tracking-[0.12em] text-primary/70">
              {pillar}
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-10 flex flex-wrap items-center gap-4">
        <Button variant="primary" href="/league">
          Enter Front Office
        </Button>
        <Button variant="secondary" href="/settings">
          Learn More
        </Button>
      </div>
    </section>
  );
}

function MovementList({ items, emptyMessage }: { items: RecentMovement[]; emptyMessage: string }) {
  if (items.length === 0) {
    return <p className="p-6 text-center text-sm text-ink/40">{emptyMessage}</p>;
  }
  return (
    <>
      {items.map((movement) => (
        <div key={movement.transactionId} className="p-4">
          <p className="text-sm text-ink">{movement.summary}</p>
          <p className="mt-0.5 text-xs text-ink/40">
            {new Date(movement.createdAt).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
            })}
          </p>
        </div>
      ))}
    </>
  );
}

export default async function HomePage() {
  const myOwnerId = getMyOwnerId();
  if (!myOwnerId) return <MarketingHero />;

  let summary;
  try {
    summary = await getFrontOfficeSummary(myOwnerId);
  } catch (error) {
    return (
      <div>
        <PageHeader title="Front Office" description="How strong is my franchise?" />
        <Card className="mt-8 p-8">
          <p className="text-sm text-ink/60">
            Couldn&apos;t load your franchise
            {error instanceof Error ? `: ${error.message}` : "."}
          </p>
        </Card>
      </div>
    );
  }

  if (!summary) return <MarketingHero />;

  return (
    <div>
      <PageHeader
        title="Front Office"
        description={`Welcome back, ${summary.ownerName ?? "GM"}.`}
      />

      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Franchise Value"
          value={formatDollarValue(summary.franchiseValue)}
          valueClassName="text-gold"
          sublabel={`Rank #${summary.franchiseValueRank} of ${summary.totalFranchises}`}
        />
        <StatTile
          label="Current Season Rank"
          value={summary.currentSeasonRank !== null ? `#${summary.currentSeasonRank}` : "—"}
          sublabel={summary.currentSeasonRank === null ? "Season hasn't started" : undefined}
        />
        <StatTile
          label="Roster Market Value"
          value={formatDollarValue(summary.rosterMarketValue)}
        />
        <StatTile
          label="Total Keeper Surplus"
          value={`${summary.totalKeeperSurplus >= 0 ? "+" : ""}${formatDollarValue(summary.totalKeeperSurplus)}`}
          valueClassName={summary.totalKeeperSurplus >= 0 ? "text-primary" : "text-red-700"}
        />
      </div>

      <h2 className="mt-10 font-serif text-xl text-primary">Future Draft/Auction Capital</h2>
      <div className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Total (All Years)" value={formatDollarValue(summary.futurePickValue)} />
        {summary.projectedAuctionBudgetBySeason.map((entry) => (
          <StatTile
            key={entry.season}
            label={`${entry.season} Auction Budget`}
            value={formatDollarValue(entry.value)}
          />
        ))}
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-2">
        <div>
          <h2 className="font-serif text-xl text-primary">Most Valuable Assets</h2>
          <Card className="mt-4 divide-y divide-black/5">
            {summary.mostValuableAssets.length === 0 ? (
              <p className="p-6 text-center text-sm text-ink/40">No assets on your roster yet.</p>
            ) : (
              summary.mostValuableAssets.map((player) => (
                <Link
                  key={player.nflPlayer.id}
                  href={`/assets/${player.nflPlayer.id}`}
                  className="flex items-center justify-between p-4 hover:bg-black/[0.02]"
                >
                  <div className="flex items-center gap-3">
                    <PlayerHeadshot
                      playerId={player.nflPlayer.id}
                      name={player.nflPlayer.fullName}
                      size={36}
                    />
                    <div>
                      <p className="font-medium text-ink">{player.nflPlayer.fullName}</p>
                      <p className="text-xs text-ink/50">
                        {player.nflPlayer.position} · {player.nflPlayer.nflTeam}
                      </p>
                    </div>
                  </div>
                  <span className="font-serif text-gold">
                    {formatDollarValue(player.assetValue ?? 0)}
                  </span>
                </Link>
              ))
            )}
          </Card>

          <h2 className="mt-8 font-serif text-xl text-primary">Expiring Contracts</h2>
          <Card className="mt-4 divide-y divide-black/5">
            {summary.expiringContracts.length === 0 ? (
              <p className="p-6 text-center text-sm text-ink/40">
                No contracts expiring within a year.
              </p>
            ) : (
              summary.expiringContracts.map((player) => (
                <Link
                  key={player.nflPlayer.id}
                  href={`/assets/${player.nflPlayer.id}`}
                  className="flex items-center justify-between p-4 hover:bg-black/[0.02]"
                >
                  <span className="text-sm text-ink">{player.nflPlayer.fullName}</span>
                  <span className="text-xs text-ink/50">
                    {player.keeperYearsRemaining} yr{player.keeperYearsRemaining !== 1 ? "s" : ""} left
                  </span>
                </Link>
              ))
            )}
          </Card>
        </div>

        <div>
          <h2 className="font-serif text-xl text-primary">Recent Player Movement</h2>
          <Card className="mt-4 divide-y divide-black/5">
            <MovementList items={summary.recentMovement} emptyMessage="No recent moves for your team." />
          </Card>

          <h2 className="mt-8 font-serif text-xl text-primary">League Activity</h2>
          <Card className="mt-4 divide-y divide-black/5">
            <MovementList items={summary.leagueActivity} emptyMessage="No recent league activity." />
          </Card>
        </div>
      </div>
    </div>
  );
}
