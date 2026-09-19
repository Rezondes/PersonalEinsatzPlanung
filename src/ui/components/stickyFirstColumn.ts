import type { SxProps, Theme } from '@mui/material/styles';

/**
 * Three sticky-table building blocks, shared by every grid in the app that needs one (list tables
 * here, MonthOverviewView, and eventually ScheduleTable/Phase 5a). A three-tier z-index scheme:
 * sticky header row = 1, sticky first column (body cells) = 2, sticky corner (both at once) = 3.
 * The corner has to strictly outrank BOTH other tiers, not just the header row: a body row's
 * sticky-left cell is only sticky horizontally (no `top`), so during a normal vertical scroll it
 * passes right through the screen position the corner permanently occupies. At equal z-index,
 * stacking ties resolve by DOM order, and `<tbody>` rows come after `<thead>` - so whichever body
 * row is momentarily crossing that line would paint OVER the corner instead of under it, making
 * the corner's own label flicker/disappear mid-scroll and the crossing row's content appear to
 * bleed into the header. Confirmed live (reproduces on any real scroll gesture whenever a row
 * boundary happens to cross the sticky header's vertical span - a single programmatic
 * `scrollTop = X` jump can land on a position where no row happens to be crossing that instant,
 * which is why it looked scroll-gesture-specific before this was root-caused) by bumping just the
 * corner's z-index and watching the glitch disappear with no other change. A two-tier scheme
 * (corner tied with the first column) is what caused this bug in the first place - do not go back
 * to it.
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

/** Applied to the sticky first-column cell itself, alongside stickyFirstColumnSx - lets
 * stickyFirstColumnRowHoverSx below target it from the owning TableRow. A stable class, not a
 * ref/JS hover-state, is what makes this a pure CSS cascade: the opaque background above already
 * covers the sticky cell, so MUI's own `hover` tint on the row (a plain sibling-selector-free
 * background-color) never reaches it - this is the documented, accepted trade-off in the comment
 * above. The fix is a second, independent rule keyed off this class, not a replacement for that
 * opaque background (still needed to stop scrolled-past content bleeding through underneath). */
export const STICKY_FIRST_COLUMN_CLASS = 'pep-sticky-first-column';

/** Spread into a `hover`-enabled TableRow's own `sx` alongside its other rules. */
export const stickyFirstColumnRowHoverSx: SxProps<Theme> = {
  [`&:hover .${STICKY_FIRST_COLUMN_CLASS}`]: { backgroundColor: 'action.hover' },
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

/** The one cell that is both: the first column's own header cell. zIndex 3, not 2 - see
 * stickyFirstColumnSx's own comment for why the corner must strictly outrank the sticky first
 * column's body cells, not just tie with them. */
export function stickyCornerSx(top: string | number = 0): SxProps<Theme> {
  return {
    position: 'sticky',
    top,
    left: 0,
    zIndex: 3,
    backgroundColor: 'background.paper',
  };
}
