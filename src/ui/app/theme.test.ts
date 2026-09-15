import { describe, it, expect } from 'vitest';
import { theme } from './theme';

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
