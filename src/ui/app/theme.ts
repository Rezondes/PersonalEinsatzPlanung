import { createTheme, darken } from '@mui/material/styles';
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
// WCAG 1.4.11 (non-text contrast) requires >=3:1 against the paper it borders; the previous
// literals measured only ~1.32:1 (light vs #ffffff) / ~1.46:1 (dark vs #1e1e1e). These keep the
// original hue and clear 3:1 with a small margin (3.04:1 / 3.07:1 measured).
const DIVIDER_LIGHT = '#949490';
const DIVIDER_DARK = '#6a6a66';

// The one threshold `hooks/useBreakpoint.ts` reads (Handy-UI below it, Desktop-UI at and above) -
// a dedicated constant rather than one of breakpoints.values below, since sm/md/lg/xl there are
// MUI's own Dialog/Container maxWidth presets (see the comment at breakpoints.values) and must
// keep their own values. theme.breakpoints.up() accepts a raw pixel number directly (falls back to
// it when the argument isn't a known breakpoints.values key), so this needs no entry there.
export const DESKTOP_LAYOUT_MIN_WIDTH = 1025;

// ScheduleTable.tsx's locked-cell (outside an employee's employment period) background - the exact
// literals already shipped in light mode; dark value keeps the same "barely-there" relationship to
// background.default that the light value has to its own light background.default.
const LOCKED_SURFACE_LIGHT = '#f0f0ee';
const LOCKED_SURFACE_DARK = '#1c1c1a';

// Background for a row/card marked "inactive" (employee/branch deactivated, or a schedule row
// outside someone's employment period) - replaces the old opacity: 0.55 dimming, which pushed
// text.secondary's already-transparent color well under 4.5:1. text.secondary alone clears AA
// against both of these with margin (5.5:1 light, 8.3:1 dark - measured including its own alpha).
const INACTIVE_SURFACE_LIGHT = '#efefec';
const INACTIVE_SURFACE_DARK = '#242422';

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
    lockedSurface: string;
    inactiveSurface: string;
  }
  interface PaletteOptions {
    accentSurface?: { subtle: string; strong: string; pressed: string };
    errorSurface?: { subtle: string; border: string };
    warningSurface?: { subtle: string; border: string };
    lockedSurface?: string;
    inactiveSurface?: string;
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
  const lockedSurface = isDark ? LOCKED_SURFACE_DARK : LOCKED_SURFACE_LIGHT;
  const inactiveSurface = isDark ? INACTIVE_SURFACE_DARK : INACTIVE_SURFACE_LIGHT;
  // A filled Alert paints its background from `.dark` in dark mode (MUI's Alert.js: `mode === 'dark'
  // ? palette[color].dark : palette[color].main`), auto-derived as darken(main, 0.3) when unset. In
  // dark mode `.main` is deliberately the lightened text/icon tone from the comment above, so that
  // auto-derivation produces a muddy background. Pin `.dark` to the light-mode tone (already proven
  // to pair with white text there) for dark mode only - same "solid fill that must NOT follow the
  // mode-adjusted lighten-for-dark-mode logic" contract as accent.dark. This does NOT fix the
  // Alert's text color: Alert.js always recomputes it as getContrastText(palette[color].main)
  // regardless of mode or an explicit contrastText, so a `contrastText` field here would be silently
  // ignored by Alert - the components.MuiAlert override below covers the text side instead.
  const errorDarkFill = isDark ? { dark: ERROR_MAIN_LIGHT } : {};
  const warningDarkFill = isDark ? { dark: WARNING_MAIN_LIGHT } : {};
  const successDarkFill = isDark ? { dark: SUCCESS_MAIN_LIGHT } : {};

  return createTheme(
    {
      palette: {
        mode,
        primary: { main: accentMain, dark: accent.dark },
        accentSurface,
        errorSurface,
        warningSurface,
        lockedSurface,
        inactiveSurface,
        divider,
        background: isDark ? { default: '#121212', paper: '#1e1e1e' } : { default: '#f7f7f5', paper: '#ffffff' },
        error: { main: errorMain, ...errorDarkFill },
        warning: { main: warningMain, ...warningDarkFill },
        success: { main: successMain, ...successDarkFill },
        // MUI's default info blue (#0288d1) under white text is only 3.86:1 (update and install
        // banners). Dark mode keeps MUI's own lighter info tone, which pairs with dark text.
        ...(!isDark && { info: { main: '#01579b' } }),
      },
      // sm/md/lg/xl stay MUI's own Dialog/Container maxWidth presets (Dialog maxWidth="sm"/"md"
      // reads theme.breakpoints.values.sm/md directly - node_modules/@mui/material/Dialog/Dialog.js -
      // so repurposing one of them for the mobile/desktop split would silently resize every Dialog
      // using that preset, e.g. DayEditor's maxWidth="sm"). xl is kept equal to lg only so
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
            // AppShell focuses a page's h1 after a page change (tabindex=-1). That is for screen
            // readers only: no ring for it, but a real keyboard focus still shows one.
            'h1[tabindex="-1"]:focus:not(:focus-visible)': { outline: 'none' },
            // Honours the OS "reduce motion" setting for every MUI transition (dialog slide-up,
            // sheets, Collapse, tab colours) in one place. 0.01ms rather than 0: with 0 some
            // browsers fire no transitionend, and code waiting for it would hang.
            '@media (prefers-reduced-motion: reduce)': {
              '*, *::before, *::after': {
                animationDuration: '0.01ms !important',
                animationIterationCount: '1 !important',
                transitionDuration: '0.01ms !important',
                scrollBehavior: 'auto !important',
              },
            },
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
        // Phone UI only: 44px, the touch size MuiIconButton already has below. Buttons were 37px
        // (31px with size="small"); desktop stays compact.
        MuiButton: {
          defaultProps: { disableElevation: true },
          styleOverrides: {
            root: ({ theme, ownerState }) => {
              const color = ownerState?.color;
              const palette =
                color && color !== 'inherit' ? (theme.palette as unknown as Record<string, { main: string }>)[color] : undefined;
              return {
                [theme.breakpoints.down(DESKTOP_LAYOUT_MIN_WIDTH)]: { minHeight: 44 },
                // A filled button hovers to palette[color].dark but keeps its text colour. In dark
                // mode `.dark` is pinned to the dark light-mode tone (for Alerts, see above), so
                // black text sat on it at ~2.7:1. Hover slightly darker than `.main` instead.
                ...(isDark &&
                  ownerState?.variant === 'contained' &&
                  palette && { '&:hover': { backgroundColor: darken(palette.main, 0.1) } }),
              };
            },
          },
        },
        MuiToggleButton: {
          styleOverrides: {
            root: ({ theme }) => ({ [theme.breakpoints.down(DESKTOP_LAYOUT_MIN_WIDTH)]: { minHeight: 44 } }),
          },
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
        // Common base of IconButton/Button/Fab/ToggleButton/ListItemButton/BottomNavigationAction -
        // one rule here covers every keyboard focus ring app-wide, instead of relying on each of the
        // ~9 hand-rolled '&:focus-visible' overrides already scattered across the views.
        MuiButtonBase: {
          styleOverrides: {
            root: {
              '&:focus-visible': { outline: `2px solid ${accentMain}`, outlineOffset: 2 },
            },
          },
        },
        // Companion to errorDarkFill/warningDarkFill/successDarkFill above: a filled Alert's text
        // color is always getContrastText(palette[color].main), which in dark mode picks black
        // because `.main` is the lightened text/icon tone, not the saturated `.dark` background the
        // Alert actually paints - fix the text side directly since the palette can't express it.
        ...(isDark && {
          MuiAlert: {
            styleOverrides: {
              filledError: { color: '#ffffff' },
              filledWarning: { color: '#ffffff' },
              filledSuccess: { color: '#ffffff' },
            },
          },
        }),
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
