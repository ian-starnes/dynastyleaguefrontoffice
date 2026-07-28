import type { ReactNode } from "react";

export type SortDirection = "asc" | "desc";

export type SortState = {
  columnId: string;
  direction: SortDirection;
};

export type Column<T> = {
  id: string;
  header: string;
  sortable?: boolean;
  sortValue?: (row: T) => string | number;
  render: (row: T) => ReactNode;
  headerClassName?: string;
  cellClassName?: string;
};
