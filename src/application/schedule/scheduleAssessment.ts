import type { EmployeeId } from '@domain/shared/ids';
import type { CalendarWeek, Weekday } from '@domain/shared/CalendarWeek';
import { WEEKDAYS, dateForWeekday, calendarWeeksInMonth } from '@domain/shared/CalendarWeek';
import { toISODate } from '@domain/shared/DateFormat';
import type { WeeklySchedule } from '@domain/schedule/WeeklySchedule';
import type { DayEntry } from '@domain/schedule/EmployeeWeekAssignment';
import { dayEntryNetMinutes } from '@domain/schedule/scheduleCalculation';
import type { Absence } from '@domain/absence/Absence';
import type { Employee } from '@domain/employee/Employee';
import { targetWeeklyHours } from '@domain/employee/EmploymentType';

export interface DayView {
  day: Weekday;
  date: string;
  entry: DayEntry;
  absence?: Absence;
  netMinutes: number;
}

export interface EmployeeWeekView {
  employeeId: EmployeeId;
  days: DayView[];
  totalNetMinutes: number;
  /** Carried over from EmployeeWeekAssignment.targetAdjustmentMinutes (0 if not set) - see
   * effectiveTargetMinutes. */
  targetAdjustmentMinutes: number;
}

/** This week's effective target hours for one employee: their contract target (targetWeeklyHours),
 * adjusted by any carry-over from the previous week (Punkt 6 der Wochenplanung-Feature-Liste). */
export function effectiveTargetMinutes(
  employee: Pick<Employee, 'employmentType'>,
  weekViewEntry: Pick<EmployeeWeekView, 'targetAdjustmentMinutes'>,
): number {
  return targetWeeklyHours(employee.employmentType) * 60 + weekViewEntry.targetAdjustmentMinutes;
}

function findAbsenceForDay(
  absences: Absence[],
  employeeId: EmployeeId,
  date: string,
): Absence | undefined {
  return absences.find((a) => a.employeeId === employeeId && a.from <= date && date <= a.to);
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
function effectiveNetMinutes(entry: DayEntry, absence: Absence | undefined, date: string): number {
  if (!absence || isHalfDayOnThisDate(absence, date)) {
    return dayEntryNetMinutes(entry);
  }
  return 0;
}

/** Overlays Absences onto the weekly schedule at display time (instead of storing them in the aggregate),
 * avoiding sync problems between the WeeklySchedule and Absence aggregates. */
export function createWeekView(schedule: WeeklySchedule, absences: Absence[]): EmployeeWeekView[] {
  return schedule.employeeAssignments.map((assignment) => {
    const days: DayView[] = WEEKDAYS.map((day) => {
      const date = toISODate(dateForWeekday(schedule.calendarWeek, day));
      const entry = assignment.days[day];
      const absence = findAbsenceForDay(absences, assignment.employeeId, date);
      return {
        day,
        date,
        entry,
        absence,
        netMinutes: effectiveNetMinutes(entry, absence, date),
      };
    });

    return {
      employeeId: assignment.employeeId,
      days,
      totalNetMinutes: days.reduce((sum, d) => sum + d.netMinutes, 0),
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
  netMinutes: number;
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
  absences: Absence[] = [],
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

    // Reuses createWeekView instead of re-walking days/Absences here - the per-day
    // overlay logic (findAbsenceForDay + effectiveNetMinutes, including the half-day
    // handling) must only exist once.
    const weekView = createWeekView(schedule, absences);

    for (const entry of weekView) {
      const existingRow = rowsByEmployee.get(entry.employeeId);
      const weekRow: MonthWeekRow = { calendarWeek: cw, netMinutes: entry.totalNetMinutes };

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
