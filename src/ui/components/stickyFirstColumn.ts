import type { SxProps, Theme } from '@mui/material/styles';

/**
 * Three sticky-table building blocks, shared by every grid in the app that needs one (list tables
 * here, MonthOverviewView, and eventually ScheduleTable/Phase 5a). A two-tier z-index scheme,
 * matching the one the mockup itself already uses: sticky header row = 1, sticky first column
 * (including the corner, which is both at once) = 2 - the corner only ever visually overlaps
 * zIndex-1 header cells sliding underneath it during horizontal scroll, never another zIndex-2
 * cell (those only ever appear in body rows, never the header row), so one tier above the header
 * is already sufficient; a third tier would be complexity with nothing to resolve.
 *
 * An opaque background is required on all three - a transparent sticky cell lets scrolled-past
 * content bleed through underneath it, a common bug with this technique. The trade-off: MUI's
 * `TableRow hover` tint won't show through a sticky body cell specifically, since it needs an
 * opaque background of its own; accepted here since these are simple data tables, not the
 * schedule grid's state-color-coded cells.
 */
export const stickyFirstColumnSx: SxProps<Theme> = {
  position: 'sticky',
  left: 0,
  zIndex: 2,
  backgroundColor: 'background.paper',
};

/**
 * Sticky header row and corner cell both take the scroll container's own top edge as `top`
 * (usually 0) - NOT `--pep-header-height`/the page. A table that needs BOTH a sticky header row
 * and horizontal scroll cannot have the header stick relative to the page: setting
 * `overflow-x: auto` on the scrolling wrapper unconditionally forces the browser to compute
 * `overflow-y` as a scroll container too (CSS overflow spec - the two axes couple whenever exactly
 * one of them is `visible`; every attempt to keep `overflow-y` as `visible`/`clip` while
 * `overflow-x` stays `auto` was verified empirically to still leave the wrapper as the sticky
 * containing block, just without a visible scrollbar - the header cells still landed at the wrong
 * position, offset by whatever the wrapper's own top edge happened to be instead of the viewport).
 * So the wrapper has to be an intentional, height-bounded, self-scrolling region (matching how the
 * mockup's own grid views are built - a flex `min-height: 0` area with `overflow: auto`, not a
 * page that keeps growing), and `top` sticks to THAT region's own top, normally 0.
 */
export function stickyHeaderRowSx(top: string | number = 0): SxProps<Theme> {
  return {
    position: 'sticky',
    top,
    zIndex: 1,
    backgroundColor: 'background.paper',
  };
}

/** The one cell that is both: the first column's own header cell. */
export function stickyCornerSx(top: string | number = 0): SxProps<Theme> {
  return {
    position: 'sticky',
    top,
    left: 0,
    zIndex: 2,
    backgroundColor: 'background.paper',
  };
}
