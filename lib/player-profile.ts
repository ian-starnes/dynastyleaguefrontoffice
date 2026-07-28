import {
  getRosters,
  getOwners,
  getAllTransactions,
  getDrafts,
  getDraftPicks,
  type SleeperDraftPick,
} from "./sleeper";
import { getLeaguePlayer, type LeaguePlayer } from "./league-players";

export type PlayerTransactionEvent = {
  id: string;
  type: string; // "trade" | "free_agent" | "waiver"
  createdAt: number;
  summary: string;
};

export type PlayerDraftPick = {
  season: string;
  round: number;
  pickNumber: number;
  draftedByOwnerName: string | null;
};

export type PlayerProfile = {
  player: LeaguePlayer;
  /** Most recent first. */
  transactions: PlayerTransactionEvent[];
  draftPick: PlayerDraftPick | null;
};

/**
 * Assembles everything the player profile page needs — the enriched
 * LeaguePlayer plus this league's transaction and draft history for that
 * one player. Mirrors lib/league-players.ts: Sleeper wrapping stays in
 * lib/sleeper, this file is where it gets composed into something a page
 * can render directly.
 */
export async function getPlayerProfile(
  playerId: string
): Promise<PlayerProfile | null> {
  const player = await getLeaguePlayer(playerId);
  if (!player) return null;

  const [allTransactions, rosters, owners, drafts] = await Promise.all([
    getAllTransactions().catch((error: unknown) => {
      console.error(
        "Sleeper transactions fetch failed, showing no history:",
        error
      );
      return [];
    }),
    getRosters(),
    getOwners(),
    getDrafts().catch((error: unknown) => {
      console.error("Sleeper drafts fetch failed:", error);
      return [];
    }),
  ]);

  const ownerNameByUserId = new Map(
    owners.map((owner) => [
      owner.user_id,
      owner.metadata?.team_name ?? owner.display_name,
    ])
  );
  const ownerNameByRosterId = new Map(
    rosters.map((roster) => [
      roster.roster_id,
      roster.owner_id ? ownerNameByUserId.get(roster.owner_id) ?? null : null,
    ])
  );

  const transactions = allTransactions
    .filter(
      (tx) =>
        (tx.adds && playerId in tx.adds) || (tx.drops && playerId in tx.drops)
    )
    .map((tx): PlayerTransactionEvent => {
      const parts: string[] = [];

      if (tx.drops && playerId in tx.drops) {
        const ownerName =
          ownerNameByRosterId.get(tx.drops[playerId]) ?? "an unknown team";
        parts.push(`Dropped by ${ownerName}`);
      }
      if (tx.adds && playerId in tx.adds) {
        const ownerName =
          ownerNameByRosterId.get(tx.adds[playerId]) ?? "an unknown team";
        parts.push(`Added by ${ownerName}`);
      }

      return {
        id: tx.transaction_id,
        type: tx.type,
        createdAt: tx.created,
        summary: parts.join(", "),
      };
    })
    .sort((a, b) => b.createdAt - a.createdAt);

  const draftPicksByDraft = await Promise.all(
    drafts.map((draft) =>
      getDraftPicks(draft.draft_id)
        .then((picks) => ({ draft, picks }))
        .catch((error: unknown) => {
          console.error(
            `Sleeper draft picks fetch failed for draft ${draft.draft_id}:`,
            error
          );
          return { draft, picks: [] as SleeperDraftPick[] };
        })
    )
  );

  let draftPick: PlayerDraftPick | null = null;
  for (const { draft, picks } of draftPicksByDraft) {
    const pick = picks.find((p) => p.player_id === playerId);
    if (pick) {
      draftPick = {
        season: draft.season,
        round: pick.round,
        pickNumber: pick.pick_no,
        draftedByOwnerName: ownerNameByRosterId.get(pick.roster_id) ?? null,
      };
      break;
    }
  }

  return { player, transactions, draftPick };
}
