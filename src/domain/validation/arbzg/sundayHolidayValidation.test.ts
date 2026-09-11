import { describe, it, expect } from 'vitest';
import type { EmployeeId } from '@domain/shared/ids';
import { validateSundayHolidayWork } from './sundayHolidayValidation';

const context = { employeeId: 'm1' as EmployeeId };
const notHoliday = () => false;
const isHoliday = () => true;

describe('validateSundayHolidayWork', () => {
  it('gives no result for a weekday that is neither Sunday nor a holiday', () => {
    const results = validateSundayHolidayWork(
      '2026-09-07',
      'Montag',
      { allowedOpenSundays: [] },
      notHoliday,
      context,
    );
    expect(results).toHaveLength(0);
  });

  it('warns about Sunday work when the date is not an allowed open Sunday', () => {
    const results = validateSundayHolidayWork(
      '2026-09-06',
      'Sonntag',
      { allowedOpenSundays: [] },
      notHoliday,
      context,
    );
    expect(results).toHaveLength(1);
    expect(results[0].rule).toBe('Sonntagsarbeit');
    expect(results[0].severity).toBe('warning');
  });

  it('gives no Sonntagsarbeit warning when the date is an allowed open Sunday', () => {
    const results = validateSundayHolidayWork(
      '2026-09-06',
      'Sonntag',
      { allowedOpenSundays: ['2026-09-06'] },
      notHoliday,
      context,
    );
    expect(results).toHaveLength(0);
  });

  it('warns about holiday work independent of the weekday', () => {
    const results = validateSundayHolidayWork(
      '2026-10-03',
      'Samstag',
      { allowedOpenSundays: [] },
      isHoliday,
      context,
    );
    expect(results).toHaveLength(1);
    expect(results[0].rule).toBe('Feiertagsarbeit');
    expect(results[0].severity).toBe('warning');
  });

  it('reports both warnings when a Sunday is also a holiday and not open', () => {
    const results = validateSundayHolidayWork(
      '2026-12-06',
      'Sonntag',
      { allowedOpenSundays: [] },
      isHoliday,
      context,
    );
    expect(results).toHaveLength(2);
    expect(results.map((r) => r.rule)).toEqual(['Sonntagsarbeit', 'Feiertagsarbeit']);
  });

  it('attaches the employeeId and date to every result', () => {
    const [result] = validateSundayHolidayWork(
      '2026-09-06',
      'Sonntag',
      { allowedOpenSundays: [] },
      notHoliday,
      context,
    );
    expect(result.employeeId).toBe('m1');
    expect(result.date).toBe('2026-09-06');
  });
});

describe('Meldungstexte (deutsche Schreibweise)', () => {
  it('pins the Sonntagsarbeit and Feiertagsarbeit message texts', () => {
    const [sonntag] = validateSundayHolidayWork(
      '2026-09-06',
      'Sonntag',
      { allowedOpenSundays: [] },
      notHoliday,
      context,
    );
    expect(sonntag.message).toBe(
      'Sonntagsarbeit außerhalb eines verkaufsoffenen Sonntags geplant. Bitte rechtliche Zulässigkeit nach Landesrecht prüfen.',
    );

    const [feiertag] = validateSundayHolidayWork(
      '2026-10-03',
      'Samstag',
      { allowedOpenSundays: [] },
      isHoliday,
      context,
    );
    expect(feiertag.message).toBe('Arbeit an einem gesetzlichen Feiertag geplant.');
  });
});
