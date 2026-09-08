import type { EmployeeId } from '@domain/shared/ids';
import { minutesToDecimalHours } from '@domain/schedule/scheduleCalculation';
import type { ValidationResult } from '../ValidationResult';

export interface MaxWorkingTimeContext {
  employeeId: EmployeeId;
  date: string;
}

/** §3 ArbZG: max. 8h per working day, extendable to 10h if averaged out over 6 calendar months.
 * A full averaging account is deliberately not maintained here (too complex for the scope); the app
 * warns per day, and the averaging obligation stays an organizational task for the Marktleiter. */
export function validateDailyWorkingTime(
  netMinutes: number,
  context: MaxWorkingTimeContext,
): ValidationResult[] {
  if (netMinutes > 10 * 60) {
    return [
      {
        rule: 'ArbZG_3_Hoechstarbeitszeit',
        severity: 'error',
        message: `Tägliche Arbeitszeit von ${minutesToDecimalHours(netMinutes)} Std. überschreitet die gesetzlich zulässige Höchstgrenze von 10 Std.`,
        ...context,
      },
    ];
  }
  if (netMinutes > 8 * 60) {
    return [
      {
        rule: 'ArbZG_3_Hoechstarbeitszeit',
        severity: 'warning',
        message: `Tägliche Arbeitszeit von ${minutesToDecimalHours(netMinutes)} Std. über 8 Std., muss innerhalb von 6 Kalendermonaten im Schnitt ausgeglichen werden (§3 ArbZG).`,
        ...context,
      },
    ];
  }
  return [];
}

/** Additional, non-binding warning for very high weekly working time (>48h). */
export function validateWeeklyWorkingTime(
  netMinutesWeek: number,
  context: { employeeId: EmployeeId },
): ValidationResult[] {
  if (netMinutesWeek > 48 * 60) {
    return [
      {
        rule: 'ArbZG_Wochenarbeitszeit',
        severity: 'warning',
        message: `Wochenarbeitszeit von ${minutesToDecimalHours(netMinutesWeek)} Std. über 48 Std.`,
        ...context,
      },
    ];
  }
  return [];
}
