"use client";

import { useCallback, useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { ChipGroup } from "@/components/ui/ChipGroup";
import {
  DataTable,
  useTableState,
  type SortState,
} from "@/components/ui/DataTable";
import { getMyOwnerId } from "@/lib/sleeper";
import type { LeaguePlayer } from "@/lib/league-players";
import { createAssetColumns } from "./assetColumns";
import {
  ASSET_FILTERS,
  matchesAssetFilter,
  ownerFilterId,
  ownerIdFromFilter,
  type AssetFilterId,
} from "./assetFilters";
import { AssetSearchInput } from "./AssetSearchInput";
import { PlayerDetailDrawer } from "./PlayerDetailDrawer";

type AssetsTableState = {
  sort: SortState;
  filterId: AssetFilterId;
  search: string;
};

const DEFAULT_STATE: AssetsTableState = {
  // Asset Value is DLFO's primary ranking now — market value plus contract
  // economics, not just "how good is the player."
  sort: { columnId: "assetValue", direction: "desc" },
  filterId: "all",
  search: "",
};

// Stable module-level reference — no need to recreate this every render.
function getPlayerRowKey(row: LeaguePlayer): string {
  return row.nflPlayer.id;
}

/**
 * Owns the sort/filter/search state for the assets table — persisted via
 * useTableState so it survives navigating to another page and back — plus
 * which asset (if any) has its detail drawer open. Filtering/sorting run
 * over already-fetched data client-side, no need to hit Sleeper again per
 * keystroke or click.
 */
export function AssetsExplorer({ players }: { players: LeaguePlayer[] }) {
  const [tableState, setTableState] = useTableState<AssetsTableState>(
    "assets",
    DEFAULT_STATE
  );
  const [selectedPlayer, setSelectedPlayer] = useState<LeaguePlayer | null>(
    null
  );
  const myOwnerId = getMyOwnerId();

  const setFilterId = useCallback(
    (filterId: AssetFilterId) =>
      setTableState((prev) => ({ ...prev, filterId })),
    [setTableState]
  );

  const setSearch = useCallback(
    (search: string) => setTableState((prev) => ({ ...prev, search })),
    [setTableState]
  );

  const handleSortChange = useCallback(
    (sort: SortState) => setTableState((prev) => ({ ...prev, sort })),
    [setTableState]
  );

  // Clicking the currently-filtered owner again clears back to "All".
  const handleOwnerClick = useCallback(
    (ownerId: string) =>
      setTableState((prev) => ({
        ...prev,
        filterId:
          ownerIdFromFilter(prev.filterId) === ownerId
            ? "all"
            : ownerFilterId(ownerId),
      })),
    [setTableState]
  );

  const handlePlayerClick = useCallback((player: LeaguePlayer) => {
    setSelectedPlayer(player);
  }, []);

  const handleDrawerClose = useCallback(() => setSelectedPlayer(null), []);

  const columns = useMemo(
    () =>
      createAssetColumns({
        onOwnerClick: handleOwnerClick,
        onPlayerClick: handlePlayerClick,
      }),
    [handleOwnerClick, handlePlayerClick]
  );

  const filteredPlayers = useMemo(() => {
    const query = tableState.search.trim().toLowerCase();

    return players.filter((player) => {
      if (!matchesAssetFilter(player, tableState.filterId, myOwnerId)) {
        return false;
      }

      if (!query) return true;

      return [
        player.nflPlayer.fullName,
        player.nflPlayer.position,
        player.nflPlayer.nflTeam,
        player.currentOwnerName,
      ]
        .filter((field): field is string => Boolean(field))
        .some((field) => field.toLowerCase().includes(query));
    });
  }, [players, tableState.filterId, tableState.search, myOwnerId]);

  const activeOwnerId = ownerIdFromFilter(tableState.filterId);
  const activeOwnerName = useMemo(() => {
    if (!activeOwnerId) return null;
    return (
      players.find((player) => player.currentOwnerId === activeOwnerId)
        ?.currentOwnerName ?? null
    );
  }, [players, activeOwnerId]);

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <ChipGroup
            chips={ASSET_FILTERS}
            activeId={tableState.filterId}
            onChange={setFilterId}
          />
          {activeOwnerName ? (
            <button
              type="button"
              onClick={() => setFilterId("all")}
              className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-1.5 text-xs font-medium text-background"
            >
              {activeOwnerName}
              <span aria-hidden>×</span>
            </button>
          ) : null}
        </div>
        <AssetSearchInput value={tableState.search} onChange={setSearch} />
      </div>

      <Card className="mt-4">
        <DataTable
          columns={columns}
          rows={filteredPlayers}
          rowKey={getPlayerRowKey}
          sort={tableState.sort}
          onSortChange={handleSortChange}
          emptyMessage="No assets match your filters."
        />
      </Card>

      <PlayerDetailDrawer player={selectedPlayer} onClose={handleDrawerClose} />
    </div>
  );
}
