import { describe, it, expect } from 'vitest';
import { ACCENT_COLORS } from './accentColors';

const HEX = /^#[0-9a-f]{6}$/;

describe('ACCENT_COLORS', () => {
  it('has exactly the six curated keys', () => {
    expect(Object.keys(ACCENT_COLORS)).toEqual(['gruen', 'blau', 'lila', 'orange', 'petrol', 'senfgelb']);
  });

  it('gives every entry a valid hex value for each of its own and its nested tint fields', () => {
    for (const definition of Object.values(ACCENT_COLORS)) {
      expect(definition.main).toMatch(HEX);
      expect(definition.mainDark).toMatch(HEX);
      expect(definition.dark).toMatch(HEX);
      for (const tints of [definition.surfaceLight, definition.surfaceDark]) {
        expect(tints.subtle).toMatch(HEX);
        expect(tints.strong).toMatch(HEX);
        expect(tints.pressed).toMatch(HEX);
      }
    }
  });

  it('keeps gruen identical to the values Package 1 already centralized into theme.ts', () => {
    expect(ACCENT_COLORS.gruen.main).toBe('#2f5d50');
    expect(ACCENT_COLORS.gruen.surfaceLight).toEqual({
      subtle: '#eef3f1',
      strong: '#dce9e3',
      pressed: '#e0e8e5',
    });
  });
});
