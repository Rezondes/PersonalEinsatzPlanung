import useMediaQuery from '@mui/material/useMediaQuery';
import { theme } from '@ui/app/theme';

export type Layout = 'mobile' | 'tablet';

/**
 * The single source of truth for "which of the two responsive-design device classes is this?"
 * (Handy / Tablet, matching `theme.breakpoints.values`). Every structural decision that depends
 * on viewport width - AppShell's nav chrome, dialog-vs-full-screen-sheet, table density - reads
 * this one hook instead of a bespoke `useMediaQuery` call, so those choices can never
 * independently drift out of sync.
 *
 * `noSsr: true` matters here specifically: this is a pure client-rendered SPA (no SSR anywhere in
 * the stack), and without it MUI deliberately renders as if the query does not match on the very
 * first render to avoid an SSR hydration mismatch that cannot happen in this app - which would
 * otherwise flash the mobile layout for one frame on every load.
 */
export function useBreakpoint(): Layout {
  const isTabletUp = useMediaQuery(theme.breakpoints.up('sm'), { noSsr: true });

  return isTabletUp ? 'tablet' : 'mobile';
}
