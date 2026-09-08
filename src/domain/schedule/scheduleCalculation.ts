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

/** The hours actually SCHEDULED for that day, from the entered shift times. This is the
 * ArbZG-facing number: legal limits apply to the time the person is really at work, so the manual
 * override deliberately does NOT apply here. Overriding a 10h shift down to 8h still raises the
 * §3 ArbZG error, because the person still worked 10h. */
export function dayEntryNetMinutes(entry: DayEntry): number {
  return entry.type === 'Shift' ? entry.shifts.reduce((sum, s) => sum + shiftNetMinutes(s), 0) : 0;
}

/** The hours that COUNT for that day: the manual override if one was entered, otherwise the
 * scheduled hours. Everything that totals hours for a person or a branch goes through here; nothing
 * under domain/validation/ ever may. Keep the two functions separate - merging them would silently
 * feed a manually corrected number into the working-time law checks. */
export function dayEntryWorkedMinutes(entry: DayEntry): number {
  if (entry.type === 'Shift' && entry.netMinutesOverride !== undefined) {
    return entry.netMinutesOverride;
  }
  return dayEntryNetMinutes(entry);
}

export function weekAssignmentNetMinutes(assignment: EmployeeWeekAssignment): number {
  return WEEKDAYS.reduce((sum, day) => sum + dayEntryNetMinutes(assignment.days[day]), 0);
}

/** Rounds to 2 decimal places (e.g. 7.5 hrs) to avoid float rounding artifacts in the display. */
export function minutesToDecimalHours(minutes: number): number {
  return Math.round((minutes / 60) * 100) / 100;
}

/** Minutes as German decimal hours: 450 -> "7,5". The single place that turns minutes into text,
 * so a comma can never turn back into a point somewhere. Also used by the ArbZG messages in
 * domain/validation/arbzg - the formatting rule in src/ui/CLAUDE.md is not a UI-only rule. */
export function formatHoursGerman(minutes: number): string {
  return minutesToDecimalHours(minutes).toLocaleString('de-DE');
}

/** Formats a minutes range as German decimal hours: a single number when both bounds are equal
 * (FullTime/PartTime), "6-10" when they differ (Minijob). Single place, so the Soll column, the
 * monthly overview and the branch tile can never drift apart in how they render a range. */
export function formatHoursRangeGerman(minMinutes: number, maxMinutes: number): string {
  const minText = formatHoursGerman(minMinutes);
  if (minMinutes === maxMinutes) {
    return minText;
  }
  return `${minText}-${formatHoursGerman(maxMinutes)}`;
}
