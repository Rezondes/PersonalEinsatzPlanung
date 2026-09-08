import { describe, it, expect } from 'vitest';
import { clockTime } from '@domain/shared/ClockTime';
import { createShift } from './Shift';
import { createBreak } from './Break';
import {
  shiftGrossMinutes,
  shiftNetMinutes,
  minutesToDecimalHours,
  dayEntryNetMinutes,
  weekAssignmentNetMinutes,
} from './scheduleCalculation';
import { emptyWeekAssignment } from './EmployeeWeekAssignment';
import type { EmployeeId } from '@domain/shared/ids';

describe('shiftGrossMinutes', () => {
  it('calculates the gross minutes of a normal day shift', () => {
    const shift = createShift(clockTime('06:00'), clockTime('12:00'));
    expect(shiftGrossMinutes(shift)).toBe(360);
  });

  it('calculates gross minutes correctly across midnight when endsNextDay is set', () => {
    const shift = createShift(clockTime('22:00'), clockTime('06:00'), true);
    expect(shiftGrossMinutes(shift)).toBe(480); // 22:00 -> 06:00 next day = 8h
  });
});

describe('shiftNetMinutes', () => {
  it('subtracts breaks from the gross time', () => {
    const shift = createShift(clockTime('06:00'), clockTime('12:00'));
    shift.breaks.push(createBreak(30));
    expect(shiftNetMinutes(shift)).toBe(330); // 6h - 30min = 5.5h
  });

  it('equals the full gross time when no break is recorded', () => {
    const shift = createShift(clockTime('14:00'), clockTime('20:15'));
    expect(shiftNetMinutes(shift)).toBe(375);
  });
});

describe('minutesToDecimalHours', () => {
  it('rounds to 2 decimal places without float artifacts', () => {
    expect(minutesToDecimalHours(330)).toBe(5.5);
    expect(minutesToDecimalHours(450)).toBe(7.5);
    expect(minutesToDecimalHours(30)).toBe(0.5);
    expect(minutesToDecimalHours(400)).toBeCloseTo(6.67, 2);
  });
});

describe('weekAssignmentNetMinutes', () => {
  it('correctly sums multiple shifts per day and multiple days (split shift)', () => {
    const employeeId = 'm1' as EmployeeId;
    const assignment = emptyWeekAssignment(employeeId);

    assignment.days.Montag = {
      type: 'Shift',
      shifts: [createShift(clockTime('06:00'), clockTime('08:00')), createShift(clockTime('14:00'), clockTime('18:00'))],
    };
    assignment.days.Dienstag = { type: 'Shift', shifts: [createShift(clockTime('06:00'), clockTime('12:30'))] };

    expect(weekAssignmentNetMinutes(assignment)).toBe(2 * 60 + 4 * 60 + 6.5 * 60);
  });

  it('counts days off as 0 minutes', () => {
    const assignment = emptyWeekAssignment('m1' as EmployeeId);
    expect(weekAssignmentNetMinutes(assignment)).toBe(0);
  });
});

describe('dayEntryNetMinutes', () => {
  it('returns 0 for a day off', () => {
    expect(dayEntryNetMinutes({ type: 'Off' })).toBe(0);
  });
});
