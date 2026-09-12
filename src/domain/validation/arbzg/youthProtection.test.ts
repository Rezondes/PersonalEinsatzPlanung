import { describe, it, expect } from 'vitest';
import { clockTime } from '@domain/shared/ClockTime';
import { createShift } from '@domain/schedule/Shift';
import { createBreak } from '@domain/schedule/Break';
import type { EmployeeId } from '@domain/shared/ids';
import { shiftToDated } from './restPeriodValidation';
import {
  isMinor,
  validateYouthDailyWorkingTime,
  validateYouthWeeklyWorkingTime,
  validateYouthBreaks,
  validateYouthShiftSpan,
  validateYouthNightWork,
  validateYouthSundayWork,
  validateYouthRestPeriodSequence,
} from './youthProtection';

const m1 = 'm1' as EmployeeId;
const minor = '2010-05-01'; // turns 18 on 2028-05-01
const adult = '1990-05-01';

describe('isMinor', () => {
  it('is true the day before the 18th birthday and false on/after it', () => {
    expect(isMinor(minor, new Date(2028, 3, 30))).toBe(true);
    expect(isMinor(minor, new Date(2028, 4, 1))).toBe(false);
  });

  it('parses the ISO birth date as local midnight, not UTC (regression: new Date(birthDate) drifted a day west of Greenwich)', () => {
    // Someone born 2010-05-01 turns 18 at local midnight on 2028-05-01. A reference date of
    // 2028-05-01 local midnight must already read as an adult - new Date('2010-05-01') parses as
    // UTC midnight, which east of Greenwich is already later the same local day and would not
    // reproduce this, but west of Greenwich (or via differenceInYears' own UTC-vs-local handling)
    // the two parsers can disagree by a day. Asserting the parseISO (local) answer here pins the
    // correct, timezone-independent behavior.
    const referenceDate = new Date(2028, 4, 1, 0, 0, 0);
    expect(isMinor(minor, referenceDate)).toBe(false);
  });

  it('returns null when the birth date is unknown', () => {
    expect(isMinor(undefined, new Date())).toBeNull();
  });
});

describe('validateYouthDailyWorkingTime', () => {
  it('errors for a minor over 8h net, not for an identical adult', () => {
    const context = { employeeId: m1, date: '2026-09-07' };
    expect(validateYouthDailyWorkingTime(9 * 60, minor, context)).toHaveLength(1);
    expect(validateYouthDailyWorkingTime(9 * 60, adult, context)).toHaveLength(0);
  });

  it('does not error at exactly 8h', () => {
    const context = { employeeId: m1, date: '2026-09-07' };
    expect(validateYouthDailyWorkingTime(8 * 60, minor, context)).toHaveLength(0);
  });
});

describe('validateYouthWeeklyWorkingTime', () => {
  it('errors for a minor over 40h net for the week, not for an identical adult', () => {
    const context = { employeeId: m1 };
    const monday = new Date(2026, 8, 7);
    expect(validateYouthWeeklyWorkingTime(41 * 60, minor, monday, context)).toHaveLength(1);
    expect(validateYouthWeeklyWorkingTime(41 * 60, adult, monday, context)).toHaveLength(0);
  });
});

describe('validateYouthBreaks', () => {
  const context = { employeeId: m1, date: '2026-09-07' };

  it('requires 30 min. break over 4.5h for a minor (vs. no adult requirement yet at that length)', () => {
    const shift = createShift(clockTime('06:00'), clockTime('11:00')); // 5h net
    expect(validateYouthBreaks([shift], minor, context)).toHaveLength(1);
    shift.breaks.push(createBreak(30));
    expect(validateYouthBreaks([shift], minor, context)).toHaveLength(0);
  });

  it('requires 60 min. break over 6h for a minor (stricter than the adult 45 min. over 9h)', () => {
    const shift = createShift(clockTime('06:00'), clockTime('13:00')); // 7h gross
    shift.breaks.push(createBreak(45));
    // net 6h15 > 6h -> 60 min required, only 45 present
    expect(validateYouthBreaks([shift], minor, context)).toHaveLength(1);
    shift.breaks[0].durationMinutes = 60;
    expect(validateYouthBreaks([shift], minor, context)).toHaveLength(0);
  });

  it('never applies to an adult', () => {
    const shift = createShift(clockTime('06:00'), clockTime('16:00'));
    expect(validateYouthBreaks([shift], adult, context)).toHaveLength(0);
  });
});

describe('validateYouthShiftSpan', () => {
  const context = { employeeId: m1, date: '2026-09-07' };

  it('errors when a minor\'s Schichtzeit (incl. breaks) exceeds 10h', () => {
    const shift = createShift(clockTime('06:00'), clockTime('16:30')); // 10h30 gross
    expect(validateYouthShiftSpan([shift], minor, context)).toHaveLength(1);
  });

  it('does not error for an identical adult shift', () => {
    const shift = createShift(clockTime('06:00'), clockTime('16:30'));
    expect(validateYouthShiftSpan([shift], adult, context)).toHaveLength(0);
  });
});

describe('validateYouthNightWork', () => {
  const context = { employeeId: m1, date: '2026-09-07' };

  it('errors when a minor starts before 06:00 or ends after 20:00', () => {
    expect(validateYouthNightWork(createShift(clockTime('05:00'), clockTime('13:00')), minor, context)).toHaveLength(1);
    expect(validateYouthNightWork(createShift(clockTime('12:00'), clockTime('21:00')), minor, context)).toHaveLength(1);
  });

  it('errors on any endsNextDay shift for a minor', () => {
    expect(validateYouthNightWork(createShift(clockTime('18:00'), clockTime('02:00'), true), minor, context)).toHaveLength(1);
  });

  it('does not error within 06:00-20:00 for a minor, nor at all for an adult outside it', () => {
    expect(validateYouthNightWork(createShift(clockTime('06:00'), clockTime('20:00')), minor, context)).toHaveLength(0);
    expect(validateYouthNightWork(createShift(clockTime('05:00'), clockTime('21:00')), adult, context)).toHaveLength(0);
  });
});

describe('validateYouthSundayWork', () => {
  it('errors for a minor on Sonntag, never on Samstag, never for an adult', () => {
    expect(validateYouthSundayWork('2026-09-13', 'Sonntag', minor, { employeeId: m1 })).toHaveLength(1);
    expect(validateYouthSundayWork('2026-09-12', 'Samstag', minor, { employeeId: m1 })).toHaveLength(0);
    expect(validateYouthSundayWork('2026-09-13', 'Sonntag', adult, { employeeId: m1 })).toHaveLength(0);
  });
});

describe('validateYouthRestPeriodSequence', () => {
  it('errors for a minor under 12h rest even when 11h (the adult minimum) would already pass', () => {
    const shifts = [
      shiftToDated('2026-09-07', createShift(clockTime('06:00'), clockTime('14:00')), m1),
      shiftToDated('2026-09-08', createShift(clockTime('01:30'), clockTime('09:00')), m1), // 11h30 gap
    ];
    expect(validateYouthRestPeriodSequence(shifts, minor)).toHaveLength(1);
    expect(validateYouthRestPeriodSequence(shifts, adult)).toHaveLength(0);
  });
});

describe('Meldungstexte (deutsche Schreibweise)', () => {
  it('writes decimal hours with a German comma in every youth message', () => {
    const context = { employeeId: m1, date: '2026-09-07' };
    const [error] = validateYouthDailyWorkingTime(8.5 * 60, minor, context);
    expect(error.message).toBe(
      'Tägliche Arbeitszeit von 8,5 Std. überschreitet die für Jugendliche zulässige Höchstarbeitszeit von 8 Std. (§8 JArbSchG).',
    );
  });
});
