import { useState } from 'react';

export type SortDirection = 'asc' | 'desc';

export interface TableSortState<K extends string> {
  key: K;
  direction: SortDirection;
}

/**
 * Column sorting for the plain MUI tables in this app (no DataGrid - a deliberate choice, see
 * src/ui/CLAUDE.md on staying with familiar MUI controls).
 *
 * The hook only holds which column is sorted in which direction and hands MUI's TableSortLabel its
 * props; the comparators stay in the view, so they can use the domain helpers (compareByLastName,
 * German collation) instead of a generic value-based comparison that would sort umlauts wrongly.
 */
export function useTableSort<K extends string>(initialKey: K, initialDirection: SortDirection = 'asc') {
  const [sort, setSort] = useState<TableSortState<K>>({ key: initialKey, direction: initialDirection });

  const toggle = (key: K) =>
    setSort((current) =>
      current.key === key
        ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: 'asc' },
    );

  /** Spread onto a MUI TableSortLabel in the column header. */
  const headProps = (key: K) => ({
    active: sort.key === key,
    direction: sort.key === key ? sort.direction : ('asc' as SortDirection),
    onClick: () => toggle(key),
  });

  /** Returns a new sorted array; never mutates the input (the rows come straight from a hook). */
  const sortRows = <T>(rows: T[], comparators: Record<K, (a: T, b: T) => number>): T[] => {
    const compare = comparators[sort.key];
    const factor = sort.direction === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => compare(a, b) * factor);
  };

  return { sort, toggle, headProps, sortRows };
}
