import { eachDayOfInterval, getDay, parseISO } from 'date-fns';
import type { Employee } from '@domain/employee/Employee';
import type { EmployeeId } from '@domain/shared/ids';
import { toISODate } from '@domain/shared/DateFormat';
import type { Absence } from './Absence';

/** Counts work days (Mon-Sat, 6-day week per BUrlG practice) in the period, excluding Sundays and,
 * if `isHoliday` is given, public holidays - a public holiday isn't a work day the employee would
 * otherwise have worked, so taking vacation on it (or a range including it) should not consume
 * vacation entitlement for that day (standard BUrlG interpretation). `isHoliday` is injected
 * (federal-state-specific, from infrastructure) since domain/ has no federal-state knowledge of its own. */
export function countWorkDays(
  from: string,
  to: string,
  halfDay?: { atStart: boolean; atEnd: boolean },
  isHoliday?: (isoDate: string) => boolean,
): number {
  const workDays = eachDayOfInterval({ start: parseISO(from), end: parseISO(to) }).filter(
    (day) => getDay(day) !== 0 && !isHoliday?.(toISODate(day)),
  );
  if (workDays.length === 0) {
    return 0;
  }

  if (from === to) {
    // atStart/atEnd both true on a single-day range is a redundant (not additive) description of
    // the same one half-day - without this guard, subtracting both would wrongly zero out the day.
    const isHalfDay = !!halfDay?.atStart || !!halfDay?.atEnd;
    return isHalfDay ? 0.5 : workDays.length;
  }

  let count = workDays.length;
  if (halfDay?.atStart) {
    count -= 0.5;
  }
  if (halfDay?.atEnd) {
    count -= 0.5;
  }
  return Math.max(count, 0);
}

/** Counts vacation days that fall within `year`, clipping ranges that cross a year boundary (e.g.
 * Dec 29 - Jan 2) to just the portion inside that year - a plain `from`-year filter would either
 * drop such a range from both years or double-count it into the wrong one. A halfDay flag only
 * applies at whichever end is the absence's real start/end, not at an artificial clip point. */
export function countVacationDaysInYear(
  absences: Absence[],
  year: number,
  isHoliday?: (isoDate: string) => boolean,
): number {
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;

  return absences
    .filter((a): a is Extract<Absence, { type: 'Vacation' }> => a.type === 'Vacation')
    .reduce((sum, a) => {
      const from = a.from < yearStart ? yearStart : a.from;
      const to = a.to > yearEnd ? yearEnd : a.to;
      if (from > to) {
        return sum;
      }
      const halfDay = {
        atStart: from === a.from && !!a.halfDay?.atStart,
        atEnd: to === a.to && !!a.halfDay?.atEnd,
      };
      return sum + countWorkDays(from, to, halfDay, isHoliday);
    }, 0);
}

export function calculateRemainingVacation(
  employee: Pick<Employee, 'vacationEntitlementPerYear'>,
  daysTaken: number,
): number {
  return employee.vacationEntitlementPerYear - daysTaken;
}

/** Remaining vacation for many employees at once, from an already-loaded list of absences that may
 * mix employees (e.g. everything for a Branch). Groups the list by employee first, so a view that
 * already holds the Branch's absences in memory derives every employee's remaining days
 * synchronously instead of issuing one repository query per employee. */
export function remainingVacationByEmployee(
  employees: Pick<Employee, 'id' | 'vacationEntitlementPerYear'>[],
  absences: Absence[],
  year: number,
  isHoliday?: (isoDate: string) => boolean,
): Map<EmployeeId, number> {
  const absencesByEmployee = new Map<EmployeeId, Absence[]>();
  for (const absence of absences) {
    const list = absencesByEmployee.get(absence.employeeId);
    if (list) {
      list.push(absence);
    } else {
      absencesByEmployee.set(absence.employeeId, [absence]);
    }
  }

  return new Map(
    employees.map((employee) => [
      employee.id,
      calculateRemainingVacation(
        employee,
        countVacationDaysInYear(absencesByEmployee.get(employee.id) ?? [], year, isHoliday),
      ),
    ]),
  );
}
