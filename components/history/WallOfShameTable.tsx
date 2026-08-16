"use client";

import { useState } from "react";
import { DataTable, type Column, type SortState } from "@/components/ui/DataTable";
import type { SeasonShame } from "@/lib/services/leagueHistoryService";

const COLUMNS: Column<SeasonShame>[] = [
  {
    id: "season",
    header: "Season",
    sortable: true,
    sortValue: (row) => row.season,
    render: (row) => <span className="font-medium text-ink">{row.season}</span>,
  },
  {
    id: "last",
    header: "10th at Playoffs",
    sortable: true,
    sortValue: (row) => row.lastPlaceOwnerName ?? "",
    render: (row) =>
      row.lastPlaceOwnerName
        ? `${row.lastPlaceOwnerName} (${row.worstRecordWins}-${row.worstRecordLosses})`
        : "—",
  },
  {
    id: "lowestPoints",
    header: "Lowest Season Points",
    sortable: true,
    sortValue: (row) => row.lowestSeasonPoints ?? 0,
    render: (row) =>
      row.lowestSeasonPointsOwnerName
        ? `${row.lowestSeasonPointsOwnerName} (${row.lowestSeasonPoints?.toFixed(0)})`
        : "—",
  },
  {
    id: "lowestWeek",
    header: "Lowest Weekly Score",
    sortable: true,
    sortValue: (row) => row.lowestWeeklyScore?.score ?? 0,
    render: (row) =>
      row.lowestWeeklyScore
        ? `${row.lowestWeeklyScore.ownerName} — ${row.lowestWeeklyScore.score.toFixed(1)} (wk ${row.lowestWeeklyScore.week})`
        : "—",
  },
  {
    id: "losingStreak",
    header: "Longest Losing Streak",
    sortable: true,
    sortValue: (row) => row.longestLosingStreak?.length ?? 0,
    render: (row) =>
      row.longestLosingStreak
        ? `${row.longestLosingStreak.ownerName} (${row.longestLosingStreak.length})`
        : "—",
  },
];

function rowKey(row: SeasonShame): string {
  return String(row.season);
}

export function WallOfShameTable({ seasons }: { seasons: SeasonShame[] }) {
  const [sort, setSort] = useState<SortState>({ columnId: "season", direction: "desc" });

  return (
    <DataTable
      columns={COLUMNS}
      rows={seasons}
      rowKey={rowKey}
      sort={sort}
      onSortChange={setSort}
      emptyMessage="No completed seasons found."
    />
  );
}
