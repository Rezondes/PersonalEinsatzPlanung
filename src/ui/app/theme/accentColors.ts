export type AccentColorKey = 'gruen' | 'blau' | 'lila' | 'orange' | 'petrol' | 'senfgelb';

export interface AccentSurfaceTints {
  subtle: string;
  strong: string;
  pressed: string;
}

export interface AccentColorDefinition {
  /** Light-mode foreground (nav text, focus outlines, icons). */
  main: string;
  /** Dark-mode foreground - a lightened tone of `main`, not `main` reused verbatim: see the
   * contrast note on ACCENT_COLORS below. */
  mainDark: string;
  /** Mode-stable fill for solid-background-with-white-text spots (ScheduleToolbar's
   * assign/selection banners and its active Chip) - always equal to `main`, exposed separately
   * because it must NOT switch to `mainDark` in dark mode the way `main` does. */
  dark: string;
  surfaceLight: AccentSurfaceTints;
  surfaceDark: AccentSurfaceTints;
}

/**
 * The six curated accent colors a user can pick in Einstellungen (see SettingsView.tsx). `gruen`
 * is the original, only color that existed before this picker - its values are copied verbatim
 * from Package 1/2's theme.ts centralization, not recomputed, so picking it (the default) changes
 * nothing for an existing user.
 *
 * The other five were derived from their given `main` hex by measuring the light/dark tint recipe
 * (hue held fixed per color, saturation/lightness targets) already shipped for gruen, then
 * re-applying those same targets to each color's own hue - see the conversation this was built in
 * for the derivation. Every `mainDark` clears 4.5:1 (WCAG AA) against both dark backgrounds
 * (`#121212`/`#1e1e1e`) with margin (5.9:1-7.9:1 measured), and every `main`/`dark` clears 6:1
 * against white - calculated, not yet cross-checked with a real contrast tool (plan AC5).
 */
export const ACCENT_COLORS: Record<AccentColorKey, AccentColorDefinition> = {
  gruen: {
    main: '#2f5d50',
    mainDark: '#8da69f',
    dark: '#2f5d50',
    surfaceLight: { subtle: '#eef3f1', strong: '#dce9e3', pressed: '#e0e8e5' },
    surfaceDark: { subtle: '#1b2a24', strong: '#21382e', pressed: '#294636' },
  },
  blau: {
    main: '#2c5a80',
    mainDark: '#94a2ad',
    dark: '#2c5a80',
    surfaceLight: { subtle: '#edf0f2', strong: '#d9e1e7', pressed: '#dfe3e7' },
    surfaceDark: { subtle: '#1c242c', strong: '#222f3a', pressed: '#2a3947' },
  },
  lila: {
    main: '#664080',
    mainDark: '#a394ad',
    dark: '#664080',
    surfaceLight: { subtle: '#f0edf2', strong: '#e2d9e7', pressed: '#e4dfe7' },
    surfaceDark: { subtle: '#251c2c', strong: '#30223a', pressed: '#3b2a47' },
  },
  orange: {
    main: '#7d4419',
    mainDark: '#ad9f94',
    dark: '#7d4419',
    surfaceLight: { subtle: '#f2efed', strong: '#e7dfd9', pressed: '#e7e2df' },
    surfaceDark: { subtle: '#2c231c', strong: '#3a2c22', pressed: '#47362a' },
  },
  petrol: {
    main: '#1a6b70',
    mainDark: '#94abad',
    dark: '#1a6b70',
    surfaceLight: { subtle: '#edf2f2', strong: '#d9e7e7', pressed: '#dfe7e7' },
    surfaceDark: { subtle: '#1c2b2c', strong: '#22383a', pressed: '#2a4547' },
  },
  senfgelb: {
    main: '#6b5a1a',
    mainDark: '#ada894',
    dark: '#6b5a1a',
    surfaceLight: { subtle: '#f2f1ed', strong: '#e7e4d9', pressed: '#e7e5df' },
    surfaceDark: { subtle: '#2c281c', strong: '#3a3522', pressed: '#47412a' },
  },
};
