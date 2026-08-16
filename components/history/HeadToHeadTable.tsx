"use client";

import { useState } from "react";
import { DataTable, type Column, type SortState } from "@/components/ui/DataTable";
import type { HeadToHead } from "@/lib/services/leagueHistoryService";

const COLUMNS: Column<HeadToHead>[] = [
  {
    id: "matchup",
    header: "Matchup",
    sortable: true,
    sortValue: (row) => `${row.ownerAName ?? ""} ${row.ownerBName ?? ""}`,
    render: (row) => (
      <span className="font-medium text-ink">
        {row.ownerAName ?? "—"} <span className="text-ink/40">vs</span> {row.ownerBName ?? "—"}
      </span>
    ),
  },
  {
    id: "record",
    header: "Overall Record",
    sortable: true,
    sortValue: (row) => row.ownerAWins - row.ownerBWins,
    render: (row) => `${row.ownerAWins}-${row.ownerBWins}${row.ties > 0 ? `-${row.ties}` : ""}`,
  },
  {
    id: "regularSeason",
    header: "Regular Season",
    sortable: false,
    render: (row) =>
      `${row.regularSeason.ownerAWins}-${row.regularSeason.ownerBWins}${row.regularSeason.ties > 0 ? `-${row.regularSeason.ties}` : ""}`,
  },
  {
    id: "playoffs",
    header: "Playoffs",
    sortable: false,
    render: (row) =>
      row.playoffs.ownerAWins + row.playoffs.ownerBWins + row.playoffs.ties > 0
        ? `${row.playoffs.ownerAWins}-${row.playoffs.ownerBWins}${row.playoffs.ties > 0 ? `-${row.playoffs.ties}` : ""}`
        : "—",
  },
  {
    id: "avgMargin",
    header: "Avg Margin (A)",
    sortable: true,
    sortValue: (row) => row.averageMargin,
    render: (row) => `${row.averageMargin >= 0 ? "+" : ""}${row.averageMargin.toFixed(1)}`,
  },
  {
    id: "biggestWin",
    header: "Biggest Win (A)",
    sortable: true,
    sortValue: (row) => row.biggestWin?.margin ?? 0,
    render: (row) => (row.biggestWin ? `+${row.biggestWin.margin.toFixed(1)}` : "—"),
  },
  {
    id: "highestCombined",
    header: "Highest Combined",
    sortable: true,
    sortValue: (row) => row.highestCombinedScore?.total ?? 0,
    render: (row) => row.highestCombinedScore?.total.toFixed(1) ?? "—",
  },
  {
    id: "streak",
    header: "Current Streak",
    sortable: false,
    render: (row) =>
      row.currentStreak
        ? `${row.currentStreak.owner === "A" ? row.ownerAName : row.currentStreak.owner === "B" ? row.ownerBName : "Tied"} (${row.currentStreak.length})`
        : "—",
  },
];

function rowKey(row: HeadToHead): string {
  return `${row.ownerAId}:${row.ownerBId}`;
}

export function HeadToHeadTable({ pairs }: { pairs: HeadToHead[] }) {
  const [sort, setSort] = useState<SortState>({ columnId: "matchup", direction: "asc" });

  return (
    <DataTable
      columns={COLUMNS}
      rows={pairs}
      rowKey={rowKey}
      sort={sort}
      onSortChange={setSort}
      emptyMessage="No matchup history found."
    />
  );
}
