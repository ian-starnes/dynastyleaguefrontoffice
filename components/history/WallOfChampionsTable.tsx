"use client";

import { useState } from "react";
import { DataTable, type Column, type SortState } from "@/components/ui/DataTable";
import type { SeasonChampionship } from "@/lib/services/leagueHistoryService";

const COLUMNS: Column<SeasonChampionship>[] = [
  {
    id: "season",
    header: "Season",
    sortable: true,
    sortValue: (row) => row.season,
    render: (row) => <span className="font-medium text-ink">{row.season}</span>,
  },
  {
    id: "champion",
    header: "Champion",
    sortable: true,
    sortValue: (row) => row.championOwnerName ?? "",
    render: (row) => (
      <span className="font-semibold text-gold">{row.championOwnerName ?? "—"}</span>
    ),
  },
  {
    id: "runnerUp",
    header: "Runner-Up",
    sortable: true,
    sortValue: (row) => row.runnerUpOwnerName ?? "",
    render: (row) => row.runnerUpOwnerName ?? "—",
  },
  {
    id: "third",
    header: "Third Place",
    sortable: true,
    sortValue: (row) => row.thirdPlaceOwnerName ?? "",
    render: (row) => row.thirdPlaceOwnerName ?? "—",
  },
  {
    id: "regularSeasonChampion",
    header: "Regular Season Champion",
    sortable: true,
    sortValue: (row) => row.regularSeasonChampionOwnerName ?? "",
    render: (row) => row.regularSeasonChampionOwnerName ?? "—",
  },
  {
    id: "highestScoring",
    header: "Highest Scoring Team",
    sortable: true,
    sortValue: (row) => row.highestScoringPoints ?? 0,
    render: (row) =>
      row.highestScoringOwnerName
        ? `${row.highestScoringOwnerName} (${(row.highestScoringPoints ?? 0).toFixed(0)} pts)`
        : "—",
  },
];

function rowKey(row: SeasonChampionship): string {
  return String(row.season);
}

export function WallOfChampionsTable({ seasons }: { seasons: SeasonChampionship[] }) {
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
