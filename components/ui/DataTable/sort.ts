import type { Column, SortState } from "./types";

export function sortRows<T>(
  rows: T[],
  columns: Column<T>[],
  sort: SortState
): T[] {
  const column = columns.find((c) => c.id === sort.columnId);
  if (!column?.sortValue) return rows;
  const sortValue = column.sortValue;

  const sorted = [...rows].sort((a, b) => {
    const aValue = sortValue(a);
    const bValue = sortValue(b);

    if (typeof aValue === "number" && typeof bValue === "number") {
      return aValue - bValue;
    }

    return String(aValue).localeCompare(String(bValue));
  });

  return sort.direction === "desc" ? sorted.reverse() : sorted;
}

export function nextSortState(current: SortState, columnId: string): SortState {
  if (current.columnId === columnId) {
    return {
      columnId,
      direction: current.direction === "asc" ? "desc" : "asc",
    };
  }

  return { columnId, direction: "asc" };
}
