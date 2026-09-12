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

  // Only deduct a boundary half-day when that boundary date is itself a real work day - a flagged
  // Sunday/holiday boundary was never a full work day to begin with, so there is nothing to halve
  // (and deducting anyway would under-charge entitlement by half a day).
  const workDayISOs = new Set(workDays.map((day) => toISODate(day)));
  let count = workDays.length;
  if (halfDay?.atStart && workDayISOs.has(from)) {
    count -= 0.5;
  }
  if (halfDay?.atEnd && workDayISOs.has(to)) {
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

type EmploymentPeriod = Pick<Employee, 'entryDate' | 'exitDate'>;

/** How many calendar months of `year` fall within the employee's employment period, treating any
 * day within a month as the WHOLE month worked - i.e. a mid-month entry/exit rounds up to a full
 * month rather than a fraction of one. This is the more employee-friendly of the two common
 * conventions and matches typical payroll practice for pro-rating annual leave (BUrlG § 5). Callers
 * must only call this once they know entry or exit actually falls inside `year` (see
 * proRatedVacationEntitlement) - it does not itself check that. */
function monthsEmployedIn(employee: EmploymentPeriod, year: number): number {
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;
  const from = employee.entryDate && employee.entryDate > yearStart ? employee.entryDate : yearStart;
  const to = employee.exitDate && employee.exitDate < yearEnd ? employee.exitDate : yearEnd;
  if (from > to) {
    return 0;
  }
  const fromMonth = Number(from.slice(5, 7));
  const toMonth = Number(to.slice(5, 7));
  return toMonth - fromMonth + 1;
}

/** The employee's vacation entitlement for `year`, reduced to 1/12 per month actually employed
 * during it (BUrlG § 5 practice) when entryDate and/or exitDate fall inside `year` - an employee
 * with no entry/exit in the given year (the vast majority of records) keeps their full annual
 * entitlement completely unchanged, matching behavior from before this function existed. The
 * resulting day count is rounded to the nearest whole day (kaufmännisch, i.e. standard
 * round-half-up) since a raw fractional result finer than the app's existing half-day granularity
 * would not be usable anywhere entitlement is actually booked against. */
export function proRatedVacationEntitlement(
  employee: Pick<Employee, 'vacationEntitlementPerYear'> & EmploymentPeriod,
  year: number,
): number {
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;
  const entersThisYear = !!employee.entryDate && employee.entryDate >= yearStart && employee.entryDate <= yearEnd;
  const exitsThisYear = !!employee.exitDate && employee.exitDate >= yearStart && employee.exitDate <= yearEnd;
  if (!entersThisYear && !exitsThisYear) {
    return employee.vacationEntitlementPerYear;
  }
  return Math.round((employee.vacationEntitlementPerYear / 12) * monthsEmployedIn(employee, year));
}

export function calculateRemainingVacation(
  employee: Pick<Employee, 'vacationEntitlementPerYear'> & EmploymentPeriod,
  daysTaken: number,
  year: number,
): number {
  return proRatedVacationEntitlement(employee, year) - daysTaken;
}

/** Remaining vacation for many employees at once, from an already-loaded list of absences that may
 * mix employees (e.g. everything for a Branch). Groups the list by employee first, so a view that
 * already holds the Branch's absences in memory derives every employee's remaining days
 * synchronously instead of issuing one repository query per employee. */
export function remainingVacationByEmployee(
  employees: (Pick<Employee, 'id' | 'vacationEntitlementPerYear'> & EmploymentPeriod)[],
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
        year,
      ),
    ]),
  );
}
