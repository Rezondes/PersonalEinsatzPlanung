import { describe, it, expect } from 'vitest';
import type { BranchId, EmployeeId } from '@domain/shared/ids';
import type { CalendarWeek } from '@domain/shared/CalendarWeek';
import { createWeeklySchedule, withTargetAdjustment } from '@domain/schedule/WeeklySchedule';
import type { EmploymentType } from '@domain/employee/EmploymentType';
import { createWeekView, effectiveTargetMinutes } from './scheduleAssessment';

const branchId = 'f1' as BranchId;
const cw: CalendarWeek = { year: 2026, week: 37 };
const m1 = 'm1' as EmployeeId;

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
    const [assignment] = createWeekView(schedule, []);
    expect(assignment.targetAdjustmentMinutes).toBe(90);
  });

  it('returns 0 when no adjustment was set', () => {
    const schedule = createWeeklySchedule(branchId, cw, [m1]);
    const [assignment] = createWeekView(schedule, []);
    expect(assignment.targetAdjustmentMinutes).toBe(0);
  });
});
