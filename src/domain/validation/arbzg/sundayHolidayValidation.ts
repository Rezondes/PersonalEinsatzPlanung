import type { EmployeeId } from '@domain/shared/ids';
import type { Weekday } from '@domain/shared/CalendarWeek';
import type { ValidationResult } from '../ValidationResult';

export interface SundayHolidayContext {
  employeeId: EmployeeId;
}

/** Checks Sunday/holiday work. Deliberately a configurable warning rather than a hard rule, since
 * store-opening law (open Sundays) is regulated differently by each German state.
 * `isHoliday` is injected (from infrastructure/holidays); the domain has no federal-state knowledge. */
export function validateSundayHolidayWork(
  date: string,
  weekday: Weekday,
  branch: { allowedOpenSundays: string[] },
  isHoliday: (date: string) => boolean,
  context: SundayHolidayContext,
): ValidationResult[] {
  const results: ValidationResult[] = [];

  if (weekday === 'Sonntag' && !branch.allowedOpenSundays.includes(date)) {
    results.push({
      rule: 'Sonntagsarbeit',
      severity: 'warning',
      message: 'Sonntagsarbeit außerhalb eines verkaufsoffenen Sonntags geplant. Bitte rechtliche Zulässigkeit nach Landesrecht prüfen.',
      date,
      ...context,
    });
  }

  if (isHoliday(date)) {
    results.push({
      rule: 'Feiertagsarbeit',
      severity: 'warning',
      message: 'Arbeit an einem gesetzlichen Feiertag geplant.',
      date,
      ...context,
    });
  }

  return results;
}
