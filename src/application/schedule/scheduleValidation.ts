import { WEEKDAYS, dateForWeekday, calendarWeeksInMonth, calendarWeeksEqual } from '@domain/shared/CalendarWeek';
import { toISODate } from '@domain/shared/DateFormat';
import type { WeeklySchedule } from '@domain/schedule/WeeklySchedule';
import { createWeeklySchedule } from '@domain/schedule/WeeklySchedule';
import type { Branch } from '@domain/branch/Branch';
import type { Employee } from '@domain/employee/Employee';
import type { EmployeeId } from '@domain/shared/ids';
import type { Absence } from '@domain/absence/Absence';
import { dayEntryNetMinutes } from '@domain/schedule/scheduleCalculation';
import { validateBreaks } from '@domain/validation/arbzg/breakValidation';
import { validateShiftDuration } from '@domain/validation/arbzg/shiftDurationValidation';
import { validateDailyWorkingTime, validateWeeklyWorkingTime } from '@domain/validation/arbzg/maxWorkingTimeValidation';
import { validateSundayHolidayWork } from '@domain/validation/arbzg/sundayHolidayValidation';
import {
  validateYouthDailyWorkingTime,
  validateYouthWeeklyWorkingTime,
  validateYouthBreaks,
  validateYouthShiftSpan,
  validateYouthNightWork,
  validateYouthSundayWork,
} from '@domain/validation/arbzg/youthProtection';
import type { ValidationResult } from '@domain/validation/ValidationResult';
import { scheduleWithoutAbsentDays } from './scheduleAssessment';

/** All synchronous (repository-free) ArbZG/JArbSchG checks for one WeeklySchedule - extracted
 * 1:1 from ui/views/schedule/useScheduleValidation.ts so the Monatsübersicht can run the same
 * per-day/per-week rules without duplicating them. Deliberately excludes the async cross-week
 * rest-period check (§5 ArbZG/§12 JArbSchG, restPeriodCheckService) - too expensive to run for
 * every week of a month at once (see MonthOverviewView's info footnote about this). Cleans
 * absence-covered days itself (scheduleWithoutAbsentDays) so no caller can forget to. */
export function validateWeekSync(
  schedule: WeeklySchedule,
  absences: Absence[],
  branch: Branch,
  employees: Pick<Employee, 'id' | 'birthDate'>[],
  isHoliday: (isoDate: string) => boolean,
): ValidationResult[] {
  const cleanedSchedule = scheduleWithoutAbsentDays(schedule, absences);
  // Reference date for the youth WEEKLY check's isMinor evaluation only, same simplification as
  // the hook this was extracted from.
  const mondayDate = dateForWeekday(schedule.calendarWeek, 'Montag');
  const results: ValidationResult[] = [];

  for (const assignment of cleanedSchedule.employeeAssignments) {
    const birthDate = employees.find((e) => e.id === assignment.employeeId)?.birthDate;
    let weekNetMinutes = 0;

    for (const day of WEEKDAYS) {
      const entry = assignment.days[day];
      if (entry.type !== 'Shift' || entry.shifts.length === 0) {
        continue;
      }
      const date = toISODate(dateForWeekday(schedule.calendarWeek, day));

      for (const shift of entry.shifts) {
        results.push(...validateShiftDuration(shift, { employeeId: assignment.employeeId, date }));
        results.push(...validateYouthNightWork(shift, birthDate, { employeeId: assignment.employeeId, date }));
      }
      // §4 ArbZG applies to the day's total working time, not each shift block separately.
      results.push(...validateBreaks(entry.shifts, { employeeId: assignment.employeeId, date }));
      results.push(...validateYouthBreaks(entry.shifts, birthDate, { employeeId: assignment.employeeId, date }));
      results.push(...validateYouthShiftSpan(entry.shifts, birthDate, { employeeId: assignment.employeeId, date }));

      const dayNetMinutes = dayEntryNetMinutes(entry);

      results.push(...validateDailyWorkingTime(dayNetMinutes, { employeeId: assignment.employeeId, date }));
      results.push(
        ...validateYouthDailyWorkingTime(dayNetMinutes, birthDate, { employeeId: assignment.employeeId, date }),
      );
      results.push(...validateSundayHolidayWork(date, day, branch, isHoliday, { employeeId: assignment.employeeId }));
      results.push(...validateYouthSundayWork(date, day, birthDate, { employeeId: assignment.employeeId }));

      weekNetMinutes += dayNetMinutes;
    }

    results.push(...validateWeeklyWorkingTime(weekNetMinutes, { employeeId: assignment.employeeId }));
    results.push(
      ...validateYouthWeeklyWorkingTime(weekNetMinutes, birthDate, mondayDate, { employeeId: assignment.employeeId }),
    );
  }

  return results;
}

/** Same "find this week's real WeeklySchedule or synthesize an empty one" logic as
 * application/schedule/scheduleAssessment.ts's createMonthOverview - re-walked here (a small,
 * deliberate duplication) rather than reusing that function, since it returns aggregated
 * MonthRow[] numbers with no slot for validation results. Map key `${employeeId}|${year}-${week}`
 * so MonthOverviewView can look up exactly one cell's results without a linear scan. */
export function createMonthValidation(
  schedules: WeeklySchedule[],
  year: number,
  month: number,
  absences: Absence[],
  branch: Branch,
  employees: Employee[],
  isHoliday: (isoDate: string) => boolean,
): Map<string, ValidationResult[]> {
  const result = new Map<string, ValidationResult[]>();
  const relevantWeeks = calendarWeeksInMonth(year, month);
  const schedulesThisMonth = schedules.filter((s) => relevantWeeks.some((cw) => calendarWeeksEqual(cw, s.calendarWeek)));

  const employeeIds = new Set<EmployeeId>();
  for (const schedule of schedulesThisMonth) {
    for (const assignment of schedule.employeeAssignments) {
      employeeIds.add(assignment.employeeId);
    }
  }
  if (employeeIds.size === 0) {
    return result;
  }
  const branchId = schedulesThisMonth[0].branchId;

  for (const cw of relevantWeeks) {
    const schedule =
      schedulesThisMonth.find((s) => calendarWeeksEqual(s.calendarWeek, cw)) ??
      createWeeklySchedule(branchId, cw, [...employeeIds]);

    const weekResults = validateWeekSync(schedule, absences, branch, employees, isHoliday);
    for (const validationResult of weekResults) {
      if (!validationResult.employeeId) continue;
      const key = `${validationResult.employeeId}|${cw.year}-${cw.week}`;
      const list = result.get(key);
      if (list) {
        list.push(validationResult);
      } else {
        result.set(key, [validationResult]);
      }
    }
  }

  return result;
}
