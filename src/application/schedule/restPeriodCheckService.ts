import type { EmployeeId } from '@domain/shared/ids';
import { WEEKDAYS, dateForWeekday, previousCalendarWeek, nextCalendarWeek } from '@domain/shared/CalendarWeek';
import { toISODate } from '@domain/shared/DateFormat';
import type { WeeklySchedule } from '@domain/schedule/WeeklySchedule';
import { assignmentForEmployee } from '@domain/schedule/WeeklySchedule';
import type { Absence } from '@domain/absence/Absence';
import type { Employee } from '@domain/employee/Employee';
import type { DatedShift } from '@domain/validation/arbzg/restPeriodValidation';
import { shiftToDated, validateRestPeriodSequence } from '@domain/validation/arbzg/restPeriodValidation';
import { validateYouthRestPeriodSequence } from '@domain/validation/arbzg/youthProtection';
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

/** Checks the minimum rest period (§5 ArbZG) across week boundaries for every employee of one
 * weekly schedule - a weekend night shift can extend into the next week, so the previous and next
 * week are consulted as well.
 *
 * Deliberately one call per week, not per employee: the neighbouring weeks are loaded from the
 * repository exactly once and the absence overlay is applied once per schedule, then every
 * employee's shift sequence is validated from that in-memory data. The earlier per-employee API
 * re-read the same three schedules for each employee, so a branch with N employees cost 3N
 * repository reads per validation run. `schedule` is the caller's current in-memory week rather
 * than a fresh read, so the check never lags behind what is shown on screen.
 *
 * `absences` clears out leftover Shift data on days now covered by an Absence (same reasoning as
 * scheduleWithoutAbsentDays's other callers) - without this, a stale shift next to a since-added
 * vacation/sick day would wrongly count toward the rest period. */
export function createRestPeriodCheckService(repo: WeeklyScheduleRepository) {
  return {
    checkWeek: async (
      schedule: WeeklySchedule,
      absences: Absence[] = [],
      employees: Pick<Employee, 'id' | 'birthDate'>[] = [],
    ): Promise<ValidationResult[]> => {
      const { branchId, calendarWeek } = schedule;
      const [previous, next] = await Promise.all([
        repo.findByBranchAndWeek(branchId, previousCalendarWeek(calendarWeek)),
        repo.findByBranchAndWeek(branchId, nextCalendarWeek(calendarWeek)),
      ]);

      const cleaned = [previous, schedule, next]
        .filter((s): s is WeeklySchedule => s !== null)
        .map((s) => scheduleWithoutAbsentDays(s, absences));

      return schedule.employeeAssignments.flatMap((assignment) => {
        const datedShifts = cleaned.flatMap((s) => extractDatedShifts(s, assignment.employeeId));
        const birthDate = employees.find((e) => e.id === assignment.employeeId)?.birthDate;
        return [
          ...validateRestPeriodSequence(datedShifts),
          ...validateYouthRestPeriodSequence(datedShifts, birthDate),
        ];
      });
    },
  };
}

export type RestPeriodCheckService = ReturnType<typeof createRestPeriodCheckService>;
