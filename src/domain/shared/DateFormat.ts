import type { ClockTime } from './ClockTime';
import { clockTimeToMinutes } from './ClockTime';

export function toISODate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** The app's one and only date display format: DD.MM.YYYY, always zero-padded. Deliberately not
 * `Date.toLocaleDateString('de-DE')` - that neither zero-pads nor guarantees this exact shape
 * across browsers/environments, it just happens to look similar. Used everywhere a date is shown
 * to the user as read-only text (native `<input type="date">` pickers are unaffected - their
 * display format is controlled by the browser/OS, not by this app). */
export function formatDateGerman(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
}

/** Same as formatDateGerman, but takes an ISO date string ("YYYY-MM-DD", e.g. Absence.from)
 * directly instead of a Date - plain string rearrangement, no Date parsing/timezone involved. */
export function formatISODateGerman(isoDate: string): string {
  const [year, month, day] = isoDate.split('-');
  return `${day}.${month}.${year}`;
}

/** Combines an ISO date ("yyyy-MM-dd") with a time into a concrete local point in time.
 * Uses the overloaded Date constructor, which automatically rolls minutes >59 into hours. */
export function combineDateAndTime(isoDate: string, time: ClockTime): Date {
  const [year, month, day] = isoDate.split('-').map(Number);
  const minutesSinceMidnight = clockTimeToMinutes(time);
  return new Date(year, month - 1, day, 0, minutesSinceMidnight);
}
