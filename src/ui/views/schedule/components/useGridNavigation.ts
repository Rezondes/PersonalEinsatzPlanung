import { useCallback, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';

interface Position {
  r: number;
  c: number;
}

const key = (r: number, c: number) => `${r}|${c}`;

function firstFocusable(focusable: boolean[][], fromEnd = false): Position | null {
  const rows = fromEnd ? [...focusable.keys()].reverse() : [...focusable.keys()];
  for (const r of rows) {
    const cols = fromEnd ? [...focusable[r].keys()].reverse() : [...focusable[r].keys()];
    for (const c of cols) {
      if (focusable[r][c]) return { r, c };
    }
  }
  return null;
}

/** The next focusable cell from `from` in one direction, skipping locked cells; null at the edge. */
function step(focusable: boolean[][], from: Position, dr: number, dc: number): Position | null {
  let r = from.r + dr;
  let c = from.c + dc;
  while (r >= 0 && r < focusable.length && c >= 0 && c < (focusable[r]?.length ?? 0)) {
    if (focusable[r][c]) return { r, c };
    r += dr;
    c += dc;
  }
  return null;
}

/**
 * Roving tabindex for a grid of cells (WAI-ARIA grid pattern): the whole grid is ONE Tab stop, the
 * arrow keys move between cells, Home/End to the row ends, Ctrl+Home/End to the grid ends. Cells
 * that cannot take the focus (`focusable[r][c] === false`, e.g. the Wochenplan's locked cells) are
 * skipped; at an edge nothing happens.
 *
 * The Tab stop is the cell that last had the focus, or the first focusable cell when that one no
 * longer exists (rows changed). Positions are indices, which is enough here: a changed row list is
 * a new week or Filiale, where starting over at the first cell is the right answer anyway.
 */
export function useGridNavigation(focusable: boolean[][]) {
  const [active, setActive] = useState<Position | null>(null);
  const cells = useRef(new Map<string, HTMLElement>());

  const tabStop = active && focusable[active.r]?.[active.c] ? active : firstFocusable(focusable);

  const registerCell = useCallback(
    (r: number, c: number) => (el: HTMLElement | null) => {
      if (el) cells.current.set(key(r, c), el);
      else cells.current.delete(key(r, c));
    },
    [],
  );

  const tabIndexFor = (r: number, c: number) => (tabStop && tabStop.r === r && tabStop.c === c ? 0 : -1);

  const onCellFocus = (r: number, c: number) => {
    if (active?.r !== r || active?.c !== c) setActive({ r, c });
  };

  /** Returns true when the key is a navigation key (and was consumed). */
  const onKeyDown = (e: KeyboardEvent, r: number, c: number): boolean => {
    const from = { r, c };
    let to: Position | null;
    switch (e.key) {
      case 'ArrowRight':
        to = step(focusable, from, 0, 1);
        break;
      case 'ArrowLeft':
        to = step(focusable, from, 0, -1);
        break;
      case 'ArrowDown':
        to = step(focusable, from, 1, 0);
        break;
      case 'ArrowUp':
        to = step(focusable, from, -1, 0);
        break;
      case 'Home':
        to = e.ctrlKey ? firstFocusable(focusable) : { r, c: focusable[r].indexOf(true) };
        break;
      case 'End':
        to = e.ctrlKey ? firstFocusable(focusable, true) : { r, c: focusable[r].lastIndexOf(true) };
        break;
      default:
        return false;
    }
    // Consumed even at the edge, so an arrow key never scrolls the table away from the focused cell.
    e.preventDefault();
    if (to) cells.current.get(key(to.r, to.c))?.focus();
    return true;
  };

  return { registerCell, tabIndexFor, onCellFocus, onKeyDown };
}
