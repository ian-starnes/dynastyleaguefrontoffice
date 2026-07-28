"use client";

import { useMemo } from "react";
import { Card } from "@/components/ui/Card";
import { ChipGroup } from "@/components/ui/ChipGroup";
import {
  DataTable,
  useTableState,
  type SortState,
} from "@/components/ui/DataTable";
import { getMyOwnerId } from "@/lib/sleeper";
import type { LeaguePlayer } from "@/lib/league-players";
import { PLAYER_COLUMNS } from "./playerColumns";
import {
  PLAYER_FILTERS,
  matchesPlayerFilter,
  type PlayerFilterId,
} from "./playerFilters";
import { PlayerSearchInput } from "./PlayerSearchInput";

type PlayersTableState = {
  sort: SortState;
  filterId: PlayerFilterId;
  search: string;
};

const DEFAULT_STATE: PlayersTableState = {
  sort: { columnId: "fantasyValue", direction: "desc" },
  filterId: "all",
  search: "",
};

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

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <ChipGroup
          chips={PLAYER_FILTERS}
          activeId={tableState.filterId}
          onChange={(filterId) => setTableState({ ...tableState, filterId })}
        />
        <PlayerSearchInput
          value={tableState.search}
          onChange={(search) => setTableState({ ...tableState, search })}
        />
      </div>

      <Card className="mt-4">
        <DataTable
          columns={PLAYER_COLUMNS}
          rows={filteredPlayers}
          rowKey={(row) => row.nflPlayer.id}
          sort={tableState.sort}
          onSortChange={(sort) => setTableState({ ...tableState, sort })}
          emptyMessage="No players match your filters."
        />
      </Card>
    </div>
  );
}
