import { createTheme } from '@mui/material/styles';
import type { Theme } from '@mui/material/styles';
import { deDE } from '@mui/material/locale';
import { SELECTABLE_SELECTOR } from './selectableText';
import type { ThemeMode } from './store/themeModeStore';
import { ACCENT_COLORS } from './theme/accentColors';
import type { AccentColorKey } from './theme/accentColors';

// theme.ts's own elevation-flattening border color (MuiPaper/MuiAppBar/MuiCard/MuiTableCell) -
// centralized here (not just left as a repeated literal) because dark mode needs a second value.
// NavRail.tsx and AppHeader.tsx also consume this via theme.palette.divider/background.paper now -
// both are always-visible primary chrome, so they needed the dark-mode treatment immediately rather
// than as a follow-up. Other files hardcoding this same light-mode literal for an unrelated
// "inactive/off" border semantic on individual controls (ScheduleToolbar, MorePage,
// ShiftListEditor, BottomTabBar) are deliberately left untouched for now - a known, accepted
// limitation: those borders may look slightly off in dark mode until a follow-up gives them their
// own dark-mode treatment.
const DIVIDER_LIGHT = '#e0e0dc';
const DIVIDER_DARK = '#3a3a38';

declare module '@mui/material/styles' {
  interface Palette {
    accentSurface: { subtle: string; strong: string; pressed: string };
  }
  interface PaletteOptions {
    accentSurface?: { subtle: string; strong: string; pressed: string };
  }
}

export interface CreateAppThemeOptions {
  mode: ThemeMode;
  /** Only consulted when mode === 'system' - the live OS preference (usePrefersDarkMode). */
  prefersDark: boolean;
  /** Which of the six curated colors (accentColors.ts) drives primary/accentSurface - defaults to
   * 'gruen', the only color that existed before the picker, so every call site that predates it
   * (the static `theme` export below, most existing tests) keeps working unchanged. */
  accentColor?: AccentColorKey;
}

function resolvePaletteMode(options: CreateAppThemeOptions): 'light' | 'dark' {
  return options.mode === 'system' ? (options.prefersDark ? 'dark' : 'light') : options.mode;
}

/**
 * Builds the app theme for a given appearance mode - a factory, not a single static object, since
 * dark mode needs different values for palette.mode/primary.main/accentSurface/background/divider,
 * resolved at call time from the user's stored preference (themeModeStore) and, for 'system', the
 * live OS preference. Custom, understated theme instead of MUI defaults either way: reduced
 * elevation (no shadows), muted neutral palette with one accent color, generous spacing. Goal:
 * familiar Material interaction patterns (important for non-tech-savvy users), but a calm, clean
 * look in both modes.
 */
export function createAppTheme(options: CreateAppThemeOptions): Theme {
  const mode = resolvePaletteMode(options);
  const isDark = mode === 'dark';
  const accent = ACCENT_COLORS[options.accentColor ?? 'gruen'];
  const accentMain = isDark ? accent.mainDark : accent.main;
  const accentSurface = isDark ? accent.surfaceDark : accent.surfaceLight;
  const divider = isDark ? DIVIDER_DARK : DIVIDER_LIGHT;

  return createTheme(
    {
      palette: {
        mode,
        primary: { main: accentMain, dark: accent.dark },
        accentSurface,
        divider,
        background: isDark ? { default: '#121212', paper: '#1e1e1e' } : { default: '#f7f7f5', paper: '#ffffff' },
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
            '.pep-nav-link:active': { backgroundColor: accentSurface.pressed },
          },
        },
        MuiPaper: {
          defaultProps: { elevation: 0 },
          styleOverrides: { root: { backgroundImage: 'none', border: `1px solid ${divider}` } },
        },
        MuiAppBar: {
          defaultProps: { elevation: 0 },
          styleOverrides: { root: { borderBottom: `1px solid ${divider}` } },
        },
        MuiCard: {
          defaultProps: { elevation: 0 },
          styleOverrides: { root: { border: `1px solid ${divider}` } },
        },
        MuiButton: {
          defaultProps: { disableElevation: true },
        },
        MuiTableCell: {
          styleOverrides: { root: { borderColor: divider } },
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
}

/**
 * A static, light-mode instance for the handful of consumers that only need structural fields
 * (breakpoints, transitions) rather than live palette/mode state - useBreakpoint.ts,
 * ResponsiveDialog.tsx, and tests that just need SOME theme to satisfy ThemeProvider. Never use
 * this for anything palette-related; App.tsx computes the real, live theme via createAppTheme(...)
 * from the user's stored preference and the live OS preference.
 */
export const theme = createAppTheme({ mode: 'light', prefersDark: false });
