import { describe, it, expect } from 'vitest';
import type { SxProps, Theme } from '@mui/material/styles';
import {
  stickyFirstColumnSx,
  stickyHeaderRowSx,
  stickyCornerSx,
  STICKY_FIRST_COLUMN_CLASS,
  stickyFirstColumnRowHoverSx,
} from './stickyFirstColumn';

function zIndexOf(sx: SxProps<Theme>): number {
  return (sx as { zIndex: number }).zIndex;
}

describe('stickyFirstColumn', () => {
  // The corner must strictly outrank the sticky first column's body cells, not just tie with
  // them - see stickyFirstColumnSx's own comment. A body row's sticky-left cell is only sticky
  // horizontally, so it passes through the corner's screen position on every vertical scroll; at
  // equal z-index the tie resolves by DOM order (tbody after thead), so the crossing row paints
  // OVER the corner instead of under it. This is the exact regression that shipped once already.
  it('gives the sticky corner a strictly higher z-index than the sticky first column', () => {
    expect(zIndexOf(stickyCornerSx())).toBeGreaterThan(zIndexOf(stickyFirstColumnSx));
  });

  it('gives the sticky first column a strictly higher z-index than the sticky header row', () => {
    expect(zIndexOf(stickyFirstColumnSx)).toBeGreaterThan(zIndexOf(stickyHeaderRowSx()));
  });

  it('positions all three sticky, with an opaque background so scrolled content cannot show through', () => {
    for (const sx of [stickyFirstColumnSx, stickyHeaderRowSx(), stickyCornerSx()]) {
      expect(sx).toMatchObject({ position: 'sticky', backgroundColor: 'background.paper' });
    }
  });

  it('exportiert eine stabile Klasse und eine passende Hover-Regel', () => {
    expect(typeof STICKY_FIRST_COLUMN_CLASS).toBe('string');
    expect(STICKY_FIRST_COLUMN_CLASS.length).toBeGreaterThan(0);

    const hoverKey = `&:hover .${STICKY_FIRST_COLUMN_CLASS}`;
    expect(stickyFirstColumnRowHoverSx).toHaveProperty(hoverKey);
  });
});
