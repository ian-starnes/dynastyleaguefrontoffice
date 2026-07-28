"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { PlayerSearchInput } from "./PlayerSearchInput";
import { PlayerTable } from "./PlayerTable";
import type { LeaguePlayer } from "@/lib/sleeper";

/**
 * Owns the search/filter state for the players table. Filtering already-
 * fetched data client-side — no need to hit Sleeper again per keystroke.
 */
export function PlayersExplorer({ players }: { players: LeaguePlayer[] }) {
  const [search, setSearch] = useState("");

  const filteredPlayers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return players;

    return players.filter(({ nflPlayer, currentOwnerName }) =>
      [nflPlayer.fullName, nflPlayer.position, nflPlayer.nflTeam, currentOwnerName]
        .filter((field): field is string => Boolean(field))
        .some((field) => field.toLowerCase().includes(query))
    );
  }, [players, search]);

  return (
    <div>
      <PlayerSearchInput value={search} onChange={setSearch} />
      <Card className="mt-4">
        <PlayerTable players={filteredPlayers} />
      </Card>
    </div>
  );
}
