import { describe, it, expect } from 'vitest';
import type { BranchId, EmployeeId, AbsenceId } from '@domain/shared/ids';
import type { CalendarWeek } from '@domain/shared/CalendarWeek';
import { calendarWeeksInMonth } from '@domain/shared/CalendarWeek';
import { clockTime } from '@domain/shared/ClockTime';
import { createShift } from '@domain/schedule/Shift';
import type { DayEntry } from '@domain/schedule/EmployeeWeekAssignment';
import { createWeeklySchedule, withDayEntry } from '@domain/schedule/WeeklySchedule';
import type { Branch } from '@domain/branch/Branch';
import { emptyAddress } from '@domain/branch/Address';
import type { Absence } from '@domain/absence/Absence';
import { validateWeekSync, createMonthValidation } from './scheduleValidation';

const branchId = 'b1' as BranchId;
const m1 = 'm1' as EmployeeId;
const m2 = 'm2' as EmployeeId;
// Monday 2026-09-07, Bayern, no public holiday and not a Sunday - same fixture week as
// useScheduleValidation.test.tsx, so this extraction's behavior can be compared 1:1 to the hook's.
const week: CalendarWeek = { year: 2026, week: 37 };

function shiftEntry(start: string, end: string): DayEntry {
  return { type: 'Shift', shifts: [createShift(clockTime(start), clockTime(end))] };
}

function makeBranch(overrides: Partial<Branch> = {}): Branch {
  return {
    id: branchId,
    name: 'Filiale Nord',
    branchNumber: '001',
    address: emptyAddress(),
    logoBase64: null,
    federalState: 'Bayern',
    allowedOpenSundays: [],
    active: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

const branch = makeBranch();
const noHoliday = () => false;

describe('validateWeekSync', () => {
  it('reports a daily-hours ArbZG error for a shift exceeding the maximum', () => {
    const schedule = withDayEntry(createWeeklySchedule(branchId, week, [m1]), m1, 'Montag', shiftEntry('06:00', '18:00'));

    const results = validateWeekSync(schedule, [], branch, [], noHoliday);

    expect(results).toContainEqual(
      expect.objectContaining({ rule: 'ArbZG_3_Hoechstarbeitszeit', severity: 'error', employeeId: m1 }),
    );
  });

  it('reports a JArbSchG youth violation for a minor working past 20:00, without affecting an adult in the same week', () => {
    let schedule = withDayEntry(createWeeklySchedule(branchId, week, [m1, m2]), m1, 'Montag', shiftEntry('06:00', '21:00'));
    schedule = withDayEntry(schedule, m2, 'Montag', shiftEntry('06:00', '21:00'));
    const employees = [
      { id: m1, birthDate: '2010-05-01' },
      { id: m2, birthDate: '1990-05-01' },
    ];

    const results = validateWeekSync(schedule, [], branch, employees, noHoliday);

    expect(results).toContainEqual(expect.objectContaining({ rule: 'JArbSchG_14_Nachtruhe', employeeId: m1 }));
    expect(results).not.toContainEqual(expect.objectContaining({ rule: 'JArbSchG_14_Nachtruhe', employeeId: m2 }));
  });

  it('reports the §5 JArbSchG child-employment ban for a child, without affecting an adult in the same week', () => {
    let schedule = withDayEntry(createWeeklySchedule(branchId, week, [m1, m2]), m1, 'Montag', shiftEntry('08:00', '12:00'));
    schedule = withDayEntry(schedule, m2, 'Montag', shiftEntry('08:00', '12:00'));
    const employees = [
      { id: m1, birthDate: '2013-05-01' }, // turns 15 in 2028, a child in this 2026 week
      { id: m2, birthDate: '1990-05-01' },
    ];

    const results = validateWeekSync(schedule, [], branch, employees, noHoliday);

    expect(results).toContainEqual(expect.objectContaining({ rule: 'JArbSchG_5_Kinderarbeit', employeeId: m1 }));
    expect(results).not.toContainEqual(expect.objectContaining({ rule: 'JArbSchG_5_Kinderarbeit', employeeId: m2 }));
  });

  it('returns an empty array for a week with no violations', () => {
    const schedule = withDayEntry(createWeeklySchedule(branchId, week, [m1]), m1, 'Montag', shiftEntry('08:00', '12:00'));

    expect(validateWeekSync(schedule, [], branch, [], noHoliday)).toEqual([]);
  });

  it('clears a day covered by an Absence before validating, so its leftover shift raises no violation (matches useScheduleValidation.ts\'s pre-extraction behavior)', () => {
    const schedule = withDayEntry(createWeeklySchedule(branchId, week, [m1]), m1, 'Montag', shiftEntry('06:00', '18:00'));
    const vacationOnMonday: Absence = {
      id: 'a1' as AbsenceId,
      employeeId: m1,
      type: 'Vacation',
      from: '2026-09-07',
      to: '2026-09-07',
      createdAt: '2026-01-01T00:00:00.000Z',
    };

    expect(validateWeekSync(schedule, [vacationOnMonday], branch, [], noHoliday)).toEqual([]);
  });
});

describe('createMonthValidation', () => {
  it('keys a violation by employeeId and its own week, leaving a clean week out of the map entirely', () => {
    const weeks = calendarWeeksInMonth(2026, 9);
    expect(weeks.length).toBeGreaterThan(1);
    const [violatingWeek, cleanWeek] = weeks;
    const violatingSchedule = withDayEntry(
      createWeeklySchedule(branchId, violatingWeek, [m1]),
      m1,
      'Montag',
      shiftEntry('06:00', '18:00'),
    );
    const cleanSchedule = createWeeklySchedule(branchId, cleanWeek, [m1]);

    const result = createMonthValidation([violatingSchedule, cleanSchedule], 2026, 9, [], branch, [], noHoliday);

    const violatingKey = `${m1}|${violatingWeek.year}-${violatingWeek.week}`;
    expect(result.get(violatingKey)).toContainEqual(expect.objectContaining({ rule: 'ArbZG_3_Hoechstarbeitszeit' }));
    const cleanKey = `${m1}|${cleanWeek.year}-${cleanWeek.week}`;
    expect(result.has(cleanKey)).toBe(false);
  });

  it('returns an empty map when no schedules exist for the month at all', () => {
    expect(createMonthValidation([], 2026, 9, [], branch, [], noHoliday).size).toBe(0);
  });
});
