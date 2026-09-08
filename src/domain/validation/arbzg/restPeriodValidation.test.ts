import { describe, it, expect } from 'vitest';
import { clockTime } from '@domain/shared/ClockTime';
import { createShift } from '@domain/schedule/Shift';
import type { EmployeeId } from '@domain/shared/ids';
import { shiftToDated, validateRestPeriodSequence } from './restPeriodValidation';

const m1 = 'm1' as EmployeeId;

describe('validateRestPeriodSequence', () => {
  it('reports no violation at exactly 11 hours of rest', () => {
    const yesterday = shiftToDated('2026-09-07', createShift(clockTime('06:00'), clockTime('14:00')), m1);
    const today = shiftToDated('2026-09-08', createShift(clockTime('01:00'), clockTime('09:00')), m1);
    expect(validateRestPeriodSequence([yesterday, today])).toHaveLength(0);
  });

  it('reports an error at less than 11 hours of rest', () => {
    const yesterday = shiftToDated('2026-09-07', createShift(clockTime('06:00'), clockTime('14:00')), m1);
    const today = shiftToDated('2026-09-08', createShift(clockTime('00:59'), clockTime('09:00')), m1);
    const results = validateRestPeriodSequence([yesterday, today]);
    expect(results).toHaveLength(1);
    expect(results[0].rule).toBe('ArbZG_5_Ruhezeit');
    expect(results[0].severity).toBe('error');
  });

  it('handles a night shift crossing the week boundary (Saturday -> Monday)', () => {
    // Saturday 22:00 - Sunday 02:00 (endsNextDay), then Monday 06:00 -> 28h gap, clearly enough
    const saturdayNight = shiftToDated('2026-09-05', createShift(clockTime('22:00'), clockTime('02:00'), true), m1);
    const mondayMorning = shiftToDated('2026-09-07', createShift(clockTime('06:00'), clockTime('14:00')), m1);
    expect(validateRestPeriodSequence([saturdayNight, mondayMorning])).toHaveLength(0);

    // Tight case: night shift ends Sunday 09:00, next shift Sunday 19:00 -> only 10h rest
    const nightShift = shiftToDated('2026-09-06', createShift(clockTime('23:00'), clockTime('09:00'), true), m1);
    const eveningShift = shiftToDated('2026-09-07', createShift(clockTime('19:00'), clockTime('23:00')), m1);
    const results = validateRestPeriodSequence([nightShift, eveningShift]);
    expect(results).toHaveLength(1);
    expect(results[0].rule).toBe('ArbZG_5_Ruhezeit');
  });

  it('detects overlapping shifts as an error instead of negative rest time', () => {
    const first = shiftToDated('2026-09-07', createShift(clockTime('06:00'), clockTime('14:00')), m1);
    const second = shiftToDated('2026-09-07', createShift(clockTime('13:00'), clockTime('20:00')), m1);
    const results = validateRestPeriodSequence([first, second]);
    expect(results).toHaveLength(1);
    expect(results[0].rule).toBe('Schichtueberschneidung');
  });

  it('works independently of input order (sorted internally)', () => {
    const yesterday = shiftToDated('2026-09-07', createShift(clockTime('06:00'), clockTime('14:00')), m1);
    const today = shiftToDated('2026-09-08', createShift(clockTime('00:59'), clockTime('09:00')), m1);
    expect(validateRestPeriodSequence([today, yesterday])).toHaveLength(1);
  });

  it('stays correct across the late-October DST weekend (clock change)', () => {
    // Night of Oct 25, 2026 (summer->winter DST change in DE): shift ends 23:00, next starts Oct 26 10:00
    const friday = shiftToDated('2026-10-24', createShift(clockTime('15:00'), clockTime('23:00')), m1);
    const monday = shiftToDated('2026-10-26', createShift(clockTime('10:00'), clockTime('18:00')), m1);
    // Almost 2 calendar days apart -> clearly no violation; checks that Date arithmetic doesn't crash/skew across DST
    expect(validateRestPeriodSequence([friday, monday])).toHaveLength(0);
  });
});
