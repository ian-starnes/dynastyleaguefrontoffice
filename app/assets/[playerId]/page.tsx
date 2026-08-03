import Link from "next/link";
import { notFound } from "next/navigation";
import { getPlayerProfile, type PlayerProfile } from "@/lib/player-profile";
import { Card } from "@/components/ui/Card";
import { Tooltip } from "@/components/ui/Tooltip";
import { PlayerHeadshot } from "@/components/assets/PlayerHeadshot";
import { formatDollarValue } from "@/lib/format";

// Genuinely not implemented yet — no subsystem exists for any of these.
// Listed as labels only; never a fabricated number. (Market Value, Keeper
// Cost, Keeper Surplus, Years Remaining, and Asset Value all moved out of
// this list once they became real — even placeholder-backed — fields, all
// in auction dollars.)
const COMING_SOON_FEATURES = ["Auction Value", "PFF Grade", "Trade Analyzer"];

function BackLink() {
  return (
    <Link
      href="/assets"
      className="text-sm font-medium text-ink/50 hover:text-primary"
    >
      ← Assets
    </Link>
  );
}

function formatEventDate(epochMs: number): string {
  return new Date(epochMs).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function PlayerProfilePage({
  params,
}: {
  params: Promise<{ playerId: string }>;
}) {
  const { playerId } = await params;

  let profile: PlayerProfile | null;
  try {
    profile = await getPlayerProfile(playerId);
  } catch (error) {
    return (
      <div>
        <BackLink />
        <Card className="mt-6 p-8">
          <p className="text-sm text-ink/60">
            Couldn&apos;t load this player&apos;s profile
            {error instanceof Error ? `: ${error.message}` : "."}
          </p>
        </Card>
      </div>
    );
  }

  if (!profile) {
    notFound();
  }

  const { player, transactions, draftPick } = profile;

  return (
    <div>
      <BackLink />

      <div className="mt-6 flex items-center gap-4">
        <PlayerHeadshot
          playerId={player.nflPlayer.id}
          name={player.nflPlayer.fullName}
          size={72}
        />
        <div>
          <h1 className="font-serif text-3xl text-primary">
            {player.nflPlayer.fullName}
          </h1>
          <p className="mt-1 text-sm text-ink/60">
            {player.nflPlayer.position} · {player.nflPlayer.nflTeam} ·{" "}
            {player.currentOwnerName ?? (
              <span className="text-ink/30">Free agent</span>
            )}
          </p>
        </div>
      </div>

      {/* Asset Value leads — DLFO's primary ranking, in auction dollars. */}
      <Card className="mt-8 p-6">
        <p className="text-xs font-medium uppercase tracking-wide text-ink/50">
          Asset Value
        </p>
        {player.assetValue !== null && player.keeperSurplus !== null ? (
          <Tooltip
            content={
              <div className="space-y-1">
                <p>{formatDollarValue(player.marketValue!)} Market Value</p>
                <p>
                  {player.keeperSurplus >= 0 ? "+" : ""}
                  {formatDollarValue(player.keeperSurplus)} Keeper Surplus
                </p>
                <div className="my-1 border-t border-background/20" />
                <p className="font-semibold">
                  {formatDollarValue(player.assetValue)} Asset Value
                </p>
              </div>
            }
          >
            <p className="mt-2 inline-block cursor-default font-serif text-5xl font-semibold text-gold">
              {formatDollarValue(player.assetValue)}
            </p>
          </Tooltip>
        ) : (
          <p className="mt-2 font-serif text-5xl font-semibold text-ink/30">
            —
          </p>
        )}
      </Card>

      <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="p-6">
          <p className="text-xs font-medium uppercase tracking-wide text-ink/50">
            Market Value
          </p>
          <p
            className={`mt-2 font-serif text-3xl ${
              player.marketValue !== null ? "text-blue-800" : "text-ink/30"
            }`}
          >
            {player.marketValue !== null
              ? formatDollarValue(player.marketValue)
              : "—"}
          </p>
        </Card>

        <Card className="p-6">
          <p className="text-xs font-medium uppercase tracking-wide text-ink/50">
            Keeper Cost
          </p>
          <p className="mt-2 font-serif text-3xl text-ink">
            {formatDollarValue(player.keeperCost)}
          </p>
        </Card>

        <Card className="p-6">
          <p className="text-xs font-medium uppercase tracking-wide text-ink/50">
            Keeper Surplus
          </p>
          <p
            className={`mt-2 font-serif text-3xl ${
              player.keeperSurplus === null
                ? "text-ink/30"
                : player.keeperSurplus >= 0
                  ? "text-primary"
                  : "text-red-700"
            }`}
          >
            {player.keeperSurplus !== null
              ? `${player.keeperSurplus >= 0 ? "+" : ""}${formatDollarValue(player.keeperSurplus)}`
              : "—"}
          </p>
        </Card>

        <Card className="p-6">
          <p className="text-xs font-medium uppercase tracking-wide text-ink/50">
            Years Remaining
          </p>
          <p className="mt-2 font-serif text-3xl text-ink">
            {player.keeperYearsRemaining}
          </p>
        </Card>

        <Card className="p-6">
          <p className="text-xs font-medium uppercase tracking-wide text-ink/50">
            FantasyPros ECR
          </p>
          <p className="mt-2 font-serif text-3xl text-ink/30">—</p>
          <p className="mt-2 text-xs text-ink/40">
            Not yet available — requires a licensed FantasyPros API key.
          </p>
        </Card>
      </div>

      <Card className="mt-6 p-6">
        <p className="text-xs font-medium uppercase tracking-wide text-ink/50">
          Coming Soon
        </p>
        <ul className="mt-3 flex flex-wrap gap-2">
          {COMING_SOON_FEATURES.map((feature) => (
            <li
              key={feature}
              className="rounded-full border border-black/10 px-3 py-1 text-xs text-ink/50"
            >
              {feature}
            </li>
          ))}
        </ul>
      </Card>

      <Card className="mt-6 p-6">
        <p className="text-xs font-medium uppercase tracking-wide text-ink/50">
          Transaction History
        </p>
        {transactions.length > 0 ? (
          <ul className="mt-3 divide-y divide-black/5">
            {transactions.map((tx) => (
              <li
                key={tx.id}
                className="flex items-center justify-between gap-4 py-3 text-sm"
              >
                <span className="text-ink/70">{tx.summary}</span>
                <span className="shrink-0 text-xs text-ink/40">
                  {formatEventDate(tx.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-ink/40">No transactions found.</p>
        )}
      </Card>

      <Card className="mt-6 p-6">
        <p className="text-xs font-medium uppercase tracking-wide text-ink/50">
          Draft History
        </p>
        {draftPick ? (
          <p className="mt-3 text-sm text-ink/70">
            {draftPick.season} · Round {draftPick.round}, Pick{" "}
            {draftPick.pickNumber}
            {draftPick.draftedByOwnerName
              ? ` — drafted by ${draftPick.draftedByOwnerName}`
              : ""}
          </p>
        ) : (
          <p className="mt-3 text-sm text-ink/40">
            Not part of a tracked draft.
          </p>
        )}
      </Card>
    </div>
  );
}
