import { clockTimeToMinutes } from '@domain/shared/ClockTime';
import { WEEKDAYS } from '@domain/shared/CalendarWeek';
import type { Shift } from './Shift';
import type { DayEntry, EmployeeWeekAssignment } from './EmployeeWeekAssignment';

export function shiftGrossMinutes(shift: Shift): number {
  const start = clockTimeToMinutes(shift.start);
  let end = clockTimeToMinutes(shift.end);
  if (shift.endsNextDay) {
    end += 24 * 60;
  }
  return end - start;
}

export function shiftBreakMinutes(shift: Shift): number {
  return shift.breaks.reduce((sum, b) => sum + b.durationMinutes, 0);
}

export function shiftNetMinutes(shift: Shift): number {
  return shiftGrossMinutes(shift) - shiftBreakMinutes(shift);
}

export function dayEntryNetMinutes(entry: DayEntry): number {
  return entry.type === 'Shift' ? entry.shifts.reduce((sum, s) => sum + shiftNetMinutes(s), 0) : 0;
}

export function weekAssignmentNetMinutes(assignment: EmployeeWeekAssignment): number {
  return WEEKDAYS.reduce((sum, day) => sum + dayEntryNetMinutes(assignment.days[day]), 0);
}

/** Rounds to 2 decimal places (e.g. 7.5 hrs) to avoid float rounding artifacts in the display. */
export function minutesToDecimalHours(minutes: number): number {
  return Math.round((minutes / 60) * 100) / 100;
}
