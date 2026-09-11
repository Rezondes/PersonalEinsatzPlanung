import { describe, it, expect } from 'vitest';
import { formatDateShort, formatHours } from './printFormat';

describe('formatDateShort', () => {
  it('zero-pads a single-digit day and month', () => {
    expect(formatDateShort(new Date(2026, 0, 5))).toBe('05.01.');
  });

  it('does not pad a double-digit day and month', () => {
    expect(formatDateShort(new Date(2026, 11, 25))).toBe('25.12.');
  });

  it('never includes the year across a year boundary', () => {
    expect(formatDateShort(new Date(2025, 11, 31))).toBe('31.12.');
    expect(formatDateShort(new Date(2026, 0, 1))).toBe('01.01.');
  });
});

describe('formatHours', () => {
  it('formats a whole number with two decimal places', () => {
    expect(formatHours(7)).toBe('7,00');
  });

  it('rounds to two decimal places', () => {
    expect(formatHours(7.333)).toBe('7,33');
  });

  it('formats zero', () => {
    expect(formatHours(0)).toBe('0,00');
  });
});
