import { describe, it, expect } from 'vitest';
import { formatDatumDeutsch, formatISODatumDeutsch, toISODatum } from './Zeitspanne';

describe('formatDatumDeutsch', () => {
  it('formatiert als DD.MM.YYYY mit führenden Nullen', () => {
    expect(formatDatumDeutsch(new Date(2026, 8, 7))).toBe('07.09.2026');
  });

  it('formatiert einen zweistelligen Tag/Monat ohne zusätzliche Nullen', () => {
    expect(formatDatumDeutsch(new Date(2026, 11, 25))).toBe('25.12.2026');
  });
});

describe('formatISODatumDeutsch', () => {
  it('wandelt YYYY-MM-DD in DD.MM.YYYY um', () => {
    expect(formatISODatumDeutsch('2026-09-07')).toBe('07.09.2026');
  });

  it('ist konsistent mit toISODatum + formatDatumDeutsch', () => {
    const datum = new Date(2026, 0, 3);
    expect(formatISODatumDeutsch(toISODatum(datum))).toBe(formatDatumDeutsch(datum));
  });
});
