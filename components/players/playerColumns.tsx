import type { Column } from "@/components/ui/DataTable";
import type { LeaguePlayer } from "@/lib/league-players";

export const PLAYER_COLUMNS: Column<LeaguePlayer>[] = [
  {
    id: "player",
    header: "Player",
    sortable: true,
    sortValue: (row) => row.nflPlayer.fullName,
    render: (row) => (
      <span className="font-medium text-ink">{row.nflPlayer.fullName}</span>
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
      row.currentOwnerName ?? <span className="text-ink/30">Free agent</span>,
  },
  {
    id: "fantasyValue",
    header: "Fantasy Value",
    sortable: true,
    sortValue: (row) => row.fantasyValue,
    render: (row) => row.fantasyValue.toFixed(1),
  },
  {
    id: "fantasyCalc",
    header: "FantasyCalc",
    sortable: true,
    // Unmatched players sort to the bottom of the default (descending)
    // view; -Infinity is only for ordering, never shown.
    sortValue: (row) => row.fantasyCalcValue ?? Number.NEGATIVE_INFINITY,
    render: (row) =>
      row.fantasyCalcValue !== null ? (
        row.fantasyCalcValue.toLocaleString()
      ) : (
        <span className="text-ink/30">—</span>
      ),
  },
];
