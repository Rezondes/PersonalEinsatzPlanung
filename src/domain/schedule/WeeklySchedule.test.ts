import { describe, it, expect } from 'vitest';
import type { BranchId, EmployeeId } from '@domain/shared/ids';
import type { CalendarWeek } from '@domain/shared/CalendarWeek';
import { createWeeklySchedule, withTargetAdjustment, assignmentForEmployee } from './WeeklySchedule';

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
