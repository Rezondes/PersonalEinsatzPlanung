import { describe, it, expect } from 'vitest';
import { isMinor } from './youthProtection';

describe('isMinor', () => {
  it('returns null when the birth date is unknown', () => {
    expect(isMinor(undefined, new Date('2026-09-07'))).toBeNull();
  });

  it('returns true the day before the 18th birthday', () => {
    expect(isMinor('2008-09-08', new Date('2026-09-07'))).toBe(true);
  });

  it('returns false on the 18th birthday itself', () => {
    expect(isMinor('2008-09-07', new Date('2026-09-07'))).toBe(false);
  });

  it('returns false well past the 18th birthday', () => {
    expect(isMinor('1990-01-01', new Date('2026-09-07'))).toBe(false);
  });
});
