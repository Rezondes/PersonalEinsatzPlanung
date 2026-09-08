import { describe, it, expect } from 'vitest';
import type { BranchId, EmployeeId } from '@domain/shared/ids';
import type { CalendarWeek } from '@domain/shared/CalendarWeek';
import { createWeeklySchedule, withDayEntry, withTargetAdjustment } from '@domain/schedule/WeeklySchedule';
import { createShift } from '@domain/schedule/Shift';
import { clockTime } from '@domain/shared/ClockTime';
import type { AbsenceId } from '@domain/shared/ids';
import type { Absence } from '@domain/absence/Absence';
import type { EmploymentType } from '@domain/employee/EmploymentType';
import { createWeekView, effectiveTargetMinutes, effectiveTargetMinutesRange } from './scheduleAssessment';

const branchId = 'f1' as BranchId;
const cw: CalendarWeek = { year: 2026, week: 37 };
const m1 = 'm1' as EmployeeId;

/** These cases only look at targetAdjustmentMinutes, where no employee data is involved. */
const NO_EMPLOYEES = { employees: [] };

const fullTime: EmploymentType = { type: 'FullTime', weeklyHours: 30 };
const minijob: EmploymentType = { type: 'Minijob', minHours: 6, maxHours: 10 };

describe('effectiveTargetMinutes', () => {
  it('equals the contract hours with no adjustment', () => {
    expect(effectiveTargetMinutes({ employmentType: fullTime }, { targetAdjustmentMinutes: 0 })).toBe(30 * 60);
  });

  it('adds a positive adjustment (behind from the previous week)', () => {
    expect(effectiveTargetMinutes({ employmentType: fullTime }, { targetAdjustmentMinutes: 180 })).toBe(30 * 60 + 180);
  });

  it('subtracts on a negative adjustment (worked ahead the previous week)', () => {
    expect(effectiveTargetMinutes({ employmentType: fullTime }, { targetAdjustmentMinutes: -120 })).toBe(30 * 60 - 120);
  });

  it('uses the max hours as the base for a Minijob', () => {
    expect(effectiveTargetMinutes({ employmentType: minijob }, { targetAdjustmentMinutes: 0 })).toBe(10 * 60);
  });
});

describe('createWeekView - targetAdjustmentMinutes', () => {
  it('passes targetAdjustmentMinutes through from the assignment', () => {
    const schedule = withTargetAdjustment(createWeeklySchedule(branchId, cw, [m1]), m1, 90);
    const [assignment] = createWeekView(schedule, [], NO_EMPLOYEES);
    expect(assignment.targetAdjustmentMinutes).toBe(90);
  });

  it('returns 0 when no adjustment was set', () => {
    const schedule = createWeeklySchedule(branchId, cw, [m1]);
    const [assignment] = createWeekView(schedule, [], NO_EMPLOYEES);
    expect(assignment.targetAdjustmentMinutes).toBe(0);
  });
});

// --- Punkt "Sonstiges-Stunden" und "Std. je Feier-/Urlaubstag" ---------------------------------

const employees = [{ id: m1, holidayVacationHours: 5 }];
const shift8h = { type: 'Shift' as const, shifts: [createShift(clockTime('06:00'), clockTime('14:00'))] };

function absence(overrides: Partial<Absence> & Pick<Absence, 'type'>): Absence {
  return {
    id: 'a1' as AbsenceId,
    employeeId: m1,
    from: '2026-09-07',
    to: '2026-09-07',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  } as Absence;
}

function weekWithMonday(entry = shift8h) {
  return withDayEntry(createWeeklySchedule(branchId, cw, [m1]), m1, 'Montag', entry);
}

describe('createWeekView - worked vs credited minutes', () => {
  it('counts a plain shift as worked and credits nothing', () => {
    const [row] = createWeekView(weekWithMonday(), [], { employees });
    expect(row.workedMinutes).toBe(8 * 60);
    expect(row.creditedMinutes).toBe(0);
    expect(row.totalNetMinutes).toBe(8 * 60);
  });

  it('credits a vacation day to the employee but not to the worked hours', () => {
    const [row] = createWeekView(weekWithMonday(), [absence({ type: 'Vacation' })], { employees });
    expect(row.workedMinutes).toBe(0);
    expect(row.creditedMinutes).toBe(5 * 60);
    expect(row.totalNetMinutes).toBe(5 * 60);
    expect(row.days[0].absenceCoversWholeDay).toBe(true);
  });

  it('credits half a day for a half-day vacation and keeps the worked half', () => {
    const halfDay = absence({ type: 'Vacation', halfDay: { atStart: true, atEnd: false } });
    const [row] = createWeekView(weekWithMonday(), [halfDay], { employees });
    expect(row.workedMinutes).toBe(8 * 60);
    expect(row.creditedMinutes).toBe(2.5 * 60);
    expect(row.days[0].absenceCoversWholeDay).toBe(false);
  });

  it('credits nothing for illness', () => {
    const [row] = createWeekView(weekWithMonday(), [absence({ type: 'Illness' })], { employees });
    expect(row.workedMinutes).toBe(0);
    expect(row.creditedMinutes).toBe(0);
  });

  it('credits the hours entered on a "Sonstige" absence, and nothing without them', () => {
    const withHours = absence({ type: 'Other', label: 'Fortbildung', hoursPerDay: 6 });
    expect(createWeekView(weekWithMonday(), [withHours], { employees })[0].creditedMinutes).toBe(6 * 60);

    const withoutHours = absence({ type: 'Other', label: 'Sonderurlaub' });
    expect(createWeekView(weekWithMonday(), [withoutHours], { employees })[0].creditedMinutes).toBe(0);
  });

  it('does not credit a vacation day that falls on a Sunday', () => {
    // 2026-09-13 is the Sunday of KW 37.
    const sunday = absence({ type: 'Vacation', from: '2026-09-13', to: '2026-09-13' });
    const [row] = createWeekView(createWeeklySchedule(branchId, cw, [m1]), [sunday], { employees });
    expect(row.creditedMinutes).toBe(0);
  });

  it('does not credit a vacation day that falls on a public holiday', () => {
    const [row] = createWeekView(weekWithMonday(), [absence({ type: 'Vacation' })], {
      employees,
      isHoliday: (date) => date === '2026-09-07',
    });
    expect(row.creditedMinutes).toBe(0);
  });

  it('credits 0 for an employee the caller did not pass, instead of producing NaN', () => {
    const [row] = createWeekView(weekWithMonday(), [absence({ type: 'Vacation' })], { employees: [] });
    expect(row.creditedMinutes).toBe(0);
  });

  it('applies a manual day override to the worked hours', () => {
    const overridden = { ...shift8h, netMinutesOverride: 6 * 60 };
    const [row] = createWeekView(weekWithMonday(overridden), [], { employees });
    expect(row.workedMinutes).toBe(6 * 60);
    expect(row.totalNetMinutes).toBe(6 * 60);
  });

  it('still treats a day overridden to zero as worked, not as an absence', () => {
    const overridden = { ...shift8h, netMinutesOverride: 0 };
    const [row] = createWeekView(weekWithMonday(overridden), [], { employees });
    expect(row.days[0].absenceCoversWholeDay).toBe(false);
    expect(row.days[0].entry).toEqual(overridden);
  });

  it('lets the narrower absence win when two overlap, regardless of their order', () => {
    const vacationWeek = absence({ type: 'Vacation', from: '2026-09-07', to: '2026-09-11' });
    const holiday = {
      ...absence({ type: 'Other', label: 'Feiertag', hoursPerDay: 7 }),
      id: 'a2' as AbsenceId,
    } as Absence;

    for (const list of [[vacationWeek, holiday], [holiday, vacationWeek]]) {
      const [row] = createWeekView(weekWithMonday(), list, { employees });
      expect(row.days[0].creditedMinutes).toBe(7 * 60);
    }
  });
});

describe('effectiveTargetMinutesRange', () => {
  it('collapses to a single value for full-time and part-time', () => {
    expect(effectiveTargetMinutesRange({ employmentType: fullTime }, { targetAdjustmentMinutes: 0 })).toEqual({
      min: 30 * 60,
      max: 30 * 60,
    });
  });

  it('keeps both bounds for a Minijob and shifts them by the carry-over', () => {
    expect(effectiveTargetMinutesRange({ employmentType: minijob }, { targetAdjustmentMinutes: 60 })).toEqual({
      min: 7 * 60,
      max: 11 * 60,
    });
  });
});
