import type { Column } from "@/components/ui/DataTable";
import { Tooltip } from "@/components/ui/Tooltip";
import type { LeaguePlayer } from "@/lib/league-players";
import { PlayerHeadshot } from "./PlayerHeadshot";
import { formatDollarValue } from "@/lib/format";

type AssetColumnsOptions = {
  onOwnerClick: (ownerId: string) => void;
  onPlayerClick: (player: LeaguePlayer) => void;
};

function AssetValueBreakdown({ player }: { player: LeaguePlayer }) {
  if (player.marketValue === null || player.keeperSurplus === null) {
    return <span>Not enough data to break this down.</span>;
  }

  const surplusSign = player.keeperSurplus >= 0 ? "+" : "";

  return (
    <div className="space-y-1">
      <p className="font-semibold uppercase tracking-wide text-gold">
        Asset Value
      </p>
      <p>{formatDollarValue(player.marketValue)} Market Value</p>
      <p>
        {surplusSign}
        {formatDollarValue(player.keeperSurplus)} Keeper Surplus
      </p>
      <div className="my-1 border-t border-background/20" />
      <p className="font-semibold">
        {formatDollarValue(player.assetValue!)} Asset Value
      </p>
    </div>
  );
}

/**
 * Factory rather than a static array — "Current Owner" needs to call back
 * into the page's filter state, and "Player" now opens the detail drawer
 * instead of navigating away. Called from AssetsExplorer via useMemo,
 * keyed on the (also memoized) callbacks, so the returned array stays
 * referentially stable across re-renders.
 *
 * Deliberately no "FantasyCalc" column here — it's hidden by default per
 * the valuation pivot (it's an input to Market Value now, not the value
 * itself). The field still lives on LeaguePlayer (row.fantasyCalc) for
 * anyone who needs it later; this is just where it's excluded from view.
 */
export function createAssetColumns({
  onOwnerClick,
  onPlayerClick,
}: AssetColumnsOptions): Column<LeaguePlayer>[] {
  return [
    {
      id: "player",
      header: "Player",
      sortable: true,
      sortValue: (row) => row.nflPlayer.fullName,
      render: (row) => (
        <button
          type="button"
          onClick={() => onPlayerClick(row)}
          className="group flex items-center gap-3 text-left"
        >
          <PlayerHeadshot
            playerId={row.nflPlayer.id}
            name={row.nflPlayer.fullName}
          />
          <span className="font-medium text-ink group-hover:text-primary group-hover:underline">
            {row.nflPlayer.fullName}
          </span>
        </button>
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
      id: "marketValue",
      header: "Market Value",
      sortable: true,
      // "How good is the player?" — a restrained blue, distinct from the
      // contract (green/red) and franchise (gold) figures next to it.
      // Estimated auction dollars, not FantasyCalc points.
      sortValue: (row) => row.marketValue ?? Number.NEGATIVE_INFINITY,
      render: (row) =>
        row.marketValue !== null ? (
          <span className="text-blue-800">
            {formatDollarValue(row.marketValue)}
          </span>
        ) : (
          <span className="text-ink/30">—</span>
        ),
    },
    {
      id: "keeperCost",
      header: "Keeper Cost",
      sortable: true,
      sortValue: (row) => row.keeperCost,
      render: (row) => formatDollarValue(row.keeperCost),
    },
    {
      id: "keeperSurplus",
      header: "Keeper Surplus",
      sortable: true,
      // "How good is the contract?" — green when the cost is a bargain
      // relative to market value, red when it's overpriced.
      sortValue: (row) => row.keeperSurplus ?? Number.NEGATIVE_INFINITY,
      render: (row) =>
        row.keeperSurplus !== null ? (
          <span
            className={row.keeperSurplus >= 0 ? "text-primary" : "text-red-700"}
          >
            {row.keeperSurplus >= 0 ? "+" : ""}
            {formatDollarValue(row.keeperSurplus)}
          </span>
        ) : (
          <span className="text-ink/30">—</span>
        ),
    },
    {
      id: "keeperYearsRemaining",
      header: "Years Remaining",
      sortable: true,
      sortValue: (row) => row.keeperYearsRemaining,
      render: (row) => row.keeperYearsRemaining,
    },
    {
      id: "assetValue",
      header: "Asset Value",
      sortable: true,
      // "What is this franchise asset actually worth?" — gold, bold, and a
      // notch larger: this is DLFO's primary ranking, not just another column.
      sortValue: (row) => row.assetValue ?? Number.NEGATIVE_INFINITY,
      render: (row) =>
        row.assetValue !== null ? (
          <Tooltip content={<AssetValueBreakdown player={row} />}>
            <span className="cursor-default text-base font-semibold text-gold">
              {formatDollarValue(row.assetValue)}
            </span>
          </Tooltip>
        ) : (
          <span className="text-ink/30">—</span>
        ),
    },
  ];
}
