import type { BranchId, EmployeeId } from '@domain/shared/ids';
import type { CalendarWeek } from '@domain/shared/CalendarWeek';
import { WEEKDAYS, dateForWeekday, previousCalendarWeek, nextCalendarWeek } from '@domain/shared/CalendarWeek';
import { toISODate } from '@domain/shared/DateFormat';
import type { WeeklySchedule } from '@domain/schedule/WeeklySchedule';
import { assignmentForEmployee } from '@domain/schedule/WeeklySchedule';
import type { Absence } from '@domain/absence/Absence';
import type { DatedShift } from '@domain/validation/arbzg/restPeriodValidation';
import { shiftToDated, validateRestPeriodSequence } from '@domain/validation/arbzg/restPeriodValidation';
import type { ValidationResult } from '@domain/validation/ValidationResult';
import type { WeeklyScheduleRepository } from '@application/ports/WeeklyScheduleRepository';
import { scheduleWithoutAbsentDays } from '@application/schedule/scheduleAssessment';

function extractDatedShifts(schedule: WeeklySchedule, employeeId: EmployeeId): DatedShift[] {
  const assignment = assignmentForEmployee(schedule, employeeId);
  if (!assignment) {
    return [];
  }
  return WEEKDAYS.flatMap((day) => {
    const entry = assignment.days[day];
    if (entry.type !== 'Shift') {
      return [];
    }
    const date = toISODate(dateForWeekday(schedule.calendarWeek, day));
    return entry.shifts.map((shift) => shiftToDated(date, shift, employeeId));
  });
}

/** Checks the minimum rest period (§5 ArbZG) for an employee across week boundaries by
 * loading the previous/current/next week (a weekend night shift can extend
 * into the next week). `absences` clears out leftover Shift data on days now covered by an
 * Absence (same reasoning as scheduleWithoutAbsentDays's callers elsewhere) - without this, a
 * stale shift next to a since-added vacation/sick day would wrongly count toward the rest period. */
export function createRestPeriodCheckService(repo: WeeklyScheduleRepository) {
  return {
    checkForEmployee: async (
      employeeId: EmployeeId,
      branchId: BranchId,
      cw: CalendarWeek,
      absences: Absence[] = [],
    ): Promise<ValidationResult[]> => {
      const weeks = [previousCalendarWeek(cw), cw, nextCalendarWeek(cw)];
      const schedules = await Promise.all(weeks.map((w) => repo.findByBranchAndWeek(branchId, w)));

      const datedShifts = schedules
        .filter((s): s is WeeklySchedule => s !== null)
        .map((schedule) => scheduleWithoutAbsentDays(schedule, absences))
        .flatMap((schedule) => extractDatedShifts(schedule, employeeId));

      return validateRestPeriodSequence(datedShifts);
    },
  };
}

export type RestPeriodCheckService = ReturnType<typeof createRestPeriodCheckService>;
