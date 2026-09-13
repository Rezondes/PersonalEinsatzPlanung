import { describe, it, expect } from 'vitest';
import type { BranchId, EmployeeId } from '@domain/shared/ids';
import type { CalendarWeek } from '@domain/shared/CalendarWeek';
import type { DayEntry } from './EmployeeWeekAssignment';
import { createWeeklySchedule, withTargetAdjustment, withDayEntries, assignmentForEmployee } from './WeeklySchedule';

const branchId = 'f1' as BranchId;
const cw: CalendarWeek = { year: 2026, week: 37 };
const m1 = 'm1' as EmployeeId;
const m2 = 'm2' as EmployeeId;

describe('withTargetAdjustment', () => {
  it('sets targetAdjustmentMinutes for an already existing assignment', () => {
    const schedule = createWeeklySchedule(branchId, cw, [m1, m2]);
    const updated = withTargetAdjustment(schedule, m1, 180);

    expect(assignmentForEmployee(updated, m1)?.targetAdjustmentMinutes).toBe(180);
    expect(assignmentForEmployee(updated, m2)?.targetAdjustmentMinutes).toBeUndefined();
  });

  it('creates a new assignment when the employee is not yet in the schedule', () => {
    const schedule = createWeeklySchedule(branchId, cw, []);
    const updated = withTargetAdjustment(schedule, m1, -120);

    expect(updated.employeeAssignments).toHaveLength(1);
    expect(assignmentForEmployee(updated, m1)?.targetAdjustmentMinutes).toBe(-120);
  });

  it('leaves other fields of the assignment unchanged', () => {
    const schedule = createWeeklySchedule(branchId, cw, [m1]);
    const updated = withTargetAdjustment(schedule, m1, 60);

    expect(assignmentForEmployee(updated, m1)?.days.Montag).toEqual({ type: 'Off' });
  });

  it('overwrites an already set value', () => {
    const schedule = createWeeklySchedule(branchId, cw, [m1]);
    const once = withTargetAdjustment(schedule, m1, 60);
    const again = withTargetAdjustment(once, m1, -30);

    expect(assignmentForEmployee(again, m1)?.targetAdjustmentMinutes).toBe(-30);
  });
});

describe('withDayEntries', () => {
  const offEntry: DayEntry = { type: 'Off' };
  const shiftEntry: DayEntry = { type: 'Shift', shifts: [] };

  it('applies writes for multiple employees in one call', () => {
    const schedule = createWeeklySchedule(branchId, cw, [m1, m2]);

    const updated = withDayEntries(schedule, [
      { employeeId: m1, day: 'Montag', entry: offEntry },
      { employeeId: m2, day: 'Dienstag', entry: shiftEntry },
    ]);

    expect(assignmentForEmployee(updated, m1)?.days.Montag).toEqual(offEntry);
    expect(assignmentForEmployee(updated, m2)?.days.Dienstag).toEqual(shiftEntry);
  });

  it('updates updatedAt exactly once for the whole batch', () => {
    // A fixed, deliberately old updatedAt (same trick scheduleService.test.ts's "save" test uses) -
    // two real Date.now() calls this close together can land in the same millisecond and produce an
    // identical ISO string, which a schedule.updatedAt-vs-schedule.updatedAt comparison would miss.
    const schedule = { ...createWeeklySchedule(branchId, cw, [m1]), updatedAt: '2020-01-01T00:00:00.000Z' };

    const updated = withDayEntries(schedule, [
      { employeeId: m1, day: 'Montag', entry: offEntry },
      { employeeId: m1, day: 'Dienstag', entry: shiftEntry },
    ]);

    expect(updated.updatedAt).not.toBe(schedule.updatedAt);
  });

  it('creates a new assignment for an employee not yet in the schedule', () => {
    const schedule = createWeeklySchedule(branchId, cw, []);

    const updated = withDayEntries(schedule, [{ employeeId: m1, day: 'Montag', entry: offEntry }]);

    expect(updated.employeeAssignments).toHaveLength(1);
    expect(assignmentForEmployee(updated, m1)?.days.Montag).toEqual(offEntry);
  });

  it('leaves an employee not targeted by any write completely unchanged', () => {
    const schedule = createWeeklySchedule(branchId, cw, [m1, m2]);

    const updated = withDayEntries(schedule, [{ employeeId: m1, day: 'Montag', entry: offEntry }]);

    expect(assignmentForEmployee(updated, m2)).toEqual(assignmentForEmployee(schedule, m2));
  });

  it('returns the schedule unchanged for an empty writes list', () => {
    const schedule = createWeeklySchedule(branchId, cw, [m1]);

    expect(withDayEntries(schedule, [])).toEqual(schedule);
  });
});
