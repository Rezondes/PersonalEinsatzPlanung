import { createTheme } from '@mui/material/styles';
import type { Theme } from '@mui/material/styles';
import { deDE } from '@mui/material/locale';
import { SELECTABLE_SELECTOR } from './selectableText';
import type { ThemeMode } from './store/themeModeStore';
import { ACCENT_COLORS } from './theme/accentColors';
import type { AccentColorKey } from './theme/accentColors';

// theme.ts's own elevation-flattening border color (MuiPaper/MuiAppBar/MuiCard/MuiTableCell) -
// centralized here (not just left as a repeated literal) because dark mode needs a second value.
// Every consumer in src/ui/ now reads this via theme.palette.divider (or the 'divider' palette-path
// string) rather than hardcoding the literal - a full audit swept the remaining stragglers
// (NavRail, AppHeader, ScheduleToolbar, MorePage, ShiftListEditor, BottomTabBar,
// RowActionSheet's #cfcfc9 drag-handle) into this one source of truth.
const DIVIDER_LIGHT = '#e0e0dc';
const DIVIDER_DARK = '#3a3a38';

// error/warning/success: same "needs a lighter foreground in dark mode" issue the accent green
// had (the light-mode values measure only ~2.6-2.9:1 against #121212/#1e1e1e as plain text/icon
// color - MUI's own Alert and contained-Button compute their own mode-safe colors from `.main`
// automatically and never needed this, but every other usage - Typography color="error", an
// outlined Button/Chip, a raw sx={{ color: 'error.main' }} - reads `.main` verbatim). Same
// hue-preserving lightening recipe as accentColors.ts's mainDark (S 13%, L 63%), verified against
// both dark backgrounds to clear 4.5:1 with margin (5.9-7.8:1 measured).
const ERROR_MAIN_LIGHT = '#b3261e';
const ERROR_MAIN_DARK = '#ad9694';
const WARNING_MAIN_LIGHT = '#8a5a00';
const WARNING_MAIN_DARK = '#ada494';
const SUCCESS_MAIN_LIGHT = '#2f6b3f';
const SUCCESS_MAIN_DARK = '#94ad9b';

// Surface tints for the ArbZG-violation cell/chip highlights (ScheduleTable.tsx, ScheduleView.tsx,
// SettingsView.tsx's danger-zone border) - previously light-mode-only literals scattered across
// those files with no dark counterpart. Light values are the exact literals already shipped
// (unchanged); dark values use the same hue, a background tint matching accentSurfaceDark.subtle's
// recipe, and a lighter/more-saturated border so it still reads against that dark background.
const ERROR_SURFACE_SUBTLE_LIGHT = '#fbeaea';
const ERROR_SURFACE_BORDER_LIGHT = '#e5a3a0';
const ERROR_SURFACE_SUBTLE_DARK = '#2c1c1c';
const ERROR_SURFACE_BORDER_DARK = '#985552';
const WARNING_SURFACE_SUBTLE_LIGHT = '#fdf3e0';
const WARNING_SURFACE_BORDER_LIGHT = '#e6c988';
const WARNING_SURFACE_SUBTLE_DARK = '#2c261c';
const WARNING_SURFACE_BORDER_DARK = '#988352';

declare module '@mui/material/styles' {
  interface Palette {
    accentSurface: { subtle: string; strong: string; pressed: string };
    errorSurface: { subtle: string; border: string };
    warningSurface: { subtle: string; border: string };
  }
  interface PaletteOptions {
    accentSurface?: { subtle: string; strong: string; pressed: string };
    errorSurface?: { subtle: string; border: string };
    warningSurface?: { subtle: string; border: string };
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
  const errorMain = isDark ? ERROR_MAIN_DARK : ERROR_MAIN_LIGHT;
  const warningMain = isDark ? WARNING_MAIN_DARK : WARNING_MAIN_LIGHT;
  const successMain = isDark ? SUCCESS_MAIN_DARK : SUCCESS_MAIN_LIGHT;
  const errorSurface = isDark
    ? { subtle: ERROR_SURFACE_SUBTLE_DARK, border: ERROR_SURFACE_BORDER_DARK }
    : { subtle: ERROR_SURFACE_SUBTLE_LIGHT, border: ERROR_SURFACE_BORDER_LIGHT };
  const warningSurface = isDark
    ? { subtle: WARNING_SURFACE_SUBTLE_DARK, border: WARNING_SURFACE_BORDER_DARK }
    : { subtle: WARNING_SURFACE_SUBTLE_LIGHT, border: WARNING_SURFACE_BORDER_LIGHT };

  return createTheme(
    {
      palette: {
        mode,
        primary: { main: accentMain, dark: accent.dark },
        accentSurface,
        errorSurface,
        warningSurface,
        divider,
        background: isDark ? { default: '#121212', paper: '#1e1e1e' } : { default: '#f7f7f5', paper: '#ffffff' },
        error: { main: errorMain },
        warning: { main: warningMain },
        success: { main: successMain },
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
