import type { EmployeeId } from '@domain/shared/ids';
import type { Shift } from '@domain/schedule/Shift';
import { shiftNetMinutes, formatHoursGerman } from '@domain/schedule/scheduleCalculation';
import type { ValidationResult } from '../ValidationResult';

export interface ArbZGConfiguration {
  minBreakFrom6hMinutes: number;
  minBreakFrom9hMinutes: number;
  minBreakBlockMinutes: number;
}

export const STANDARD_ARBZG_CONFIGURATION: ArbZGConfiguration = {
  minBreakFrom6hMinutes: 30,
  minBreakFrom9hMinutes: 45,
  minBreakBlockMinutes: 15,
};

export interface BreakValidationContext {
  employeeId: EmployeeId;
  date: string;
}

/** Checks the break rules under §4 ArbZG: >6h work -> min. 30 min. break, >9h -> min. 45 min.
 * Only break blocks at or above minBreakBlockMinutes count toward the legal minimum.
 *
 * Takes ALL shifts of one day (not a single shift): §4 ArbZG applies to a person's total daily
 * working time, so a split shift of e.g. 4h+4h needs the same break as one continuous 8h shift -
 * checking each shift block in isolation would wrongly report no break required at all. */
export function validateBreaks(
  shifts: Shift[],
  context: BreakValidationContext,
  config: ArbZGConfiguration = STANDARD_ARBZG_CONFIGURATION,
): ValidationResult[] {
  const results: ValidationResult[] = [];
  // §2(1) ArbZG: "Arbeitszeit" is time excluding rest breaks, so the thresholds apply to
  // net working time (after subtracting breaks), not the gross span including breaks.
  const netMinutes = shifts.reduce((sum, s) => sum + shiftNetMinutes(s), 0);

  const requiredMinutes =
    netMinutes > 9 * 60
      ? config.minBreakFrom9hMinutes
      : netMinutes > 6 * 60
        ? config.minBreakFrom6hMinutes
        : 0;

  const allBreaks = shifts.flatMap((s) => s.breaks);
  const creditableBlocks = allBreaks.filter((b) => b.durationMinutes >= config.minBreakBlockMinutes);
  const nonCreditableBlocks = allBreaks.filter((b) => b.durationMinutes < config.minBreakBlockMinutes);
  const creditableMinutes = creditableBlocks.reduce((sum, b) => sum + b.durationMinutes, 0);

  if (nonCreditableBlocks.length > 0) {
    results.push({
      rule: 'ArbZG_4_Pausenblock',
      severity: 'warning',
      message: `${nonCreditableBlocks.length} Pausenblock(-blöcke) unter ${config.minBreakBlockMinutes} Min. zählen nicht als gesetzliche Pause.`,
      ...context,
    });
  }

  if (creditableMinutes < requiredMinutes) {
    results.push({
      rule: 'ArbZG_4_Mindestpause',
      severity: 'error',
      message: `Bei ${formatHoursGerman(netMinutes)} Std. Arbeitszeit sind mind. ${requiredMinutes} Min. Pause vorgeschrieben (angerechnet: ${creditableMinutes} Min.).`,
      ...context,
    });
  }

  return results;
}
