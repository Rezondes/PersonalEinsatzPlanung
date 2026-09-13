import { getISOWeek, getISOWeekYear, startOfISOWeek, addWeeks, subWeeks, addDays } from 'date-fns';
import { formatDateGerman } from './DateFormat';

/** ISO calendar week. `year` is the ISO week-year, which can differ from the calendar year
 * (e.g. depending on the year, Dec 30 may already belong to week 1 of the following year). */
export interface CalendarWeek {
  year: number;
  week: number;
}

/** Values stay German on purpose - shown verbatim as weekday headers in the UI (German store
 * managers), no separate display-label function exists for these. */
export const WEEKDAYS = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'] as const;
export type Weekday = (typeof WEEKDAYS)[number];

/** Abbreviated form of WEEKDAYS, for the schedule grid's day header at narrower breakpoints (the
 * mockup's mobile/tablet columns show "Mo"/"Di"/... instead of the full name, which only fits once
 * the header also has room for the laptop's wider, full-name + date layout). */
export const WEEKDAYS_SHORT: Record<Weekday, string> = {
  Montag: 'Mo',
  Dienstag: 'Di',
  Mittwoch: 'Mi',
  Donnerstag: 'Do',
  Freitag: 'Fr',
  Samstag: 'Sa',
  Sonntag: 'So',
};

export function calendarWeekFromDate(date: Date): CalendarWeek {
  return { year: getISOWeekYear(date), week: getISOWeek(date) };
}

/** Monday of the given calendar week, computed via Jan 4 (which by ISO-8601 definition
 * always falls in week 1 of that week-year) instead of date-fns' setISOWeek (not available in all versions). */
export function mondayOfWeek(cw: CalendarWeek): Date {
  const jan4th = new Date(cw.year, 0, 4);
  const mondayWeek1 = startOfISOWeek(jan4th);
  return addWeeks(mondayWeek1, cw.week - 1);
}

export function dateForWeekday(cw: CalendarWeek, day: Weekday): Date {
  const index = WEEKDAYS.indexOf(day);
  return addDays(mondayOfWeek(cw), index);
}

/** "KW <week> · <Monday> – <Sunday>" - the app's one shared label for a calendar week's range,
 * used in the Wochenplanung header, the week picker, and the previous-week carry-over dialog, so
 * the format (separators, which weekday bounds the range) can't drift between them. */
export function formatCalendarWeekRange(cw: CalendarWeek): string {
  return `KW ${cw.week} · ${formatDateGerman(mondayOfWeek(cw))} – ${formatDateGerman(dateForWeekday(cw, 'Sonntag'))}`;
}

export function previousCalendarWeek(cw: CalendarWeek): CalendarWeek {
  return calendarWeekFromDate(subWeeks(mondayOfWeek(cw), 1));
}

export function nextCalendarWeek(cw: CalendarWeek): CalendarWeek {
  return calendarWeekFromDate(addWeeks(mondayOfWeek(cw), 1));
}

export function calendarWeeksEqual(a: CalendarWeek, b: CalendarWeek): boolean {
  return a.year === b.year && a.week === b.week;
}

/** German month names, index 0 = Januar - shared by MonthOverviewView and WeekSelectionDialog's
 * month headers (used to live as byte-identical local copies in both). */
export const MONTH_NAMES = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
];

/** Moves one calendar month back or forward (month: 1-12), rolling over into the adjacent year at
 * the Januar/Dezember edge. Extracted from MonthOverviewView/WeekSelectionDialog's identical
 * `changeMonth`, which each kept their own year/month state (a shared hook would have had nothing
 * to hold, since both already manage that state differently themselves). */
export function stepMonth(year: number, month: number, direction: -1 | 1): { year: number; month: number } {
  let newMonth = month + direction;
  let newYear = year;
  if (newMonth < 1) {
    newMonth = 12;
    newYear -= 1;
  } else if (newMonth > 12) {
    newMonth = 1;
    newYear += 1;
  }
  return { year: newYear, month: newMonth };
}

/** All calendar weeks whose Monday falls in the given calendar month (month: 1-12). */
export function calendarWeeksInMonth(year: number, month: number): CalendarWeek[] {
  const lastDayOfMonth = new Date(year, month, 0);
  const weeks: CalendarWeek[] = [];

  let monday = startOfISOWeek(new Date(year, month - 1, 1));
  while (monday <= lastDayOfMonth) {
    if (monday.getMonth() === month - 1) {
      weeks.push(calendarWeekFromDate(monday));
    }
    monday = addWeeks(monday, 1);
  }
  return weeks;
}
