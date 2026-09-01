import type { Column, SortState } from "./types";

export function sortRows<T>(
  rows: T[],
  columns: Column<T>[],
  sort: SortState
): T[] {
  const column = columns.find((c) => c.id === sort.columnId);
  if (!column?.sortValue) return rows;
  const sortValue = column.sortValue;

  // Compares ascending, then negates for desc — rather than sorting
  // ascending and reversing the whole array, which would also flip the
  // relative order of tied rows (breaking stability: two rows with equal
  // sort values would swap places depending on direction alone).
  const comparisonDirection = sort.direction === "desc" ? -1 : 1;

  return [...rows].sort((a, b) => {
    const aValue = sortValue(a);
    const bValue = sortValue(b);

    const comparison =
      typeof aValue === "number" && typeof bValue === "number"
        ? aValue - bValue
        : String(aValue).localeCompare(String(bValue));

    return comparison * comparisonDirection;
  });
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
