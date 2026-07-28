"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

type TableStateMap = Record<string, unknown>;

type TableStateContextValue = {
  map: TableStateMap;
  setState: (tableId: string, state: unknown) => void;
};

const TableStateContext = createContext<TableStateContextValue | null>(null);

/**
 * Mounted once above the routed page tree (see AppShell) so any DataTable's
 * sort/filter state survives navigating away from its page and back —
 * plain component state would otherwise reset the moment the route
 * unmounts it.
 */
export function TableStateProvider({ children }: { children: ReactNode }) {
  const [map, setMap] = useState<TableStateMap>({});

  const setState = (tableId: string, state: unknown) =>
    setMap((prev) => ({ ...prev, [tableId]: state }));

  return (
    <TableStateContext.Provider value={{ map, setState }}>
      {children}
    </TableStateContext.Provider>
  );
}

/** Generic over any per-table state shape — sort, filters, search, whatever a table needs. */
export function useTableState<S>(
  tableId: string,
  defaultState: S
): [S, (next: S) => void] {
  const context = useContext(TableStateContext);
  if (!context) {
    throw new Error("useTableState must be used within a TableStateProvider");
  }

  const current = (context.map[tableId] as S | undefined) ?? defaultState;
  const setState = (next: S) => context.setState(tableId, next);

  return [current, setState];
}
