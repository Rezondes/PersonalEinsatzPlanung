import { createTheme } from '@mui/material/styles';
import { deDE } from '@mui/material/locale';
import { SELECTABLE_SELECTOR } from './selectableText';

// The three accent-derived tints used for sticky/active surfaces (nav active row, assign-target
// cells, etc.). Hand-picked, not a computed lighten() of ACCENT_MAIN - MUI's own lighten() at the
// default tonalOffset gives a mid-green nowhere near these pale pastels, so they need their own
// named constants rather than deriving from primary.light/.dark (see accentSurface below).
const ACCENT_MAIN = '#2f5d50';
const ACCENT_SURFACE_SUBTLE = '#eef3f1';
const ACCENT_SURFACE_STRONG = '#dce9e3';
const ACCENT_SURFACE_PRESSED = '#e0e8e5';

declare module '@mui/material/styles' {
  interface Palette {
    accentSurface: { subtle: string; strong: string; pressed: string };
  }
  interface PaletteOptions {
    accentSurface?: { subtle: string; strong: string; pressed: string };
  }
}

/**
 * Custom, understated theme instead of MUI defaults: reduced elevation (no shadows), muted
 * neutral palette with one accent color, generous spacing. Goal: familiar Material interaction
 * patterns (important for non-tech-savvy users), but a calm, clean look.
 */
export const theme = createTheme(
  {
    palette: {
      mode: 'light',
      primary: { main: ACCENT_MAIN },
      // Pale accent-tinted surfaces (nav active row, assign-target cells, branch icon avatars) -
      // a distinct key from MUI's own primary.light/.dark, which Dark Mode needs to mean something
      // else entirely (a lightened foreground tone, not a pale background tint).
      accentSurface: {
        subtle: ACCENT_SURFACE_SUBTLE,
        strong: ACCENT_SURFACE_STRONG,
        pressed: ACCENT_SURFACE_PRESSED,
      },
      background: { default: '#f7f7f5', paper: '#ffffff' },
      error: { main: '#b3261e' },
      warning: { main: '#8a5a00' },
      success: { main: '#2f6b3f' },
    },
    // `breakpoints.up('sm')` is the one threshold `hooks/useBreakpoint.ts` reads (mobile below it,
    // tablet at and above) - kept here instead of a raw pixel value scattered through the app.
    // md/lg/xl are otherwise unused by the two-tier layout model; xl is kept equal to lg only so
    // AppShell's Container maxWidth="xl" keeps its existing effective cap, and MUI logs a dev-mode
    // warning if breakpoint values aren't ascending.
    breakpoints: {
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
          '.pep-nav-link:active': { backgroundColor: ACCENT_SURFACE_PRESSED },
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
      // The app is touch-first everywhere now: every icon-only button needs a real 44x44 hit
      // target, not just its visible icon size.
      MuiIconButton: {
        styleOverrides: {
          root: { minWidth: 44, minHeight: 44 },
        },
      },
    },
  },
  deDE,
);
