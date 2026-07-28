"use client";

import { useCallback, useMemo } from "react";
import { Card } from "@/components/ui/Card";
import { ChipGroup } from "@/components/ui/ChipGroup";
import {
  DataTable,
  useTableState,
  type SortState,
} from "@/components/ui/DataTable";
import { getMyOwnerId } from "@/lib/sleeper";
import type { LeaguePlayer } from "@/lib/league-players";
import { createPlayerColumns } from "./playerColumns";
import {
  PLAYER_FILTERS,
  matchesPlayerFilter,
  ownerFilterId,
  ownerIdFromFilter,
  type PlayerFilterId,
} from "./playerFilters";
import { PlayerSearchInput } from "./PlayerSearchInput";

type PlayersTableState = {
  sort: SortState;
  filterId: PlayerFilterId;
  search: string;
};

const DEFAULT_STATE: PlayersTableState = {
  sort: { columnId: "fantasyCalc", direction: "desc" },
  filterId: "all",
  search: "",
};

// Stable module-level reference — no need to recreate this every render.
function getPlayerRowKey(row: LeaguePlayer): string {
  return row.nflPlayer.id;
}

/**
 * Owns the sort/filter/search state for the players table — persisted via
 * useTableState so it survives navigating to another page and back.
 * Filtering/sorting run over already-fetched data client-side, no need to
 * hit Sleeper again per keystroke or click.
 */
export function PlayersExplorer({ players }: { players: LeaguePlayer[] }) {
  const [tableState, setTableState] = useTableState<PlayersTableState>(
    "players",
    DEFAULT_STATE
  );
  const myOwnerId = getMyOwnerId();

  const setFilterId = useCallback(
    (filterId: PlayerFilterId) =>
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

  const columns = useMemo(
    () => createPlayerColumns({ onOwnerClick: handleOwnerClick }),
    [handleOwnerClick]
  );

  const filteredPlayers = useMemo(() => {
    const query = tableState.search.trim().toLowerCase();

    return players.filter((player) => {
      if (!matchesPlayerFilter(player, tableState.filterId, myOwnerId)) {
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
            chips={PLAYER_FILTERS}
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
        <PlayerSearchInput value={tableState.search} onChange={setSearch} />
      </div>

      <Card className="mt-4">
        <DataTable
          columns={columns}
          rows={filteredPlayers}
          rowKey={getPlayerRowKey}
          sort={tableState.sort}
          onSortChange={handleSortChange}
          emptyMessage="No players match your filters."
        />
      </Card>
    </div>
  );
}
