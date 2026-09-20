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
