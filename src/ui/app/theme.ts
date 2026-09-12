import { createTheme } from '@mui/material/styles';
import { deDE } from '@mui/material/locale';
import { SELECTABLE_SELECTOR } from './selectableText';

/**
 * Custom, understated theme instead of MUI defaults: reduced elevation (no shadows), muted
 * neutral palette with one accent color, generous spacing. Goal: familiar Material interaction
 * patterns (important for non-tech-savvy users), but a calm, clean look.
 */
export const theme = createTheme(
  {
    palette: {
      mode: 'light',
      primary: { main: '#2f5d50' },
      background: { default: '#f7f7f5', paper: '#ffffff' },
      error: { main: '#b3261e' },
      warning: { main: '#8a5a00' },
      success: { main: '#2f6b3f' },
    },
    // Matches the four device classes of the responsive design (Handy / Tablet Hochformat /
    // Tablet Querformat / kleiner Laptop) so `breakpoints.up('sm')` reads as "tablet portrait and
    // up" everywhere, instead of scattering raw pixel values through the app. See
    // `hooks/useBreakpoint.ts`, the single place that turns these into a layout name.
    breakpoints: {
      // xl raised to match lg: MUI logs a dev-mode warning if breakpoint values aren't ascending,
      // and xl isn't used for anything of its own here besides AppShell's Container maxWidth="xl"
      // - which tablet viewports never actually reach (they're always < lg), so this has no
      // visible effect beyond keeping the two in a valid, non-warning relationship.
      values: { xs: 0, sm: 768, md: 1024, lg: 1620, xl: 1620 },
    },
    shape: { borderRadius: 8 },
    typography: {
      // "Inter Variable" ist der Familienname aus app/inter.css, wo die Schrift lokal deklariert
      // wird. Der Rest ist die Notfallkette, falls die Datei einmal nicht laedt.
      fontFamily: '"Inter Variable", "Inter", "Roboto", "Helvetica", "Arial", sans-serif',
      button: { textTransform: 'none', fontWeight: 500 },
    },
    components: {
      /**
       * What makes this feel like an app rather than a web page. CssBaseline is mounted in
       * App.tsx above the router, so these rules also reach the print route, which lives outside
       * AppShell.
       */
      MuiCssBaseline: {
        styleOverrides: {
          html: {
            // Stops Chrome's pull-to-refresh from reloading the whole app mid-entry. It has to sit
            // on html: the scrolling root is documentElement, and Chrome only propagates body's
            // value to the viewport under conditions that do not hold here.
            overscrollBehaviorY: 'contain',
            // Removes the double-tap-to-zoom delay. NEVER 'none' - that would kill sideways
            // scrolling on the wide weekly table and on the tool palette.
            touchAction: 'manipulation',
            WebkitTapHighlightColor: 'transparent',
          },
          body: {
            overscrollBehaviorY: 'contain',
            userSelect: 'none',
            WebkitUserSelect: 'none',
            // The iOS counterpart of the context menu (long press).
            WebkitTouchCallout: 'none',
          },
          // The opt-out, see app/selectableText.ts. Both the prefixed and unprefixed property are
          // required, and the value must be 'text', not 'auto': on iOS Safari 'auto' can resolve
          // back to the inherited 'none', which leaves text fields impossible to type into.
          [SELECTABLE_SELECTOR]: {
            userSelect: 'text',
            WebkitUserSelect: 'text',
            WebkitTouchCallout: 'default',
          },
          // Prose we deliberately released reads as selectable before the user tries.
          '[data-selectable]': { cursor: 'text' },
          // Replaces the tap highlight we just removed; see NAV_LINK_CLASS in app/nav/navLinkStyle.ts.
          '.pep-nav-link:active': { backgroundColor: '#e0e8e5' },
        },
      },
      MuiPaper: {
        defaultProps: { elevation: 0 },
        styleOverrides: { root: { backgroundImage: 'none', border: '1px solid #e0e0dc' } },
      },
      MuiAppBar: {
        defaultProps: { elevation: 0 },
        styleOverrides: { root: { borderBottom: '1px solid #e0e0dc' } },
      },
      MuiCard: {
        defaultProps: { elevation: 0 },
        styleOverrides: { root: { border: '1px solid #e0e0dc' } },
      },
      MuiButton: {
        defaultProps: { disableElevation: true },
      },
      MuiTableCell: {
        styleOverrides: { root: { borderColor: '#ececeb' } },
      },
      // Below `lg` (1620px, the "Desktop" breakpoint and up) the app is touch-first: every
      // icon-only button needs a real 44x44 hit target, not just its visible icon size. Scoped to
      // `down('lg')` rather than applied everywhere, so the existing dense desktop toolbars (e.g.
      // ScheduleView's undo/redo row) keep their current, deliberately compact sizing.
      MuiIconButton: {
        styleOverrides: {
          root: ({ theme }) => ({
            [theme.breakpoints.down('lg')]: { minWidth: 44, minHeight: 44 },
          }),
        },
      },
    },
  },
  deDE,
);
