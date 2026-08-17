import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { TradeBuilder } from "@/components/trades/TradeBuilder";
import { getLeaguePlayers } from "@/lib/league-players";
import { getRosters, getOwners } from "@/lib/sleeper";
import { getFuturePicks } from "@/lib/services/futurePicksService";

// Server Component: fetches everything the Trade Center needs (rosters,
// owners, players, future picks) and hands it to the client-side
// TradeBuilder for the interactive proposal-building UI. Evaluation
// itself runs server-side via app/trades/actions.ts's Server Action,
// through lib/services/tradeCalculatorService.ts — never in the browser.
export default async function TradesPage() {
  try {
    const [players, rosters, owners, picks] = await Promise.all([
      getLeaguePlayers(),
      getRosters(),
      getOwners(),
      getFuturePicks(),
    ]);

    const ownerNameByOwnerId = new Map(
      owners.map((owner) => [owner.user_id, owner.metadata?.team_name ?? owner.display_name])
    );
    const rosterIdByOwnerId = new Map(
      rosters.filter((r) => r.owner_id).map((r) => [r.owner_id as string, r.roster_id])
    );

    const ownerOptions = [...rosterIdByOwnerId.keys()]
      .map((ownerId) => ({ ownerId, ownerName: ownerNameByOwnerId.get(ownerId) ?? "Unknown" }))
      .sort((a, b) => a.ownerName.localeCompare(b.ownerName));

    const rostersByOwnerId: Record<string, ReturnType<typeof buildRosterOption>[]> = {};
    for (const player of players) {
      if (!player.currentOwnerId || player.marketValue === null) continue;
      const list = rostersByOwnerId[player.currentOwnerId] ?? [];
      list.push(buildRosterOption(player));
      rostersByOwnerId[player.currentOwnerId] = list;
    }
    for (const list of Object.values(rostersByOwnerId)) {
      list.sort((a, b) => (b.marketValue ?? 0) - (a.marketValue ?? 0));
    }

    // Limited to the next 2 draft years to keep the picker manageable —
    // getFuturePicks() itself still projects 4 years (2026-2029) for
    // Franchise Value purposes; the Trade Center just doesn't need to
    // show every one of them in a checkbox list.
    const nearestSeasons = [...new Set(picks.map((p) => p.season))].sort().slice(0, 2);
    const picksByOwnerId: Record<string, { season: number; round: number }[]> = {};
    for (const pick of picks) {
      if (!nearestSeasons.includes(pick.season)) continue;
      const ownerId = [...rosterIdByOwnerId.entries()].find(
        ([, rosterId]) => rosterId === pick.currentOwnerRosterId
      )?.[0];
      if (!ownerId) continue;
      const list = picksByOwnerId[ownerId] ?? [];
      list.push({ season: pick.season, round: pick.round });
      picksByOwnerId[ownerId] = list;
    }
    for (const list of Object.values(picksByOwnerId)) {
      list.sort((a, b) => a.season - b.season || a.round - b.round);
    }

    return (
      <div>
        <PageHeader
          title="Trades"
          description="Propose a trade and see its real multi-year impact on both franchises."
        />
        <div className="mt-8">
          <TradeBuilder
            owners={ownerOptions}
            rostersByOwnerId={rostersByOwnerId}
            picksByOwnerId={picksByOwnerId}
          />
        </div>
      </div>
    );
  } catch (error) {
    return (
      <div>
        <PageHeader
          title="Trades"
          description="Propose a trade and see its real multi-year impact on both franchises."
        />
        <Card className="mt-8 p-8">
          <p className="text-sm text-ink/60">
            Couldn&apos;t load trade data
            {error instanceof Error ? `: ${error.message}` : "."}
          </p>
        </Card>
      </div>
    );
  }
}

function buildRosterOption(player: {
  nflPlayer: { id: string; fullName: string; position: string; nflTeam: string };
  marketValue: number | null;
}) {
  return {
    playerId: player.nflPlayer.id,
    fullName: player.nflPlayer.fullName,
    position: player.nflPlayer.position,
    nflTeam: player.nflPlayer.nflTeam,
    marketValue: player.marketValue,
  };
}
