import type { BranchId, WeeklyScheduleId, EmployeeId } from '@domain/shared/ids';
import { createId } from '@domain/shared/ids';
import type { CalendarWeek, Weekday } from '@domain/shared/CalendarWeek';
import type { EmployeeWeekAssignment, DayEntry } from './EmployeeWeekAssignment';
import { emptyWeekAssignment } from './EmployeeWeekAssignment';

/**
 * One weekly schedule per (branchId, CalendarWeek). References employees only via employeeId;
 * name/position are loaded live from the employee master record at display/export time (DRY,
 * no duplicated snapshot). Absences are deliberately NOT stored here but overlaid onto the
 * schedule in the application layer (avoids sync problems between two aggregates).
 */
export interface WeeklySchedule {
  id: WeeklyScheduleId;
  branchId: BranchId;
  calendarWeek: CalendarWeek;
  plannedWeeklyRevenue?: number;
  plannedWeeklyHours?: number;
  employeeAssignments: EmployeeWeekAssignment[];
  createdAt: string;
  updatedAt: string;
}

export function createWeeklySchedule(
  branchId: BranchId,
  calendarWeek: CalendarWeek,
  employeeIds: EmployeeId[],
): WeeklySchedule {
  const now = new Date().toISOString();
  return {
    id: createId<WeeklyScheduleId>(),
    branchId,
    calendarWeek,
    employeeAssignments: employeeIds.map(emptyWeekAssignment),
    createdAt: now,
    updatedAt: now,
  };
}

export function assignmentForEmployee(
  schedule: WeeklySchedule,
  employeeId: EmployeeId,
): EmployeeWeekAssignment | undefined {
  return schedule.employeeAssignments.find((assignment) => assignment.employeeId === employeeId);
}

/** Pure, immutable update: returns a new WeeklySchedule with the changed day entry for
 * an employee. If the employee isn't in the schedule yet (e.g. hired afterward),
 * their assignment is newly created. */
export function withDayEntry(
  schedule: WeeklySchedule,
  employeeId: EmployeeId,
  day: Weekday,
  entry: DayEntry,
): WeeklySchedule {
  const existingAssignment = assignmentForEmployee(schedule, employeeId) ?? emptyWeekAssignment(employeeId);
  const newAssignment: EmployeeWeekAssignment = {
    ...existingAssignment,
    days: { ...existingAssignment.days, [day]: entry },
  };

  const exists = schedule.employeeAssignments.some((a) => a.employeeId === employeeId);
  const employeeAssignments = exists
    ? schedule.employeeAssignments.map((a) => (a.employeeId === employeeId ? newAssignment : a))
    : [...schedule.employeeAssignments, newAssignment];

  return { ...schedule, employeeAssignments, updatedAt: new Date().toISOString() };
}

/** Pure, immutable update: sets the target-hours adjustment (carried over from a previous week's
 * actual/target difference) for one employee. Same "find or create the assignment" shape as
 * withDayEntry. */
export function withTargetAdjustment(schedule: WeeklySchedule, employeeId: EmployeeId, minutes: number): WeeklySchedule {
  const existingAssignment = assignmentForEmployee(schedule, employeeId) ?? emptyWeekAssignment(employeeId);
  const newAssignment: EmployeeWeekAssignment = { ...existingAssignment, targetAdjustmentMinutes: minutes };

  const exists = schedule.employeeAssignments.some((a) => a.employeeId === employeeId);
  const employeeAssignments = exists
    ? schedule.employeeAssignments.map((a) => (a.employeeId === employeeId ? newAssignment : a))
    : [...schedule.employeeAssignments, newAssignment];

  return { ...schedule, employeeAssignments, updatedAt: new Date().toISOString() };
}
