import { describe, it, expect } from 'vitest';
import { formatMonthParam, formatWeekParam, parseMonthParam, parseWeekParam } from './weekSearchParam';

describe('week search param', () => {
  it('formats and parses a week without loss, week always two digits', () => {
    expect(formatWeekParam({ year: 2026, week: 9 })).toBe('2026-09');
    expect(parseWeekParam('2026-09')).toEqual({ year: 2026, week: 9 });
    expect(parseWeekParam(formatWeekParam({ year: 2026, week: 42 }))).toEqual({ year: 2026, week: 42 });
  });

  it('accepts week 53 only in a year that has one', () => {
    expect(parseWeekParam('2026-53')).toEqual({ year: 2026, week: 53 });
    expect(parseWeekParam('2027-53')).toBeNull();
  });

  it('rejects anything that is not a real ISO week', () => {
    for (const value of ['2026-60', '2026-00', '2026-9', 'abc', '', null]) {
      expect(parseWeekParam(value)).toBeNull();
    }
  });
});

describe('month search param', () => {
  it('formats and parses a month without loss', () => {
    expect(formatMonthParam(2027, 3)).toBe('2027-03');
    expect(parseMonthParam('2027-03')).toEqual({ year: 2027, month: 3 });
  });

  it('rejects anything that is not a real month', () => {
    for (const value of ['2027-13', '2027-00', '2027-3', 'abc', '', null]) {
      expect(parseMonthParam(value)).toBeNull();
    }
  });
});
