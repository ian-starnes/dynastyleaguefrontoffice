import type { LeaguePlayer } from "@/lib/league-players";

const OWNER_FILTER_PREFIX = "owner:";

export type AssetFilterId =
  | "all"
  | "QB"
  | "RB"
  | "WR"
  | "TE"
  | "owned"
  | "free-agent"
  | "my-team"
  | "expiring"
  | `${typeof OWNER_FILTER_PREFIX}${string}`;

export const ASSET_FILTERS: { id: AssetFilterId; label: string }[] = [
  { id: "all", label: "All" },
  { id: "QB", label: "QB" },
  { id: "RB", label: "RB" },
  { id: "WR", label: "WR" },
  { id: "TE", label: "TE" },
  { id: "owned", label: "Owned" },
  { id: "free-agent", label: "Free Agent" },
  { id: "my-team", label: "My Team" },
  { id: "expiring", label: "Expiring" },
];

export function ownerFilterId(ownerId: string): AssetFilterId {
  return `${OWNER_FILTER_PREFIX}${ownerId}`;
}

export function ownerIdFromFilter(filterId: AssetFilterId): string | null {
  return filterId.startsWith(OWNER_FILTER_PREFIX)
    ? filterId.slice(OWNER_FILTER_PREFIX.length)
    : null;
}

export function matchesAssetFilter(
  player: LeaguePlayer,
  filterId: AssetFilterId,
  myOwnerId: string | null
): boolean {
  const clickedOwnerId = ownerIdFromFilter(filterId);
  if (clickedOwnerId !== null) {
    return player.currentOwnerId === clickedOwnerId;
  }

  switch (filterId) {
    case "all":
      return true;
    case "QB":
    case "RB":
    case "WR":
    case "TE":
      return player.nflPlayer.position === filterId;
    case "owned":
      return player.currentOwnerId !== null;
    case "free-agent":
      return player.currentOwnerId === null;
    case "my-team":
      return myOwnerId !== null && player.currentOwnerId === myOwnerId;
    case "expiring":
      // Contract's last keeper year — expires (returns to the draft pool) after this season.
      return player.currentOwnerId !== null && player.keeperYearsRemaining <= 1;
    default:
      return false;
  }
}
