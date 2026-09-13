import type { EmployeeId } from '@domain/shared/ids';
import type { Weekday } from '@domain/shared/CalendarWeek';
import { WEEKDAYS } from '@domain/shared/CalendarWeek';
import type { Shift } from './Shift';
import { withFreshShiftIds } from './Shift';

/** `netMinutesOverride` replaces the computed net minutes of the WHOLE day when the recorded
 * times don't match what should be counted (see scheduleCalculation.dayEntryWorkedMinutes).
 * It never influences the ArbZG checks: those go through dayEntryNetMinutes, which ignores it. */
export type DayEntry =
  | { type: 'Shift'; shifts: Shift[]; netMinutesOverride?: number }
  | { type: 'Off' };

export interface EmployeeWeekAssignment {
  employeeId: EmployeeId;
  days: Record<Weekday, DayEntry>;
  /** Adjustment to this week's target hours, carried forward from the previous week's actual/target
   * difference (see WeeklySchedule.withTargetAdjustment). Positive = more target expected this week
   * (was behind), negative = less (was ahead). Absent/undefined is treated as 0 everywhere. */
  targetAdjustmentMinutes?: number;
}

/** Copies an assignment's shift ids fresh and drops any manual netMinutesOverride, for reuse
 * across a different week (scheduleService.copyFromPreviousWeek) - otherwise the copy would
 * reference the very same Shift objects as its source, and an override correcting one specific
 * day would carry into a week it was never entered for. Does not touch targetAdjustmentMinutes;
 * that reset is a separate, unrelated concern the caller already handles on its own. */
export function withFreshDayEntryIds(assignment: EmployeeWeekAssignment): EmployeeWeekAssignment {
  const days = Object.fromEntries(
    WEEKDAYS.map((day) => {
      const entry = assignment.days[day];
      return [day, entry.type === 'Shift' ? { type: 'Shift' as const, shifts: withFreshShiftIds(entry.shifts) } : entry];
    }),
  ) as Record<Weekday, DayEntry>;
  return { ...assignment, days };
}

export function emptyWeekAssignment(employeeId: EmployeeId): EmployeeWeekAssignment {
  const days = Object.fromEntries(WEEKDAYS.map((day) => [day, { type: 'Off' } as DayEntry])) as Record<
    Weekday,
    DayEntry
  >;
  return { employeeId, days };
}
