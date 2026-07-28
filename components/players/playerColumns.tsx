import Link from "next/link";
import type { Column } from "@/components/ui/DataTable";
import type { LeaguePlayer } from "@/lib/league-players";
import { PlayerHeadshot } from "./PlayerHeadshot";
import { formatCompactValue } from "./format";

type PlayerColumnsOptions = {
  onOwnerClick: (ownerId: string) => void;
};

/**
 * Factory rather than a static array because the "Current Owner" column
 * needs to call back into the page's filter state. Called from
 * PlayersExplorer via useMemo, keyed on the (also memoized) onOwnerClick,
 * so the returned array stays referentially stable across re-renders.
 */
export function createPlayerColumns({
  onOwnerClick,
}: PlayerColumnsOptions): Column<LeaguePlayer>[] {
  return [
    {
      id: "player",
      header: "Player",
      sortable: true,
      sortValue: (row) => row.nflPlayer.fullName,
      render: (row) => (
        <Link
          href={`/players/${row.nflPlayer.id}`}
          className="group flex items-center gap-3"
        >
          <PlayerHeadshot
            playerId={row.nflPlayer.id}
            name={row.nflPlayer.fullName}
          />
          <span className="font-medium text-ink group-hover:text-primary group-hover:underline">
            {row.nflPlayer.fullName}
          </span>
        </Link>
      ),
    },
    {
      id: "position",
      header: "Position",
      sortable: true,
      sortValue: (row) => row.nflPlayer.position,
      render: (row) => row.nflPlayer.position,
    },
    {
      id: "nflTeam",
      header: "NFL Team",
      sortable: true,
      sortValue: (row) => row.nflPlayer.nflTeam,
      render: (row) => row.nflPlayer.nflTeam,
    },
    {
      id: "owner",
      header: "Current Owner",
      sortable: true,
      sortValue: (row) => row.currentOwnerName ?? "",
      render: (row) =>
        row.currentOwnerId && row.currentOwnerName ? (
          <button
            type="button"
            onClick={() => onOwnerClick(row.currentOwnerId!)}
            className="underline-offset-2 hover:text-primary hover:underline"
          >
            {row.currentOwnerName}
          </button>
        ) : (
          <span className="text-ink/30">Free agent</span>
        ),
    },
    {
      id: "fantasyCalc",
      header: "FantasyCalc",
      sortable: true,
      // Sort on the real number; unmatched players sort to the bottom of
      // the default (descending) view. -Infinity is only for ordering,
      // never shown.
      sortValue: (row) => row.fantasyCalcValue ?? Number.NEGATIVE_INFINITY,
      render: (row) =>
        row.fantasyCalcValue !== null ? (
          formatCompactValue(row.fantasyCalcValue)
        ) : (
          <span className="text-ink/30">—</span>
        ),
    },
  ];
}
