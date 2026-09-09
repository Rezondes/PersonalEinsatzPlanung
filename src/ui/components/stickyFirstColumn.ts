import type { SxProps, Theme } from '@mui/material/styles';

/**
 * Three sticky-table building blocks, shared by every grid in the app that needs one (list tables
 * here, and eventually MonthOverviewView/ScheduleTable). A two-tier z-index scheme, matching the
 * one the mockup itself already uses: sticky header row = 1, sticky first column (including the
 * corner, which is both at once) = 2 - the corner only ever visually overlaps zIndex-1 header
 * cells sliding underneath it during horizontal scroll, never another zIndex-2 cell (those only
 * ever appear in body rows, never the header row), so one tier above the header is already
 * sufficient; a third tier would be complexity with nothing to resolve.
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

/** Sticky header row, docked under the app header via the same --pep-header-height custom
 * property the schedule toolbar already sticks to. */
export const stickyHeaderRowSx: SxProps<Theme> = {
  position: 'sticky',
  top: 'var(--pep-header-height, 64px)',
  zIndex: 1,
  backgroundColor: 'background.paper',
};

/** The one cell that is both: the first column's own header cell. */
export const stickyCornerSx: SxProps<Theme> = {
  position: 'sticky',
  top: 'var(--pep-header-height, 64px)',
  left: 0,
  zIndex: 2,
  backgroundColor: 'background.paper',
};
