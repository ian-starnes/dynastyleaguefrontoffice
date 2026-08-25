import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { StatTile } from "@/components/ui/StatTile";
import { formatDollarValue } from "@/lib/format";
import { getManagerProfiles } from "@/lib/services/managerProfileService";
import { getRingOfHonor } from "@/lib/services/ringOfHonorService";
import { getAllPlayerNames } from "@/lib/sleeper";

export default async function ManagerProfilePage({
  params,
}: {
  params: Promise<{ ownerId: string }>;
}) {
  const { ownerId } = await params;

  const [profiles, ringOfHonor, nameById] = await Promise.all([
    getManagerProfiles(),
    getRingOfHonor(),
    // Unfiltered lookup, not getPlayers() — a Ring of Honor entry can
    // reference a player who's since retired or hit free agency, which
    // getPlayers()'s roster-eligible filter would silently drop, leaving
    // a raw player_id displayed instead of a name.
    getAllPlayerNames(),
  ]);

  const profile = profiles.get(ownerId);
  if (!profile) notFound();

  const ring = ringOfHonor.filter((entry) => entry.ownerId === ownerId).slice(0, 15);

  return (
    <div>
      <Link href="/history" className="text-sm font-medium text-primary hover:underline">
        ← Back to History
      </Link>

      <div className="mt-4 flex items-center gap-4">
        {profile.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={profile.avatarUrl}
            alt={profile.displayName}
            className="h-16 w-16 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-xl font-semibold text-primary">
            {profile.displayName.slice(0, 1).toUpperCase()}
          </div>
        )}
        <PageHeader
          title={profile.teamName ?? profile.displayName}
          description={`${profile.displayName} · Member since ${profile.memberSinceSeason}`}
        />
      </div>

      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Championships"
          value={profile.championships}
          sublabel={`${profile.runnerUps} runner-up, ${profile.thirdPlaceFinishes} third-place`}
        />
        <StatTile
          label="Best / Avg Finish"
          value={`${profile.bestFinish ?? "—"} / ${profile.averageFinish?.toFixed(1) ?? "—"}`}
        />
        <StatTile
          label="All-Time Record"
          value={`${profile.allTimeWins}-${profile.allTimeLosses}${profile.allTimeTies > 0 ? `-${profile.allTimeTies}` : ""}`}
          sublabel={`${(profile.winningPercentage * 100).toFixed(1)}% win rate`}
        />
        <StatTile
          label="Playoff Record"
          value={`${profile.playoffWins}-${profile.playoffLosses}${profile.playoffTies > 0 ? `-${profile.playoffTies}` : ""}`}
        />
        <StatTile
          label="Avg Points / Week (All-Time)"
          value={profile.averagePointsPerWeekAllTime.toFixed(1)}
        />
        <StatTile
          label="Highest Scoring Week Ever"
          value={profile.highestScoringWeekAllTime?.points.toFixed(1) ?? "—"}
          sublabel={
            profile.highestScoringWeekAllTime
              ? `${profile.highestScoringWeekAllTime.season} wk${profile.highestScoringWeekAllTime.week}`
              : undefined
          }
        />
        <StatTile
          label="Highest Scoring Player Ever"
          value={profile.highestScoringPlayerEver?.points.toFixed(1) ?? "—"}
          sublabel={
            profile.highestScoringPlayerEver
              ? (nameById.get(profile.highestScoringPlayerEver.playerId) ??
                  profile.highestScoringPlayerEver.playerId) +
                ` · ${profile.highestScoringPlayerEver.season} wk${profile.highestScoringPlayerEver.week}`
              : undefined
          }
        />
        <StatTile
          label="Career Points For / Against"
          value={`${profile.careerPointsFor.toFixed(0)} / ${profile.careerPointsAgainst.toFixed(0)}`}
        />
        <StatTile
          label="Longest Win / Loss Streak"
          value={`${profile.longestWinningStreak} / ${profile.longestLosingStreak}`}
        />
        <StatTile
          label="Trades / Waiver Claims"
          value={`${profile.totalTrades} / ${profile.totalWaiverClaims}`}
        />
        <StatTile label="Total FAAB Spent" value={formatDollarValue(profile.totalFaabSpent)} />
        <StatTile
          label="Current Franchise Value"
          value={
            profile.currentFranchiseValue !== null
              ? formatDollarValue(profile.currentFranchiseValue)
              : "—"
          }
          valueClassName={profile.currentFranchiseValue !== null ? "text-gold" : "text-ink"}
        />
      </div>

      <h2 className="mt-10 font-serif text-xl text-primary">Ring of Honor</h2>
      <p className="mt-1 text-sm text-ink/50">
        Production while STARTED for this franchise only — not a player&apos;s whole career.
      </p>
      <Card className="mt-4 divide-y divide-black/5">
        {ring.length === 0 ? (
          <p className="p-8 text-center text-sm text-ink/40">No starts recorded yet.</p>
        ) : (
          ring.map((entry, index) => (
            <div key={entry.playerId} className="flex items-center justify-between p-4">
              <div className="flex items-center gap-4">
                <span className="w-6 text-sm text-ink/40">#{index + 1}</span>
                <div>
                  <p className="font-medium text-ink">
                    {nameById.get(entry.playerId) ?? entry.playerId}
                  </p>
                  <p className="text-xs text-ink/50">
                    {entry.yearsWithFranchise.join(", ")} · {entry.gamesStarted} starts ·{" "}
                    {entry.winsWhileStarting}W · {entry.playoffStarts} playoff starts
                    {entry.championshipStarts > 0
                      ? ` · ${entry.championshipStarts} championship starts`
                      : ""}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-serif text-lg text-gold">
                  {entry.totalStartingLineupPoints.toFixed(1)}
                </p>
                <p className="text-xs text-ink/40">{entry.averagePointsPerStart.toFixed(1)} PPS</p>
              </div>
            </div>
          ))
        )}
      </Card>
    </div>
  );
}
