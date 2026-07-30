"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type TableStateMap = Record<string, unknown>;
type Updater<S> = S | ((prev: S) => S);

type TableStateContextValue = {
  map: TableStateMap;
  setState: (tableId: string, updater: Updater<unknown>) => void;
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

  const setState = useCallback(
    (tableId: string, updater: Updater<unknown>) => {
      setMap((prev) => {
        const nextValue =
          typeof updater === "function"
            ? (updater as (prev: unknown) => unknown)(prev[tableId])
            : updater;
        return { ...prev, [tableId]: nextValue };
      });
    },
    []
  );

  // Memoized so components consuming only `setState` (not `map`) don't
  // re-render every time some other table's state changes.
  const value = useMemo(() => ({ map, setState }), [map, setState]);

  return (
    <TableStateContext.Provider value={value}>
      {children}
    </TableStateContext.Provider>
  );
}

/** Generic over any per-table state shape — sort, filters, search, whatever a table needs. */
export function useTableState<S>(
  tableId: string,
  defaultState: S
): [S, (next: Updater<S>) => void] {
  const context = useContext(TableStateContext);
  if (!context) {
    throw new Error("useTableState must be used within a TableStateProvider");
  }

  const { setState: contextSetState } = context;
  const current = (context.map[tableId] as S | undefined) ?? defaultState;

  // Stable across renders (as long as tableId doesn't change) — lets
  // callers build their own useCallback handlers on top without those
  // handlers' identity changing every render, which would otherwise defeat
  // downstream memoization (e.g. a memoized column config or table row).
  const setState = useCallback(
    (next: Updater<S>) => {
      // Explicit `unknown` annotation is required here: Updater<unknown>'s
      // `unknown | (fn)` union can't be disambiguated for contextual typing
      // the way e.g. React's SetStateAction<S> can when S is a concrete
      // type, since `unknown` itself already matches anything.
      contextSetState(tableId, (prev: unknown) => {
        const prevState = (prev as S | undefined) ?? defaultState;
        return typeof next === "function"
          ? (next as (prev: S) => S)(prevState)
          : next;
      });
    },
    // defaultState intentionally omitted: callers may pass a fresh object
    // literal each render, and including it here would defeat the point.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [contextSetState, tableId]
  );

  return [current, setState];
}
