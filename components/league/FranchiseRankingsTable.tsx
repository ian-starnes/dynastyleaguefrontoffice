"use client";

import { useMemo, useState } from "react";
import { DataTable, type Column, type SortState } from "@/components/ui/DataTable";
import { formatDollarValue } from "@/lib/format";
import type { FranchiseValuation } from "@/lib/services/franchiseValueService";

function createColumns(currentSeason: number): Column<FranchiseValuation>[] {
  return [
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
      id: "rosterMarketValue",
      header: `${currentSeason} Roster Market Value`,
      sortable: true,
      sortValue: (row) => row.rosterMarketValue,
      render: (row) => formatDollarValue(row.rosterMarketValue),
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
      // What Rank is based on — real player Market Value plus real held
      // Pick Value, summed. Same gold/bold treatment as Asset Value at the
      // player level.
      sortValue: (row) => row.franchiseValue,
      render: (row) => (
        <span className="text-base font-semibold text-gold">
          {formatDollarValue(row.franchiseValue)}
        </span>
      ),
    },
  ];
}

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
  currentSeason,
}: {
  franchises: FranchiseValuation[];
  currentSeason: number;
}) {
  const [sort, setSort] = useState<SortState>({
    columnId: "franchiseValue",
    direction: "desc",
  });

  const columns = useMemo(() => createColumns(currentSeason), [currentSeason]);

  return (
    <DataTable
      columns={columns}
      rows={franchises}
      rowKey={getFranchiseRowKey}
      sort={sort}
      onSortChange={setSort}
      emptyMessage="No franchises found."
    />
  );
}
