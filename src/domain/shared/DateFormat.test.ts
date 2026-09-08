import { describe, it, expect } from 'vitest';
import { formatDateGerman, formatISODateGerman, toISODate } from './DateFormat';

describe('formatDateGerman', () => {
  it('formats as DD.MM.YYYY with leading zeros', () => {
    expect(formatDateGerman(new Date(2026, 8, 7))).toBe('07.09.2026');
  });

  it('formats a two-digit day/month without extra zeros', () => {
    expect(formatDateGerman(new Date(2026, 11, 25))).toBe('25.12.2026');
  });
});

describe('formatISODateGerman', () => {
  it('converts YYYY-MM-DD into DD.MM.YYYY', () => {
    expect(formatISODateGerman('2026-09-07')).toBe('07.09.2026');
  });

  it('is consistent with toISODate + formatDateGerman', () => {
    const date = new Date(2026, 0, 3);
    expect(formatISODateGerman(toISODate(date))).toBe(formatDateGerman(date));
  });
});
