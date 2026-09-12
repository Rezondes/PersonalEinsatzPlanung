import { differenceInYears, differenceInMinutes, parseISO } from 'date-fns';
import type { EmployeeId } from '@domain/shared/ids';
import type { Weekday } from '@domain/shared/CalendarWeek';
import type { Shift } from '@domain/schedule/Shift';
import { clockTimeToMinutes } from '@domain/shared/ClockTime';
import { shiftNetMinutes, formatHoursGerman } from '@domain/schedule/scheduleCalculation';
import { toISODate } from '@domain/shared/DateFormat';
import type { ValidationResult } from '../ValidationResult';
import type { DatedShift } from './restPeriodValidation';
import { formatClockTime } from './restPeriodValidation';

/** Returns whether the person is a minor on the reference date, or null if the birth date is unknown.
 *
 * Uses parseISO, not `new Date(birthDate)`: `new Date("YYYY-MM-DD")` parses the date-only string as
 * UTC midnight, which in any timezone east of Greenwich lands a few hours into the SAME calendar day
 * (not the day before) - so it looks harmless, but it silently shifts the birth date's time-of-day
 * later, which can flip the answer for a referenceDate that falls exactly on the 18th birthday (see
 * the "regression" test in youthProtection.test.ts). parseISO reads it as local midnight instead,
 * matching every other ISO-date parse site in domain/ and application/ (see branchValidation.ts's
 * isSunday for the same reasoning). */
export function isMinor(birthDate: string | undefined, referenceDate: Date): boolean | null {
  if (!birthDate) {
    return null;
  }
  return differenceInYears(referenceDate, parseISO(birthDate)) < 18;
}

/** Jugendarbeitsschutzgesetz (JArbSchG) thresholds for minors (Jugendliche, 15 bis unter 18 Jahre).
 * Deliberately stricter across the board than the adult ArbZGConfiguration - see breakValidation.ts
 * and maxWorkingTimeValidation.ts for the adult numbers each of these overrides. */
export interface JArbSchGConfiguration {
  /** §8 Abs. 1 JArbSchG. No six-month-averaging extension exists for minors (unlike ArbZG §3(2) for
   * adults) - this is a hard daily cap. */
  maxDailyMinutes: number;
  /** §8 Abs. 1 JArbSchG. */
  maxWeeklyMinutes: number;
  /** §14 Abs. 1 JArbSchG. Retail/Einzelhandel is not one of the industries (Bäckereien, Gaststätten,
   * Landwirtschaft, ...) with extended night-work exceptions, so the plain 6-20 Uhr window applies. */
  earliestStartMinutes: number;
  /** §14 Abs. 1 JArbSchG. */
  latestEndMinutes: number;
  /** §11 Abs. 1 JArbSchG: required break for more than 4.5 up to 6 hours worked. */
  minBreakFrom4_5hMinutes: number;
  /** §11 Abs. 1 JArbSchG: required break for more than 6 hours worked (stricter than the adult 45
   * min. in breakValidation.ts's minBreakFrom9hMinutes). */
  minBreakFrom6hMinutes: number;
  /** Same "only a real break counts" rationale as ArbZGConfiguration.minBreakBlockMinutes. */
  minBreakBlockMinutes: number;
  /** §13 Abs. 1 JArbSchG: Schichtzeit, the gross span from start to end of the working day INCLUDING
   * breaks (unlike §11/§8, which look at net working time). Retail has no exception raising this
   * past 10h (unlike e.g. agriculture). */
  maxShiftSpanMinutes: number;
  /** §12 JArbSchG (Tägliche Freizeit) - stricter than the adult 11h in restPeriodValidation.ts. */
  minRestPeriodMinutes: number;
}

export const STANDARD_JARBSCHG_CONFIGURATION: JArbSchGConfiguration = {
  maxDailyMinutes: 8 * 60,
  maxWeeklyMinutes: 40 * 60,
  earliestStartMinutes: 6 * 60,
  latestEndMinutes: 20 * 60,
  minBreakFrom4_5hMinutes: 30,
  minBreakFrom6hMinutes: 60,
  minBreakBlockMinutes: 15,
  maxShiftSpanMinutes: 10 * 60,
  minRestPeriodMinutes: 12 * 60,
};

export interface YouthValidationContext {
  employeeId: EmployeeId;
  date: string;
}

/** §8 Abs. 1 JArbSchG: max. 8h per working day for a minor - always returns [] for a non-minor (or
 * unknown birth date), so this never applies the stricter youth rule to an adult by accident. */
export function validateYouthDailyWorkingTime(
  netMinutes: number,
  birthDate: string | undefined,
  context: YouthValidationContext,
  config: JArbSchGConfiguration = STANDARD_JARBSCHG_CONFIGURATION,
): ValidationResult[] {
  if (!isMinor(birthDate, parseISO(context.date)) || netMinutes <= config.maxDailyMinutes) {
    return [];
  }
  return [
    {
      rule: 'JArbSchG_8_Hoechstarbeitszeit',
      severity: 'error',
      message: `Tägliche Arbeitszeit von ${formatHoursGerman(netMinutes)} Std. überschreitet die für Jugendliche zulässige Höchstarbeitszeit von ${formatHoursGerman(config.maxDailyMinutes)} Std. (§8 JArbSchG).`,
      ...context,
    },
  ];
}

/** §8 Abs. 1 JArbSchG: max. 40h per week for a minor. Takes an explicit referenceDate (unlike the
 * adult validateWeeklyWorkingTime, whose context has no date at all) purely to evaluate isMinor -
 * the caller's natural choice is the Monday of the week being checked. */
export function validateYouthWeeklyWorkingTime(
  netMinutesWeek: number,
  birthDate: string | undefined,
  referenceDate: Date,
  context: { employeeId: EmployeeId },
  config: JArbSchGConfiguration = STANDARD_JARBSCHG_CONFIGURATION,
): ValidationResult[] {
  if (!isMinor(birthDate, referenceDate) || netMinutesWeek <= config.maxWeeklyMinutes) {
    return [];
  }
  return [
    {
      rule: 'JArbSchG_8_Wochenarbeitszeit',
      severity: 'error',
      message: `Wöchentliche Arbeitszeit von ${formatHoursGerman(netMinutesWeek)} Std. überschreitet die für Jugendliche zulässige Höchstarbeitszeit von ${formatHoursGerman(config.maxWeeklyMinutes)} Std. (§8 JArbSchG).`,
      ...context,
    },
  ];
}

/** §11 Abs. 1 JArbSchG break rules: >4.5h-6h worked -> min. 30 min., >6h -> min. 60 min. (stricter
 * than the adult 30/45 in breakValidation.ts). Takes ALL of one day's shifts, same reasoning as
 * validateBreaks. Only break blocks >= minBreakBlockMinutes count toward the total, same as the
 * adult check - but the "block too small" warning itself is NOT repeated here: validateBreaks
 * already raises it once for these same shifts regardless of age, a second near-identical warning
 * would just be noise for the Marktleiter. */
export function validateYouthBreaks(
  shifts: Shift[],
  birthDate: string | undefined,
  context: YouthValidationContext,
  config: JArbSchGConfiguration = STANDARD_JARBSCHG_CONFIGURATION,
): ValidationResult[] {
  if (shifts.length === 0 || !isMinor(birthDate, parseISO(context.date))) {
    return [];
  }

  const netMinutes = shifts.reduce((sum, s) => sum + shiftNetMinutes(s), 0);
  const requiredMinutes =
    netMinutes > 6 * 60
      ? config.minBreakFrom6hMinutes
      : netMinutes > 4.5 * 60
        ? config.minBreakFrom4_5hMinutes
        : 0;

  const creditableMinutes = shifts
    .flatMap((s) => s.breaks)
    .filter((b) => b.durationMinutes >= config.minBreakBlockMinutes)
    .reduce((sum, b) => sum + b.durationMinutes, 0);

  if (creditableMinutes < requiredMinutes) {
    return [
      {
        rule: 'JArbSchG_11_Mindestpause',
        severity: 'error',
        message: `Bei ${formatHoursGerman(netMinutes)} Std. Arbeitszeit sind für Jugendliche mind. ${requiredMinutes} Min. Pause vorgeschrieben (angerechnet: ${creditableMinutes} Min.) (§11 JArbSchG).`,
        ...context,
      },
    ];
  }

  return [];
}

/** §13 Abs. 1 JArbSchG: Schichtzeit (gross span incl. breaks, from the start of the day's first
 * shift to the end of its last) may not exceed 10h for a minor. Takes ALL of one day's shifts, same
 * reasoning as validateBreaks/validateYouthBreaks. For a single shift this is just shiftGrossMinutes;
 * a same-day split shift's gap between blocks counts too, since Schichtzeit is defined end-to-end. */
export function validateYouthShiftSpan(
  shifts: Shift[],
  birthDate: string | undefined,
  context: YouthValidationContext,
  config: JArbSchGConfiguration = STANDARD_JARBSCHG_CONFIGURATION,
): ValidationResult[] {
  if (shifts.length === 0 || !isMinor(birthDate, parseISO(context.date))) {
    return [];
  }

  const starts = shifts.map((s) => clockTimeToMinutes(s.start));
  const ends = shifts.map((s) => clockTimeToMinutes(s.end) + (s.endsNextDay ? 24 * 60 : 0));
  const spanMinutes = Math.max(...ends) - Math.min(...starts);

  if (spanMinutes > config.maxShiftSpanMinutes) {
    return [
      {
        rule: 'JArbSchG_13_Schichtzeit',
        severity: 'error',
        message: `Schichtzeit von ${formatHoursGerman(spanMinutes)} Std. überschreitet die für Jugendliche zulässige Höchstgrenze von ${formatHoursGerman(config.maxShiftSpanMinutes)} Std. (§13 JArbSchG).`,
        ...context,
      },
    ];
  }

  return [];
}

/** §14 Abs. 1 JArbSchG: minors may only work 06:00-20:00. Retail is not one of the industries with
 * an extended-hours exception (unlike e.g. Bäckereien/Gaststätten), so the plain window applies.
 * endsNextDay always violates the latest-end bound, since it means work past midnight. */
export function validateYouthNightWork(
  shift: Shift,
  birthDate: string | undefined,
  context: YouthValidationContext,
  config: JArbSchGConfiguration = STANDARD_JARBSCHG_CONFIGURATION,
): ValidationResult[] {
  if (!isMinor(birthDate, parseISO(context.date))) {
    return [];
  }

  const startsTooEarly = clockTimeToMinutes(shift.start) < config.earliestStartMinutes;
  const endsTooLate = shift.endsNextDay || clockTimeToMinutes(shift.end) > config.latestEndMinutes;

  if (startsTooEarly || endsTooLate) {
    return [
      {
        rule: 'JArbSchG_14_Nachtruhe',
        severity: 'error',
        message: `Arbeitszeit von ${shift.start} bis ${shift.end} Uhr liegt außerhalb der für Jugendliche zulässigen Zeit von 06:00 bis 20:00 Uhr (§14 JArbSchG).`,
        ...context,
      },
    ];
  }

  return [];
}

/** §17 JArbSchG (Sonntagsruhe): minors may not work Sundays in retail - unlike adults, this is an
 * unconditional error, not a config-dependent warning (a verkaufsoffener Sonntag under state
 * Ladenöffnungsrecht permits ADULT staff, but JArbSchG grants retail no Sunday exception for
 * minors). §16 JArbSchG exempts "offene Verkaufsstellen" from the Samstagsruhe, so Saturday work
 * stays unaffected - this function only ever fires for weekday === 'Sonntag'. */
export function validateYouthSundayWork(
  date: string,
  weekday: Weekday,
  birthDate: string | undefined,
  context: { employeeId: EmployeeId },
): ValidationResult[] {
  if (weekday !== 'Sonntag' || !isMinor(birthDate, parseISO(date))) {
    return [];
  }

  return [
    {
      rule: 'JArbSchG_17_Sonntagsarbeit',
      severity: 'error',
      message: 'Sonntagsarbeit ist für Jugendliche im Einzelhandel gesetzlich nicht zulässig (§17 JArbSchG); Samstagsarbeit bleibt erlaubt.',
      date,
      ...context,
    },
  ];
}

/** §12 JArbSchG (Tägliche Freizeit): at least 12h rest between two shifts for a minor (vs. 11h for
 * adults in restPeriodValidation.ts's validateRestPeriodSequence, which always runs alongside this
 * for every employee regardless of age). Same DatedShift/sort/diff shape as the adult check, since
 * rest periods equally cross day/week boundaries for a minor - but minor-status is evaluated PER
 * PAIR from the later shift's start date, since an employee can turn 18 between two shifts.
 * A negative gap (overlapping shifts) is already reported as `Schichtueberschneidung` by the adult
 * check and is deliberately not repeated here. */
export function validateYouthRestPeriodSequence(
  shifts: DatedShift[],
  birthDate: string | undefined,
  config: JArbSchGConfiguration = STANDARD_JARBSCHG_CONFIGURATION,
): ValidationResult[] {
  const sorted = [...shifts].sort((a, b) => a.start.getTime() - b.start.getTime());
  const results: ValidationResult[] = [];

  for (let i = 1; i < sorted.length; i++) {
    const previous = sorted[i - 1];
    const current = sorted[i];
    if (!isMinor(birthDate, current.start)) {
      continue;
    }

    const gap = differenceInMinutes(current.start, previous.end);
    if (gap >= 0 && gap < config.minRestPeriodMinutes) {
      results.push({
        rule: 'JArbSchG_12_Ruhezeit',
        severity: 'error',
        message: `Nur ${formatHoursGerman(gap)} Std. Ruhezeit zwischen Schichtende (${formatClockTime(previous.end)}) und nächstem Schichtbeginn (${formatClockTime(current.start)}), für Jugendliche gesetzlich vorgeschrieben sind mind. ${formatHoursGerman(config.minRestPeriodMinutes)} Std. (§12 JArbSchG).`,
        employeeId: current.employeeId,
        date: toISODate(current.start),
      });
    }
  }

  return results;
}
