"use client";

import Link from "next/link";
import { useEffect } from "react";
import type { LeaguePlayer } from "@/lib/league-players";
import { PlayerHeadshot } from "./PlayerHeadshot";
import { formatDollarValue } from "@/lib/format";

type PlayerDetailDrawerProps = {
  player: LeaguePlayer | null;
  onClose: () => void;
};

/**
 * Quick-glance economics for one asset without leaving the table (filters
 * and scroll position stay intact). Deliberately minimal — the deep-dive
 * destination (transaction history, draft history, eventually a trade
 * analyzer) is the full profile page at /assets/[playerId], linked below.
 */
export function PlayerDetailDrawer({
  player,
  onClose,
}: PlayerDetailDrawerProps) {
  useEffect(() => {
    if (!player) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [player, onClose]);

  if (!player) return null;

  const { nflPlayer } = player;

  return (
    <div className="fixed inset-0 z-30">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/20"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${nflPlayer.fullName} details`}
        className="absolute inset-y-0 right-0 flex w-full max-w-sm flex-col overflow-y-auto bg-background p-6 shadow-2xl"
      >
        <button
          type="button"
          onClick={onClose}
          className="self-end text-sm font-medium text-ink/50 hover:text-primary"
        >
          Close ×
        </button>

        <div className="mt-4 flex items-center gap-4">
          <PlayerHeadshot
            playerId={nflPlayer.id}
            name={nflPlayer.fullName}
            size={56}
          />
          <div>
            <h2 className="font-serif text-2xl text-primary">
              {nflPlayer.fullName}
            </h2>
            <p className="mt-1 text-sm text-ink/60">
              {nflPlayer.position} · {nflPlayer.nflTeam} ·{" "}
              {player.currentOwnerName ?? (
                <span className="text-ink/30">Free agent</span>
              )}
            </p>
          </div>
        </div>

        <dl className="mt-8 space-y-5">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-ink/50">
              Market Value
            </dt>
            <dd
              className={`mt-1 text-xl ${
                player.marketValue !== null ? "text-blue-800" : "text-ink/30"
              }`}
            >
              {player.marketValue !== null
                ? formatDollarValue(player.marketValue)
                : "—"}
            </dd>
          </div>

          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-ink/50">
              Keeper Cost
            </dt>
            <dd className="mt-1 text-xl text-ink">
              {formatDollarValue(player.keeperCost)}
            </dd>
          </div>

          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-ink/50">
              Keeper Surplus
            </dt>
            <dd
              className={`mt-1 text-xl ${
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
            </dd>
          </div>

          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-ink/50">
              Years Remaining
            </dt>
            <dd className="mt-1 text-xl text-ink">
              {player.keeperYearsRemaining}
            </dd>
          </div>

          <div className="border-t border-black/10 pt-5">
            <dt className="text-xs font-medium uppercase tracking-wide text-ink/50">
              Asset Value
            </dt>
            <dd
              className={`mt-1 text-3xl font-semibold ${
                player.assetValue !== null ? "text-gold" : "text-ink/30"
              }`}
            >
              {player.assetValue !== null
                ? formatDollarValue(player.assetValue)
                : "—"}
            </dd>
          </div>
        </dl>

        <Link
          href={`/assets/${nflPlayer.id}`}
          className="mt-8 text-sm font-medium text-primary hover:underline"
        >
          View full profile →
        </Link>
      </div>
    </div>
  );
}
