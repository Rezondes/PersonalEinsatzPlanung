import type { CalendarWeek } from '@domain/shared/CalendarWeek';
import { calendarWeekFromDate } from '@domain/shared/CalendarWeek';

/**
 * The `?kw=` (Wochenplanung) and `?monat=` (Monatsübersicht) query values that make a week or a
 * month linkable and survive F5. A UI/URL concern, hence here and not in the domain layer. Both
 * formats are fixed-width ("2026-09"), and parsing rejects anything that is not a real week or
 * month instead of guessing - the caller then falls back to today.
 */

const YEAR_AND_TWO_DIGITS = /^(\d{4})-(\d{2})$/;

export function formatWeekParam(cw: CalendarWeek): string {
  return `${cw.year}-${String(cw.week).padStart(2, '0')}`;
}

/** ISO weeks per year: 28 December always falls into the last ISO week of its year. */
function weeksInYear(year: number): number {
  return calendarWeekFromDate(new Date(year, 11, 28)).week;
}

export function parseWeekParam(value: string | null): CalendarWeek | null {
  const match = value ? YEAR_AND_TWO_DIGITS.exec(value) : null;
  if (!match) return null;
  const year = Number(match[1]);
  const week = Number(match[2]);
  return week >= 1 && week <= weeksInYear(year) ? { year, week } : null;
}

export function formatMonthParam(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

export function parseMonthParam(value: string | null): { year: number; month: number } | null {
  const match = value ? YEAR_AND_TWO_DIGITS.exec(value) : null;
  if (!match) return null;
  const month = Number(match[2]);
  return month >= 1 && month <= 12 ? { year: Number(match[1]), month } : null;
}
