import { WEEKDAYS, dateForWeekday, mondayOfWeek } from '@domain/shared/CalendarWeek';
import type { Weekday } from '@domain/shared/CalendarWeek';
import { toISODate } from '@domain/shared/DateFormat';
import type { Employee } from '@domain/employee/Employee';
import { compareByLastName, isEmployedDuring } from '@domain/employee/Employee';
import type { WeeklySchedule } from '@domain/schedule/WeeklySchedule';
import type { Absence } from '@domain/absence/Absence';
import type { Break } from '@domain/schedule/Break';
import type { Shift } from '@domain/schedule/Shift';
import { minutesToDecimalHours } from '@domain/schedule/scheduleCalculation';
import { createWeekView, hasAnyEntry } from '@application/schedule/scheduleAssessment';
import type { DayView } from '@application/schedule/scheduleAssessment';

export function formatDecimalHours(minutes: number): string {
  if (minutes === 0) {
    return '';
  }
  return minutesToDecimalHours(minutes).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function absenceAbbreviation(absence: Absence): string {
  switch (absence.type) {
    case 'Vacation':
      return 'U';
    case 'Illness':
      return 'K';
    case 'PublicHoliday':
      return 'F';
    case 'Other':
      return absence.label;
  }
}

export interface PrintBreakCell {
  timeText: string;
  hoursText: string;
}

export interface PrintDayCell {
  date: string;
  timeText: string;
  hoursText: string;
  /** Always exactly 2 entries; the paper form always has 2 break rows per day, regardless of
   * whether 0, 1, or 2 breaks were actually entered. With more than 2 breaks, the remainder is
   * summed into the second row. */
  breaks: [PrintBreakCell, PrintBreakCell];
  isAbsent: boolean;
  absenceAbbreviation?: string;
}

const EMPTY_BREAK_CELL: PrintBreakCell = { timeText: '', hoursText: '' };

function formatBreakCell(breakEntry: Break | undefined): PrintBreakCell {
  if (!breakEntry) {
    return EMPTY_BREAK_CELL;
  }
  return { timeText: breakEntry.start ?? '', hoursText: formatDecimalHours(breakEntry.durationMinutes) };
}

function breaksForDay(shifts: Shift[]): [PrintBreakCell, PrintBreakCell] {
  const breaks = shifts.flatMap((s) => s.breaks);
  if (breaks.length <= 2) {
    return [formatBreakCell(breaks[0]), formatBreakCell(breaks[1])];
  }
  const remainingMinutes = breaks.slice(1).reduce((sum, b) => sum + b.durationMinutes, 0);
  return [formatBreakCell(breaks[0]), { timeText: '', hoursText: formatDecimalHours(remainingMinutes) }];
}

function toPrintCell(dayView: DayView): PrintDayCell {
  // A half-day vacation day still has real worked hours - only a full-day Absence collapses to just
  // the abbreviation with no shift data. Read from the explicit flag, not from "minutes === 0":
  // a day whose hours were manually overridden to 0 is not an absence.
  if (dayView.absenceCoversWholeDay && dayView.absence) {
    return {
      date: dayView.date,
      timeText: absenceAbbreviation(dayView.absence),
      hoursText: '',
      breaks: [EMPTY_BREAK_CELL, EMPTY_BREAK_CELL],
      isAbsent: true,
      absenceAbbreviation: absenceAbbreviation(dayView.absence),
    };
  }

  if (dayView.entry.type !== 'Shift' || dayView.entry.shifts.length === 0) {
    return {
      date: dayView.date,
      timeText: '',
      hoursText: '',
      breaks: [EMPTY_BREAK_CELL, EMPTY_BREAK_CELL],
      isAbsent: false,
    };
  }

  const timeText = dayView.entry.shifts.map((s) => `${s.start}-${s.end}`).join(' / ');

  return {
    date: dayView.date,
    timeText,
    hoursText: formatDecimalHours(dayView.workedMinutes),
    breaks: breaksForDay(dayView.entry.shifts),
    isAbsent: false,
    absenceAbbreviation: dayView.absence ? absenceAbbreviation(dayView.absence) : undefined,
  };
}

interface PrintRowBase {
  employee: Employee;
  days: Record<Weekday, PrintDayCell>;
  totalHoursWeek: string;
}

export interface PrintRowFullPartTime extends PrintRowBase {
  weeklyHours: number;
}

export interface PrintRowMinijob extends PrintRowBase {
  minHours: number;
  maxHours: number;
}

export interface PrintData {
  fullPartTimeRows: PrintRowFullPartTime[];
  minijobRows: PrintRowMinijob[];
  /** Sum of net hours across all employees per weekday (decimal hours, rounded). */
  dayTotals: Record<Weekday, number>;
}

/**
 * Prepares the weekly-schedule data for print export (form 1: full-/part-time vs. form 2:
 * Minijob). Contains NO calculation logic of its own; relies exclusively on scheduleCalculation.ts
 * (via createWeekView), same as the interactive view, to avoid duplication.
 */
export function preparePrintData(
  schedule: WeeklySchedule,
  employeeList: Employee[],
  absences: Absence[],
  isHoliday?: (isoDate: string) => boolean,
): PrintData {
  const weekView = createWeekView(schedule, absences, { employees: employeeList, isHoliday });

  const fullPartTimeRows: PrintRowFullPartTime[] = [];
  const minijobRows: PrintRowMinijob[] = [];
  const dayTotalsMinutes: Record<Weekday, number> = Object.fromEntries(
    WEEKDAYS.map((day) => [day, 0]),
  ) as Record<Weekday, number>;

  const weekStart = toISODate(mondayOfWeek(schedule.calendarWeek));
  const weekEnd = toISODate(dateForWeekday(schedule.calendarWeek, 'Sonntag'));

  for (const assignment of weekView) {
    const employee = employeeList.find((e) => e.id === assignment.employeeId);
    if (!employee) {
      continue;
    }

    // Same visibility rule as the on-screen grid (see ui/views/schedule/scheduleRows.ts): someone
    // who may no longer be scheduled is only printed while they still carry entries. Without this,
    // every deactivated employee would occupy one of the nine columns per sheet with an empty
    // column and push real staff onto another sheet.
    const plannable = employee.active && isEmployedDuring(employee, weekStart, weekEnd);
    if (!plannable && !hasAnyEntry(assignment)) {
      continue;
    }

    for (const dayView of assignment.days) {
      dayTotalsMinutes[dayView.day] += dayView.workedMinutes;
    }

    const days = Object.fromEntries(assignment.days.map((d) => [d.day, toPrintCell(d)])) as Record<
      Weekday,
      PrintDayCell
    >;

    const base: PrintRowBase = {
      employee,
      days,
      // Worked hours only, deliberately: the paper form has to add up in both directions (the
      // seven day cells sum to this figure, and the Summe row sums the columns). Hours credited
      // without presence in the store - vacation days, "Sonstige" with hours - are an on-screen
      // figure for the Marktleiter, not part of the printed schedule the staff receives.
      totalHoursWeek: formatDecimalHours(assignment.workedMinutes),
    };

    if (employee.employmentType.type === 'Minijob') {
      minijobRows.push({
        ...base,
        minHours: employee.employmentType.minHours,
        maxHours: employee.employmentType.maxHours,
      });
    } else {
      fullPartTimeRows.push({ ...base, weeklyHours: employee.employmentType.weeklyHours });
    }
  }

  const dayTotals = Object.fromEntries(
    WEEKDAYS.map((day) => [day, minutesToDecimalHours(dayTotalsMinutes[day])]),
  ) as Record<Weekday, number>;

  // Column order on the printed form follows array order directly (see FullPartTimeForm /
  // MinijobForm), so sorting here is what actually controls the print layout, independent of
  // the order employees happen to be stored in the WeeklySchedule aggregate.
  fullPartTimeRows.sort((a, b) => compareByLastName(a.employee, b.employee));
  minijobRows.sort((a, b) => compareByLastName(a.employee, b.employee));

  return { fullPartTimeRows, minijobRows, dayTotals };
}
