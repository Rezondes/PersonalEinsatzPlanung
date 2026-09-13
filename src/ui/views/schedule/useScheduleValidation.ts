import { useEffect, useState } from 'react';
import type { WeeklySchedule } from '@domain/schedule/WeeklySchedule';
import type { Branch } from '@domain/branch/Branch';
import type { Absence } from '@domain/absence/Absence';
import type { ValidationResult } from '@domain/validation/ValidationResult';
import { validateWeekSync } from '@application/schedule/scheduleValidation';
import { createHolidayCheck } from '@infrastructure/holidays/germanHolidays';
import { services } from '@infrastructure/services';

/** Runs all ArbZG (working hours law) validations for the current WeeklySchedule: synchronous per
 * day/week (breaks, maximum working time, Sunday/holiday work - delegated to
 * application/schedule/scheduleValidation.ts's validateWeekSync, shared with the Monatsübersicht's
 * per-week warning) as well as asynchronous per employee across week boundaries (rest period, needs
 * the previous/next week from the repository). Every adult check runs alongside a JArbSchG (youth
 * labor protection) counterpart for employees under 18 (validateYouth*, from
 * domain/validation/arbzg/youthProtection.ts) - each of those returns [] immediately for an adult or
 * an employee with no recorded birth date, so this never changes an adult's results.
 *
 * validateWeekSync sets days with an absence to "Off" before checking (scheduleWithoutAbsentDays),
 * so that ArbZG rules don't fire against leftover shift data on vacation/sick days. The rest-period
 * check loads neighboring weeks directly from the repository and applies the same absence-clearing
 * there, since `absences` is not week-scoped (useAbsences loads all of a Branch's records).
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

      const isHoliday = createHolidayCheck(branch.federalState);
      const employees = await services.employee.forBranch(branch.id);
      const sync = validateWeekSync(schedule, absences, branch, employees, isHoliday);

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
