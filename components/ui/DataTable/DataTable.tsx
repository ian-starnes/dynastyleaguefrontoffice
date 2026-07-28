"use client";

import { Fragment, useMemo } from "react";
import type { Column, SortState } from "./types";
import { nextSortState, sortRows } from "./sort";

type DataTableProps<T> = {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  sort: SortState;
  onSortChange: (next: SortState) => void;
  emptyMessage?: string;
};

/**
 * Generic, presentation-only table: sorting, header interaction, and the
 * mobile "Sort by" select all derive from the `columns` config passed in.
 * A new column (Keeper Cost, Contract Years, Franchise Value, ...) is just
 * a new entry in that config — nothing in here needs to change.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  sort,
  onSortChange,
  emptyMessage = "No results.",
}: DataTableProps<T>) {
  const sortedRows = useMemo(
    () => sortRows(rows, columns, sort),
    [rows, columns, sort]
  );

  const sortableColumns = columns.filter(
    (column) => column.sortable && column.sortValue
  );

  return (
    <div>
      {/* Desktop uses the clickable headers below; mobile gets a select instead. */}
      <div className="mb-3 flex items-center gap-2 border-b border-black/5 pb-3 lg:hidden">
        <label
          htmlFor="data-table-sort"
          className="text-xs font-medium uppercase tracking-wide text-ink/50"
        >
          Sort by
        </label>
        <select
          id="data-table-sort"
          value={`${sort.columnId}:${sort.direction}`}
          onChange={(event) => {
            const [columnId, direction] = event.target.value.split(":");
            onSortChange({
              columnId,
              direction: direction as SortState["direction"],
            });
          }}
          className="rounded-lg border border-black/10 bg-white px-3 py-1.5 text-sm text-ink focus:border-primary/30 focus:outline-none"
        >
          {sortableColumns.map((column) => (
            <Fragment key={column.id}>
              <option value={`${column.id}:asc`}>{column.header} ↑</option>
              <option value={`${column.id}:desc`}>{column.header} ↓</option>
            </Fragment>
          ))}
        </select>
      </div>

      <div className="max-h-[65vh] overflow-auto">
        <table className="w-full min-w-[640px] border-collapse text-left text-sm">
          <thead>
            <tr className="sticky top-0 z-10 border-b border-black/10 bg-white text-xs font-medium uppercase tracking-wide text-ink/50">
              {columns.map((column) => {
                const isActive = sort.columnId === column.id;

                return (
                  <th
                    key={column.id}
                    className={`px-5 py-3 ${column.headerClassName ?? ""}`}
                  >
                    {column.sortable && column.sortValue ? (
                      <button
                        type="button"
                        onClick={() =>
                          onSortChange(nextSortState(sort, column.id))
                        }
                        className={`flex items-center gap-1 hover:text-ink ${
                          isActive ? "text-primary" : ""
                        }`}
                      >
                        {column.header}
                        {isActive ? (
                          <span aria-hidden>
                            {sort.direction === "asc" ? "↑" : "↓"}
                          </span>
                        ) : null}
                      </button>
                    ) : (
                      column.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row) => (
              <tr
                key={rowKey(row)}
                className="border-b border-black/5 last:border-0 hover:bg-black/[0.02]"
              >
                {columns.map((column) => (
                  <td
                    key={column.id}
                    className={`px-5 py-3 text-ink/70 ${column.cellClassName ?? ""}`}
                  >
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            ))}

            {sortedRows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-5 py-10 text-center text-ink/40"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
