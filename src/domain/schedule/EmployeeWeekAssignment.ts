import type { EmployeeId } from '@domain/shared/ids';
import type { Weekday } from '@domain/shared/CalendarWeek';
import { WEEKDAYS } from '@domain/shared/CalendarWeek';
import type { Shift } from './Shift';

export type DayEntry = { type: 'Shift'; shifts: Shift[] } | { type: 'Off' };

export interface EmployeeWeekAssignment {
  employeeId: EmployeeId;
  days: Record<Weekday, DayEntry>;
  /** Adjustment to this week's target hours, carried forward from the previous week's actual/target
   * difference (see WeeklySchedule.withTargetAdjustment). Positive = more target expected this week
   * (was behind), negative = less (was ahead). Absent/undefined is treated as 0 everywhere. */
  targetAdjustmentMinutes?: number;
}

export function emptyWeekAssignment(employeeId: EmployeeId): EmployeeWeekAssignment {
  const days = Object.fromEntries(WEEKDAYS.map((day) => [day, { type: 'Off' } as DayEntry])) as Record<
    Weekday,
    DayEntry
  >;
  return { employeeId, days };
}
