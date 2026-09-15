import { describe, it, expect } from 'vitest';
import { theme, createAppTheme } from './theme';

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
});
