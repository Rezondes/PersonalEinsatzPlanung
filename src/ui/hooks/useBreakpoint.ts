import useMediaQuery from '@mui/material/useMediaQuery';
import { theme, DESKTOP_LAYOUT_MIN_WIDTH } from '@ui/app/theme';

export type Layout = 'mobile' | 'tablet';

/**
 * The single source of truth for "which of the two responsive-design device classes is this?"
 * (Handy / Desktop - the 'tablet' return value's name predates the 1025px threshold and now
 * means "Desktop-UI", not a separate tablet tier; a tablet in the 768-1024px range gets the
 * Handy-UI). Every structural decision that depends on viewport width - AppShell's nav chrome,
 * dialog-vs-full-screen-sheet, table density - reads this one hook instead of a bespoke
 * `useMediaQuery` call, so those choices can never independently drift out of sync.
 *
 * `noSsr: true` matters here specifically: this is a pure client-rendered SPA (no SSR anywhere in
 * the stack), and without it MUI deliberately renders as if the query does not match on the very
 * first render to avoid an SSR hydration mismatch that cannot happen in this app - which would
 * otherwise flash the mobile layout for one frame on every load.
 */
export function useBreakpoint(): Layout {
  const isDesktop = useMediaQuery(theme.breakpoints.up(DESKTOP_LAYOUT_MIN_WIDTH), { noSsr: true });

  return isDesktop ? 'tablet' : 'mobile';
}

/** At or below this height a phone is being held sideways (360-430px on common phones); tablets in
 * landscape stay above it (>= 600px). */
export const SHORT_VIEWPORT_MAX_HEIGHT = 500;

/**
 * True when the viewport is too short for fixed chrome plus a bounded, self-scrolling region - a
 * phone held sideways. There the app header, tab bar and "Weitere Aktionen" bar alone take half the
 * height, so AppShell lets full-bleed pages scroll as a whole instead (see AppShell/ScheduleView).
 * Same `noSsr` reasoning as useBreakpoint above.
 */
export function useIsShortViewport(): boolean {
  return useMediaQuery(`(max-height: ${SHORT_VIEWPORT_MAX_HEIGHT}px)`, { noSsr: true });
}
