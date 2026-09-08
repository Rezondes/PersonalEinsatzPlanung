import type { EmployeeId } from '@domain/shared/ids';
import type { Shift } from '@domain/schedule/Shift';
import { shiftGrossMinutes } from '@domain/schedule/scheduleCalculation';
import type { ValidationResult } from '../ValidationResult';

export interface ShiftDurationValidationContext {
  employeeId: EmployeeId;
  date: string;
}

/** Not an ArbZG paragraph, but a basic input-sanity check: a shift with end at or before start
 * and "ends next day" unset computes a zero/negative gross duration
 * (shiftGrossMinutes) that would otherwise silently pass every downstream hour calculation and
 * legal validation (negative numbers never exceed a ">" threshold). */
export function validateShiftDuration(
  shift: Shift,
  context: ShiftDurationValidationContext,
): ValidationResult[] {
  if (shiftGrossMinutes(shift) <= 0) {
    return [
      {
        rule: 'Schichtdauer_Ungueltig',
        severity: 'error',
        message: `Schicht ${shift.start}-${shift.end} endet vor oder gleichzeitig mit dem Beginn. Bei einer Nachtschicht "Ende liegt am Folgetag" aktivieren.`,
        ...context,
      },
    ];
  }
  return [];
}
