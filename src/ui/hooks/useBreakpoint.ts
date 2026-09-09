import useMediaQuery from '@mui/material/useMediaQuery';
import { theme } from '@ui/app/theme';

export type Layout = 'mobile' | 'tabletPortrait' | 'tabletLandscape' | 'laptop';

/**
 * The single source of truth for "which of the four responsive-design device classes is this?"
 * (Handy / Tablet Hochformat / Tablet Querformat / kleiner Laptop, matching
 * `theme.breakpoints.values`). Every structural decision that depends on viewport width -
 * AppShell's nav chrome, dialog-vs-full-screen-sheet, and the schedule grid's touch-vs-mouse
 * interaction mode - reads this one hook instead of a bespoke `useMediaQuery` call, so those
 * choices can never independently drift out of sync (e.g. rail chrome paired with mouse-only
 * drag-and-drop would be a real, untested combination if they were separate flags).
 *
 * `noSsr: true` matters here specifically: this is a pure client-rendered SPA (no SSR anywhere in
 * the stack), and without it MUI deliberately renders as if the query does not match on the very
 * first render to avoid an SSR hydration mismatch that cannot happen in this app - which would
 * otherwise flash the mobile layout for one frame on every load.
 */
export function useBreakpoint(): Layout {
  const isTabletPortraitUp = useMediaQuery(theme.breakpoints.up('sm'), { noSsr: true });
  const isTabletLandscapeUp = useMediaQuery(theme.breakpoints.up('md'), { noSsr: true });
  const isLaptopUp = useMediaQuery(theme.breakpoints.up('lg'), { noSsr: true });

  if (isLaptopUp) return 'laptop';
  if (isTabletLandscapeUp) return 'tabletLandscape';
  if (isTabletPortraitUp) return 'tabletPortrait';
  return 'mobile';
}
