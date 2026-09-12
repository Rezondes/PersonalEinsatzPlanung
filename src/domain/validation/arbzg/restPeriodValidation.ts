import { addDays, differenceInMinutes } from 'date-fns';
import type { EmployeeId } from '@domain/shared/ids';
import type { Shift } from '@domain/schedule/Shift';
import { combineDateAndTime, formatDateGerman, toISODate } from '@domain/shared/DateFormat';
import { formatHoursGerman } from '@domain/schedule/scheduleCalculation';
import type { ValidationResult } from '../ValidationResult';

export const MIN_REST_PERIOD_MINUTES = 11 * 60;

/** A shift already resolved to concrete points in time. Rest periods can span week/day boundaries,
 * so this check works week-independently on Date objects instead of CalendarWeek data. */
export interface DatedShift {
  employeeId: EmployeeId;
  start: Date;
  end: Date;
}

export function shiftToDated(date: string, shift: Shift, employeeId: EmployeeId): DatedShift {
  const start = combineDateAndTime(date, shift.start);
  let end = combineDateAndTime(date, shift.end);
  if (shift.endsNextDay) {
    end = addDays(end, 1);
  }
  return { employeeId, start, end };
}

export function formatClockTime(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/** Checks the statutory minimum rest period under §5 ArbZG (11 hrs. between shift end and next
 * shift start) over a chronologically sorted list of shifts for the same employee. */
export function validateRestPeriodSequence(
  shifts: DatedShift[],
  minRestPeriodMinutes: number = MIN_REST_PERIOD_MINUTES,
): ValidationResult[] {
  const sorted = [...shifts].sort((a, b) => a.start.getTime() - b.start.getTime());
  const results: ValidationResult[] = [];

  for (let i = 1; i < sorted.length; i++) {
    const previous = sorted[i - 1];
    const current = sorted[i];
    const gap = differenceInMinutes(current.start, previous.end);

    if (gap < 0) {
      results.push({
        rule: 'Schichtueberschneidung',
        severity: 'error',
        message: `Schichten überschneiden sich am ${formatDateGerman(current.start)}.`,
        employeeId: current.employeeId,
        date: toISODate(current.start),
      });
    } else if (gap < minRestPeriodMinutes) {
      results.push({
        rule: 'ArbZG_5_Ruhezeit',
        severity: 'error',
        message: `Nur ${formatHoursGerman(gap)} Std. Ruhezeit zwischen Schichtende (${formatClockTime(previous.end)}) und nächstem Schichtbeginn (${formatClockTime(current.start)}), gesetzlich vorgeschrieben sind mind. 11 Std.`,
        employeeId: current.employeeId,
        date: toISODate(current.start),
      });
    }
  }

  return results;
}
