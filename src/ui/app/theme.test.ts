import { describe, it, expect } from 'vitest';
import { theme, createAppTheme, DESKTOP_LAYOUT_MIN_WIDTH } from './theme';

describe('theme', () => {
  it('exposes the accent color and its tints as named palette tokens', () => {
    expect(theme.palette.primary.main).toBe('#2f5d50');
    expect(theme.palette.accentSurface).toEqual({
      subtle: '#eef3f1',
      strong: '#dce9e3',
      pressed: '#e0e8e5',
    });
  });
});

describe('createAppTheme', () => {
  it('resolves light mode with the light-mode accent color', () => {
    const result = createAppTheme({ mode: 'light', prefersDark: false });

    expect(result.palette.mode).toBe('light');
    expect(result.palette.primary.main).toBe('#2f5d50');
  });

  it('resolves dark mode with a lightened accent color, not the light-mode value reused verbatim', () => {
    const result = createAppTheme({ mode: 'dark', prefersDark: false });

    expect(result.palette.mode).toBe('dark');
    expect(result.palette.primary.main).not.toBe('#2f5d50');
  });

  it('resolves "system" to dark when the OS prefers dark', () => {
    const result = createAppTheme({ mode: 'system', prefersDark: true });

    expect(result.palette.mode).toBe('dark');
  });

  it('resolves "system" to light when the OS does not prefer dark', () => {
    const result = createAppTheme({ mode: 'system', prefersDark: false });

    expect(result.palette.mode).toBe('light');
  });

  it('keeps primary.dark at the original accent color in every mode, for solid-fill-with-white-text spots', () => {
    expect(createAppTheme({ mode: 'light', prefersDark: false }).palette.primary.dark).toBe('#2f5d50');
    expect(createAppTheme({ mode: 'dark', prefersDark: false }).palette.primary.dark).toBe('#2f5d50');
  });

  it('defaults to gruen when accentColor is omitted, unchanged from before the color picker existed', () => {
    const result = createAppTheme({ mode: 'light', prefersDark: false });

    expect(result.palette.primary.main).toBe('#2f5d50');
  });

  it('resolves a different accentColor into primary/accentSurface, in both light and dark mode', () => {
    const light = createAppTheme({ mode: 'light', prefersDark: false, accentColor: 'blau' });
    const dark = createAppTheme({ mode: 'dark', prefersDark: false, accentColor: 'blau' });

    expect(light.palette.primary.main).toBe('#2c5a80');
    expect(light.palette.primary.dark).toBe('#2c5a80');
    expect(dark.palette.primary.main).not.toBe('#2c5a80');
    expect(dark.palette.primary.main).not.toBe(light.palette.primary.main);
    expect(dark.palette.primary.dark).toBe('#2c5a80');
  });

  it('keeps error/warning/success at their existing light-mode values in light mode', () => {
    const result = createAppTheme({ mode: 'light', prefersDark: false });

    expect(result.palette.error.main).toBe('#b3261e');
    expect(result.palette.warning.main).toBe('#8a5a00');
    expect(result.palette.success.main).toBe('#2f6b3f');
  });

  it('lightens error/warning/success in dark mode, not the light-mode values reused verbatim', () => {
    const light = createAppTheme({ mode: 'light', prefersDark: false });
    const dark = createAppTheme({ mode: 'dark', prefersDark: false });

    expect(dark.palette.error.main).not.toBe(light.palette.error.main);
    expect(dark.palette.warning.main).not.toBe(light.palette.warning.main);
    expect(dark.palette.success.main).not.toBe(light.palette.success.main);
  });

  it('exposes errorSurface/warningSurface tints matching the existing shipped light-mode literals', () => {
    const result = createAppTheme({ mode: 'light', prefersDark: false });

    expect(result.palette.errorSurface).toEqual({ subtle: '#fbeaea', border: '#e5a3a0' });
    expect(result.palette.warningSurface).toEqual({ subtle: '#fdf3e0', border: '#e6c988' });
  });

  it('gives errorSurface/warningSurface their own dark-mode tints, not the light-mode ones reused verbatim', () => {
    const light = createAppTheme({ mode: 'light', prefersDark: false });
    const dark = createAppTheme({ mode: 'dark', prefersDark: false });

    expect(dark.palette.errorSurface).not.toEqual(light.palette.errorSurface);
    expect(dark.palette.warningSurface).not.toEqual(light.palette.warningSurface);
  });

  it('gibt im Light Mode eine MuiButtonBase-Fokus-Regel mit der hellen Akzentfarbe zurück', () => {
    const result = createAppTheme({ mode: 'light', prefersDark: false });

    expect(result.components?.MuiButtonBase?.styleOverrides?.root).toMatchObject({
      '&:focus-visible': { outline: '2px solid #2f5d50', outlineOffset: 2 },
    });
  });

  it('gibt im Dark Mode dieselbe Regel mit der dunklen Akzentfarbe zurück', () => {
    const result = createAppTheme({ mode: 'dark', prefersDark: false });

    expect(result.components?.MuiButtonBase?.styleOverrides?.root).toMatchObject({
      '&:focus-visible': { outline: '2px solid #8da69f', outlineOffset: 2 },
    });
  });

  it('divider erreicht im Light Mode mindestens 3:1 gegen die Paper-Fläche', () => {
    const result = createAppTheme({ mode: 'light', prefersDark: false });

    expect(result.palette.divider).toBe('#949490');
  });

  it('divider erreicht im Dark Mode mindestens 3:1 gegen die Paper-Fläche', () => {
    const result = createAppTheme({ mode: 'dark', prefersDark: false });

    expect(result.palette.divider).toBe('#6a6a66');
  });

  it('inactiveSurface hat einen eigenen Hex-Wert pro Modus', () => {
    const light = createAppTheme({ mode: 'light', prefersDark: false });
    const dark = createAppTheme({ mode: 'dark', prefersDark: false });

    expect(light.palette.inactiveSurface).toBe('#efefec');
    expect(dark.palette.inactiveSurface).toBe('#242422');
  });
});

// Teil 6, Package 2: nothing respected the OS "reduce motion" setting before.
describe('createAppTheme, prefers-reduced-motion', () => {
  const REDUCE = '@media (prefers-reduced-motion: reduce)';

  for (const mode of ['light', 'dark'] as const) {
    it(`schaltet Übergänge und Animationen im ${mode}-Theme ab`, () => {
      const overrides = createAppTheme({ mode, prefersDark: false }).components?.MuiCssBaseline?.styleOverrides as Record<
        string,
        Record<string, Record<string, string>>
      >;

      const rule = overrides[REDUCE]['*, *::before, *::after'];
      expect(rule.transitionDuration).toBe('0.01ms !important');
      expect(rule.animationDuration).toBe('0.01ms !important');
      expect(rule.animationIterationCount).toBe('1 !important');
      expect(rule.scrollBehavior).toBe('auto !important');
    });
  }
});

// Teil 6, Package 3: on the phone UI buttons were 31-37px tall (IconButton already had 44px).
describe('createAppTheme, 44px touch targets on the phone UI', () => {
  const appTheme = createAppTheme({ mode: 'light', prefersDark: false });
  const phoneQuery = appTheme.breakpoints.down(DESKTOP_LAYOUT_MIN_WIDTH);
  const rootStyle = (component: 'MuiButton' | 'MuiToggleButton') => {
    const root = appTheme.components?.[component]?.styleOverrides?.root as (props: { theme: typeof appTheme }) => Record<string, unknown>;
    return root({ theme: appTheme });
  };

  for (const component of ['MuiButton', 'MuiToggleButton'] as const) {
    it(`${component} is at least 44px tall below the desktop breakpoint, and only there`, () => {
      const style = rootStyle(component);

      expect(style[phoneQuery]).toEqual({ minHeight: 44 });
      expect(style.minHeight).toBeUndefined();
    });
  }
});
