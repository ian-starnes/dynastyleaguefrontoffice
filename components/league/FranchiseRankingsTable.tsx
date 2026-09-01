"use client";

import { useState } from "react";
import { DataTable, type Column, type SortState } from "@/components/ui/DataTable";
import { formatDollarValue } from "@/lib/format";
import type { FranchiseValuation } from "@/lib/services/franchiseValueService";

const COLUMNS: Column<FranchiseValuation>[] = [
  {
    id: "rank",
    header: "Rank",
    sortable: true,
    sortValue: (row) => row.rank,
    render: (row) => `#${row.rank}`,
  },
  {
    id: "owner",
    header: "Franchise",
    sortable: true,
    sortValue: (row) => row.ownerName,
    render: (row) => <span className="font-medium text-ink">{row.ownerName}</span>,
  },
  {
    id: "rosterAssetValue",
    header: "Roster Asset Value",
    sortable: true,
    // What Rank is actually based on — see franchiseValueService.ts. Same
    // gold/bold treatment as Asset Value at the player level.
    sortValue: (row) => row.rosterAssetValue,
    render: (row) => (
      <span className="text-base font-semibold text-gold">
        {formatDollarValue(row.rosterAssetValue)}
      </span>
    ),
  },
  {
    id: "futurePickValue",
    header: "Future Pick Value",
    sortable: true,
    sortValue: (row) => row.futurePickValue,
    render: (row) => formatDollarValue(row.futurePickValue),
  },
  {
    id: "franchiseValue",
    header: "Franchise Value",
    sortable: true,
    sortValue: (row) => row.franchiseValue,
    render: (row) => formatDollarValue(row.franchiseValue),
  },
];

function getFranchiseRowKey(row: FranchiseValuation): string {
  return row.ownerId;
}

/**
 * A small, single-purpose table — local sort state rather than the
 * persisted useTableState the Assets table uses, since there's no
 * search/filter chip row here and only ~10 rows to page through.
 */
export function FranchiseRankingsTable({
  franchises,
}: {
  franchises: FranchiseValuation[];
}) {
  const [sort, setSort] = useState<SortState>({
    columnId: "rosterAssetValue",
    direction: "desc",
  });

  return (
    <DataTable
      columns={COLUMNS}
      rows={franchises}
      rowKey={getFranchiseRowKey}
      sort={sort}
      onSortChange={setSort}
      emptyMessage="No franchises found."
    />
  );
}
