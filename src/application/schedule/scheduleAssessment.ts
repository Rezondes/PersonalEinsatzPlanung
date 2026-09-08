import type { EmployeeId } from '@domain/shared/ids';
import type { CalendarWeek, Weekday } from '@domain/shared/CalendarWeek';
import { WEEKDAYS, dateForWeekday, calendarWeeksInMonth } from '@domain/shared/CalendarWeek';
import { toISODate } from '@domain/shared/DateFormat';
import type { WeeklySchedule } from '@domain/schedule/WeeklySchedule';
import type { DayEntry } from '@domain/schedule/EmployeeWeekAssignment';
import { dayEntryWorkedMinutes } from '@domain/schedule/scheduleCalculation';
import type { Absence } from '@domain/absence/Absence';
import type { Employee } from '@domain/employee/Employee';
import type { WeeklyHoursRange } from '@domain/employee/EmploymentType';
import { targetWeeklyHours, targetWeeklyHoursRange } from '@domain/employee/EmploymentType';

/** Everything the hour overlay needs to know about an employee. A Pick, so callers can pass their
 * existing Employee list (same convention as vacationCalculation.remainingVacationByEmployee). */
export type EmployeeHoursInfo = Pick<Employee, 'id' | 'holidayVacationHours'>;

/** Context for the hour overlay. Deliberately a required options object rather than optional
 * positional parameters: a defaulted employee list would silently credit 0 hours at every call site
 * someone forgets to update, and that is invisible in the UI. `isHoliday` stays optional inside it,
 * matching vacationCalculation's injection pattern (domain/application stay federal-state-agnostic). */
export interface WeekViewContext {
  employees: readonly EmployeeHoursInfo[];
  /** Same check that keeps a public holiday from consuming vacation entitlement
   * (vacationCalculation.countWorkDays). Built via infrastructure/holidays/createHolidayCheck. */
  isHoliday?: (isoDate: string) => boolean;
}

export interface DayView {
  day: Weekday;
  date: string;
  entry: DayEntry;
  absence?: Absence;
  /** True when the absence covers this whole day (as opposed to a half-day vacation, where the
   * entered shift still represents the worked half). Rendering and the print export branch on this
   * instead of on "minutes === 0", which stopped being a reliable proxy once a day's hours can be
   * manually overridden to zero. */
  absenceCoversWholeDay: boolean;
  /** Hours actually worked in the store (shift minus breaks, or the day's manual override).
   * 0 on a full-day absence. This is the ONLY figure that may feed a branch-wide total. */
  workedMinutes: number;
  /** Hours paid without presence in the store: a vacation day (Employee.holidayVacationHours) or an
   * "Other" absence carrying hoursPerDay. Counts for the employee, never for the branch. */
  creditedMinutes: number;
}

export interface EmployeeWeekView {
  employeeId: EmployeeId;
  days: DayView[];
  /** Sum of the days' workedMinutes - this employee's contribution to the branch total. */
  workedMinutes: number;
  /** Sum of the days' creditedMinutes. */
  creditedMinutes: number;
  /** This employee's Ist-Wochenstunden: workedMinutes + creditedMinutes. Basis of the Soll/Ist
   * comparison, the monthly overview and the previous week's carry-over. */
  totalNetMinutes: number;
  /** Carried over from EmployeeWeekAssignment.targetAdjustmentMinutes (0 if not set) - see
   * effectiveTargetMinutes. */
  targetAdjustmentMinutes: number;
}

/** This week's effective target hours for one employee as a range: their contract target
 * (targetWeeklyHoursRange) adjusted by any carry-over from the previous week (Punkt 6 der
 * Wochenplanung-Feature-Liste). For FullTime/PartTime min and max are the same number; only a
 * Minijob has a real band, and hours inside that band are not a deviation. */
export function effectiveTargetMinutesRange(
  employee: Pick<Employee, 'employmentType'>,
  weekViewEntry: Pick<EmployeeWeekView, 'targetAdjustmentMinutes'>,
): WeeklyHoursRange {
  const range = targetWeeklyHoursRange(employee.employmentType);
  return {
    min: range.min * 60 + weekViewEntry.targetAdjustmentMinutes,
    max: range.max * 60 + weekViewEntry.targetAdjustmentMinutes,
  };
}

/** The single-number variant (upper bound), for the one caller that needs exactly one figure: the
 * previous week's carry-over calculation. The Soll/Ist comparison uses the range above. */
export function effectiveTargetMinutes(
  employee: Pick<Employee, 'employmentType'>,
  weekViewEntry: Pick<EmployeeWeekView, 'targetAdjustmentMinutes'>,
): number {
  return targetWeeklyHours(employee.employmentType) * 60 + weekViewEntry.targetAdjustmentMinutes;
}

/** Absences may overlap - the typical case is a single-day "Sonstige" public-holiday entry inside a
 * week-long vacation range. Which one wins decides how many hours get credited, so the choice must
 * not depend on the repository's return order: the narrower range wins (it is the more specific
 * statement about that day), with the older entry as a stable tiebreaker. */
function findAbsenceForDay(
  absences: Absence[],
  employeeId: EmployeeId,
  date: string,
): Absence | undefined {
  const matches = absences.filter((a) => a.employeeId === employeeId && a.from <= date && date <= a.to);
  if (matches.length <= 1) {
    return matches[0];
  }
  return [...matches].sort((a, b) => {
    const spanA = Date.parse(a.to) - Date.parse(a.from);
    const spanB = Date.parse(b.to) - Date.parse(b.from);
    return spanA - spanB || a.createdAt.localeCompare(b.createdAt);
  })[0];
}

/** A half-day vacation only covers the first/last day of its range, and only the half that
 * `atStart`/`atEnd` marks - the entered shift for that day reflects real worked hours for the
 * other half and must not be discarded. */
function isHalfDayOnThisDate(absence: Absence, date: string): boolean {
  if (absence.type !== 'Vacation' || !absence.halfDay) {
    return false;
  }
  return (date === absence.from && absence.halfDay.atStart) ||
    (date === absence.to && absence.halfDay.atEnd);
}

/** On a full-day Absence, any shift still stored there does NOT count as actual hours. The shift
 * data stays in the aggregate (in case the Absence is later removed again), but is excluded from
 * hour totals as long as the Absence covers the whole day. A half-day keeps counting the
 * entered shift, since it represents the worked half. */
function workedMinutesFor(entry: DayEntry, coversWholeDay: boolean): number {
  return coversWholeDay ? 0 : dayEntryWorkedMinutes(entry);
}

/** Hours paid without presence in the store.
 *
 * Vacation draws on the employee's holidayVacationHours, but only on days that actually consume
 * vacation entitlement: Mon-Sat, excluding public holidays - the same rule as
 * vacationCalculation.countWorkDays. Otherwise a Mon-Sun vacation would credit seven days' worth
 * and push the employee over their weekly target.
 *
 * "Other" credits exactly what was entered, on every day of its range including Sunday and
 * holidays: it is the manual escape hatch (this is how a public holiday gets its hours), so the
 * number the user typed is the number that counts.
 *
 * Illness credits nothing. Employees stored before holidayVacationHours existed fall back to 0
 * rather than producing NaN. */
function creditedMinutesFor(
  absence: Absence | undefined,
  employee: EmployeeHoursInfo | undefined,
  day: Weekday,
  date: string,
  isHoliday: ((isoDate: string) => boolean) | undefined,
): number {
  if (!absence) {
    return 0;
  }
  if (absence.type === 'Other') {
    return (absence.hoursPerDay ?? 0) * 60;
  }
  if (absence.type !== 'Vacation') {
    return 0;
  }
  if (day === 'Sonntag' || isHoliday?.(date)) {
    return 0;
  }
  const fullDayMinutes = (employee?.holidayVacationHours ?? 0) * 60;
  return isHalfDayOnThisDate(absence, date) ? fullDayMinutes / 2 : fullDayMinutes;
}

/** Overlays Absences onto the weekly schedule at display time (instead of storing them in the aggregate),
 * avoiding sync problems between the WeeklySchedule and Absence aggregates. Needs the employees
 * because a vacation day's credited hours are a per-employee figure. */
export function createWeekView(
  schedule: WeeklySchedule,
  absences: Absence[],
  context: WeekViewContext,
): EmployeeWeekView[] {
  const employeeById = new Map(context.employees.map((e) => [e.id, e]));

  return schedule.employeeAssignments.map((assignment) => {
    // May be undefined for an orphaned assignment (hard-deleted employee, see ScheduleView's
    // weekView memo); creditedMinutesFor then falls back to 0 instead of throwing.
    const employee = employeeById.get(assignment.employeeId);

    const days: DayView[] = WEEKDAYS.map((day) => {
      const date = toISODate(dateForWeekday(schedule.calendarWeek, day));
      const entry = assignment.days[day];
      const absence = findAbsenceForDay(absences, assignment.employeeId, date);
      const absenceCoversWholeDay = absence !== undefined && !isHalfDayOnThisDate(absence, date);
      return {
        day,
        date,
        entry,
        absence,
        absenceCoversWholeDay,
        workedMinutes: workedMinutesFor(entry, absenceCoversWholeDay),
        creditedMinutes: creditedMinutesFor(absence, employee, day, date, context.isHoliday),
      };
    });

    const workedMinutes = days.reduce((sum, d) => sum + d.workedMinutes, 0);
    const creditedMinutes = days.reduce((sum, d) => sum + d.creditedMinutes, 0);

    return {
      employeeId: assignment.employeeId,
      days,
      workedMinutes,
      creditedMinutes,
      totalNetMinutes: workedMinutes + creditedMinutes,
      targetAdjustmentMinutes: assignment.targetAdjustmentMinutes ?? 0,
    };
  });
}

/** Returns a copy of the weekly schedule where days with an Absence are set to "Off". Used as the
 * basis for validation (ArbZG rules shouldn't check against leftover shifts on vacation/sick days). */
export function scheduleWithoutAbsentDays(schedule: WeeklySchedule, absences: Absence[]): WeeklySchedule {
  const employeeAssignments = schedule.employeeAssignments.map((assignment) => {
    const days = Object.fromEntries(
      WEEKDAYS.map((day) => {
        const date = toISODate(dateForWeekday(schedule.calendarWeek, day));
        const hasAbsence = findAbsenceForDay(absences, assignment.employeeId, date) !== undefined;
        return [day, hasAbsence ? ({ type: 'Off' } satisfies DayEntry) : assignment.days[day]];
      }),
    ) as Record<Weekday, DayEntry>;
    return { ...assignment, days };
  });

  return { ...schedule, employeeAssignments };
}

export interface MonthWeekRow {
  calendarWeek: CalendarWeek;
  /** Per employee, so this includes credited (vacation/"Other") hours - unlike a branch total. */
  totalNetMinutes: number;
}

export interface MonthRow {
  employeeId: EmployeeId;
  weeks: MonthWeekRow[];
  totalNetMinutes: number;
}

/** Aggregates multiple weekly schedules into a monthly overview per employee. A calendar week belongs
 * to the month its Monday falls in (see calendarWeeksInMonth). */
export function createMonthOverview(
  schedules: WeeklySchedule[],
  year: number,
  month: number,
  absences: Absence[],
  context: WeekViewContext,
): MonthRow[] {
  const relevantWeeks = calendarWeeksInMonth(year, month);
  const rowsByEmployee = new Map<EmployeeId, MonthRow>();

  for (const cw of relevantWeeks) {
    const schedule = schedules.find(
      (s) => s.calendarWeek.year === cw.year && s.calendarWeek.week === cw.week,
    );
    if (!schedule) {
      continue;
    }

    // Reuses createWeekView instead of re-walking days/Absences here - the per-day overlay logic
    // (findAbsenceForDay + workedMinutesFor/creditedMinutesFor, including the half-day handling)
    // must only exist once.
    const weekView = createWeekView(schedule, absences, context);

    for (const entry of weekView) {
      const existingRow = rowsByEmployee.get(entry.employeeId);
      const weekRow: MonthWeekRow = { calendarWeek: cw, totalNetMinutes: entry.totalNetMinutes };

      if (existingRow) {
        existingRow.weeks.push(weekRow);
        existingRow.totalNetMinutes += entry.totalNetMinutes;
      } else {
        rowsByEmployee.set(entry.employeeId, {
          employeeId: entry.employeeId,
          weeks: [weekRow],
          totalNetMinutes: entry.totalNetMinutes,
        });
      }
    }
  }

  return [...rowsByEmployee.values()];
}
