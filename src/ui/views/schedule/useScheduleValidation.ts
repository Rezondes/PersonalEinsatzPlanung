import { useEffect, useState } from 'react';
import { WEEKDAYS, dateForWeekday } from '@domain/shared/CalendarWeek';
import { toISODate } from '@domain/shared/DateFormat';
import type { WeeklySchedule } from '@domain/schedule/WeeklySchedule';
import type { Branch } from '@domain/branch/Branch';
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
import { scheduleWithoutAbsentDays } from '@application/schedule/scheduleAssessment';
import { createHolidayCheck } from '@infrastructure/holidays/germanHolidays';
import { services } from '@infrastructure/services';

/** Runs all ArbZG (working hours law) validations for the current WeeklySchedule: synchronous per
 * day/week (breaks, maximum working time, Sunday/holiday work) as well as asynchronous per
 * employee across week boundaries (rest period, needs the previous/next week from the repository).
 * Every adult check runs alongside a JArbSchG (youth labor protection) counterpart for employees
 * under 18 (validateYouth*, from domain/validation/arbzg/youthProtection.ts) - each of those returns
 * [] immediately for an adult or an employee with no recorded birth date, so this never changes an
 * adult's results.
 *
 * Days with an absence are set to "Off" before checking (scheduleWithoutAbsentDays), so that
 * ArbZG rules don't fire against leftover shift data on vacation/sick days. The rest-period check
 * loads neighboring weeks directly from the repository and applies the same absence-clearing there,
 * since `absences` is not week-scoped (useAbsences loads all of a Branch's records).
 *
 * The youth checks need each employee's birthDate, which `schedule.employeeAssignments` doesn't
 * carry (only employeeId) and which this hook's own parameters don't otherwise give it either - so,
 * same as the rest-period check already reaching into the repository for data it isn't handed, this
 * fetches the branch's employees directly from the service layer rather than requiring the caller
 * (ScheduleView.tsx, which already loads its own employeeList for rendering) to thread a new
 * parameter through. */
export function useScheduleValidation(
  schedule: WeeklySchedule | null,
  branch: Branch | null,
  absences: Absence[],
): ValidationResult[] {
  const [results, setResults] = useState<ValidationResult[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      if (!schedule || !branch) {
        setResults([]);
        return;
      }

      const cleanedSchedule = scheduleWithoutAbsentDays(schedule, absences);
      const isHoliday = createHolidayCheck(branch.federalState);
      const employees = await services.employee.forBranch(branch.id);
      // Reference date for the youth WEEKLY check's isMinor evaluation only (the daily/shift-level
      // youth checks each use that day's own date). An employee turning 18 mid-week is therefore
      // still treated as a minor for that whole week's aggregate - a deliberate simplification that
      // errs toward the more protective rule, same spirit as the other documented simplifications
      // in domain/validation/CLAUDE.md.
      const mondayDate = dateForWeekday(schedule.calendarWeek, 'Montag');
      const sync: ValidationResult[] = [];

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
            sync.push(...validateShiftDuration(shift, { employeeId: assignment.employeeId, date }));
            sync.push(...validateYouthNightWork(shift, birthDate, { employeeId: assignment.employeeId, date }));
          }
          // §4 ArbZG applies to the day's total working time, not each shift block separately
          // (see breakValidation.ts) - validated once per day across all of that day's shifts.
          sync.push(
            ...validateBreaks(entry.shifts, { employeeId: assignment.employeeId, date }),
          );
          sync.push(...validateYouthBreaks(entry.shifts, birthDate, { employeeId: assignment.employeeId, date }));
          sync.push(...validateYouthShiftSpan(entry.shifts, birthDate, { employeeId: assignment.employeeId, date }));

          // Reuses scheduleCalculation.ts (single source of truth for hour math) instead of
          // re-summing shiftNetMinutes manually here.
          const dayNetMinutes = dayEntryNetMinutes(entry);

          sync.push(
            ...validateDailyWorkingTime(dayNetMinutes, { employeeId: assignment.employeeId, date }),
          );
          sync.push(
            ...validateYouthDailyWorkingTime(dayNetMinutes, birthDate, { employeeId: assignment.employeeId, date }),
          );
          sync.push(
            ...validateSundayHolidayWork(date, day, branch, isHoliday, { employeeId: assignment.employeeId }),
          );
          sync.push(
            ...validateYouthSundayWork(date, day, birthDate, { employeeId: assignment.employeeId }),
          );

          weekNetMinutes += dayNetMinutes;
        }

        sync.push(...validateWeeklyWorkingTime(weekNetMinutes, { employeeId: assignment.employeeId }));
        sync.push(
          ...validateYouthWeeklyWorkingTime(weekNetMinutes, birthDate, mondayDate, { employeeId: assignment.employeeId }),
        );
      }

      // One call for the whole week: the service loads the neighbouring weeks once and validates
      // every employee from in-memory data (see restPeriodCheckService). `employees` is passed
      // through so it can run the §12 JArbSchG youth rest-period check on the same cross-week
      // shift sequence it already assembles for the adult §5 ArbZG one.
      const restPeriodResults = await services.restPeriodCheck.checkWeek(schedule, absences, employees);

      if (!cancelled) {
        setResults([...sync, ...restPeriodResults]);
      }
    }

    check();
    return () => {
      cancelled = true;
    };
  }, [schedule, branch, absences]);

  return results;
}
