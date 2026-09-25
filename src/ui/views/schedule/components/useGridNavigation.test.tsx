import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useGridNavigation } from './useGridNavigation';

/** A grid of buttons named "r<row>c<col>"; locked cells render as plain text like the
 * Wochenplan's locked cells, which take no focus at all. */
function Grid({ focusable }: { focusable: boolean[][] }) {
  const nav = useGridNavigation(focusable);
  return (
    <div>
      {focusable.map((row, r) =>
        row.map((canFocus, c) =>
          canFocus ? (
            <button
              key={`${r}-${c}`}
              type="button"
              ref={nav.registerCell(r, c)}
              tabIndex={nav.tabIndexFor(r, c)}
              onFocus={() => nav.onCellFocus(r, c)}
              onKeyDown={(e) => nav.onKeyDown(e, r, c)}
            >
              {`r${r}c${c}`}
            </button>
          ) : (
            <span key={`${r}-${c}`}>{`r${r}c${c}`}</span>
          ),
        ),
      )}
    </div>
  );
}

const all = (rows: number, cols: number) => Array.from({ length: rows }, () => Array.from({ length: cols }, () => true));
const cell = (name: string) => screen.getByRole('button', { name });
const tabStops = () => screen.getAllByRole('button').filter((b) => b.tabIndex === 0);

describe('useGridNavigation', () => {
  it('makes only the first focusable cell a Tab stop', () => {
    const focusable = all(3, 3);
    focusable[0][0] = false;
    render(<Grid focusable={focusable} />);

    expect(tabStops().map((b) => b.textContent)).toEqual(['r0c1']);
  });

  it('moves the Tab stop to the cell that last had the focus', async () => {
    const user = userEvent.setup();
    render(<Grid focusable={all(3, 3)} />);

    await user.click(cell('r1c2'));

    expect(tabStops().map((b) => b.textContent)).toEqual(['r1c2']);
  });

  it('moves with the arrow keys and skips locked cells', async () => {
    const user = userEvent.setup();
    const focusable = all(3, 3);
    focusable[0][1] = false;
    focusable[1][0] = false;
    render(<Grid focusable={focusable} />);

    cell('r0c0').focus();
    await user.keyboard('{ArrowRight}');
    expect(cell('r0c2')).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(cell('r1c2')).toHaveFocus();
    await user.keyboard('{ArrowLeft}');
    expect(cell('r1c1')).toHaveFocus();
    await user.keyboard('{ArrowUp}');
    // r0c1 is locked and nothing is above it: stays put.
    expect(cell('r1c1')).toHaveFocus();
  });

  it('skips a locked cell vertically to the next row that has one', async () => {
    const user = userEvent.setup();
    const focusable = all(3, 3);
    focusable[1][0] = false;
    render(<Grid focusable={focusable} />);

    cell('r0c0').focus();
    await user.keyboard('{ArrowDown}');

    expect(cell('r2c0')).toHaveFocus();
  });

  it('stays at the edge', async () => {
    const user = userEvent.setup();
    render(<Grid focusable={all(2, 2)} />);

    cell('r0c0').focus();
    await user.keyboard('{ArrowLeft}{ArrowUp}');
    expect(cell('r0c0')).toHaveFocus();

    cell('r1c1').focus();
    await user.keyboard('{ArrowRight}{ArrowDown}');
    expect(cell('r1c1')).toHaveFocus();
  });

  it('jumps to the row ends with Home/End and to the grid ends with Ctrl', async () => {
    const user = userEvent.setup();
    render(<Grid focusable={all(3, 3)} />);

    cell('r1c1').focus();
    await user.keyboard('{Home}');
    expect(cell('r1c0')).toHaveFocus();
    await user.keyboard('{End}');
    expect(cell('r1c2')).toHaveFocus();
    await user.keyboard('{Control>}{Home}{/Control}');
    expect(cell('r0c0')).toHaveFocus();
    await user.keyboard('{Control>}{End}{/Control}');
    expect(cell('r2c2')).toHaveFocus();
  });

  it('falls back to a valid cell when the active row disappears', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<Grid focusable={all(3, 3)} />);

    await user.click(cell('r2c1'));
    rerender(<Grid focusable={all(2, 3)} />);

    expect(tabStops().map((b) => b.textContent)).toEqual(['r0c0']);
  });

  it('leaves other keys alone', async () => {
    const user = userEvent.setup();
    render(<Grid focusable={all(2, 2)} />);

    cell('r0c0').focus();
    await user.keyboard('a');

    expect(cell('r0c0')).toHaveFocus();
  });
});
