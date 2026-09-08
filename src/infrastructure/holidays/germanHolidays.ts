import { addDays } from 'date-fns';
import { toISODate } from '@domain/shared/DateFormat';
import type { FederalState } from '@domain/branch/Branch';

/** Easter Sunday via the Meeus/Jones/Butcher algorithm (Gregorian calendar). */
function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

/** Nationwide holidays (legally recognized in all 16 Bundesländer). */
function nationwideHolidays(year: number): Date[] {
  const easter = easterSunday(year);
  return [
    new Date(year, 0, 1), // New Year's Day
    addDays(easter, -2), // Good Friday
    addDays(easter, 1), // Easter Monday
    new Date(year, 4, 1), // Labor Day
    addDays(easter, 39), // Ascension Day
    addDays(easter, 50), // Whit Monday
    new Date(year, 9, 3), // German Unity Day
    new Date(year, 11, 25), // Christmas Day
    new Date(year, 11, 26), // 2nd Christmas Day (Boxing Day)
  ];
}

/** Additional state-specific holidays. Not exhaustive/legally verified; serves as
 * reference data for Sunday/holiday validation, not legal advice. */
function stateSpecificHolidays(year: number, federalState: FederalState): Date[] {
  const easter = easterSunday(year);
  const holidays: Date[] = [];

  const epiphany: FederalState[] = ['Baden-Württemberg', 'Bayern', 'Sachsen-Anhalt'];
  const corpusChristi: FederalState[] = ['Baden-Württemberg', 'Bayern', 'Hessen', 'Nordrhein-Westfalen', 'Rheinland-Pfalz', 'Saarland'];
  const assumptionOfMary: FederalState[] = ['Saarland'];
  const reformationDay: FederalState[] = [
    'Brandenburg', 'Bremen', 'Hamburg', 'Mecklenburg-Vorpommern', 'Niedersachsen',
    'Sachsen', 'Sachsen-Anhalt', 'Schleswig-Holstein', 'Thüringen',
  ];
  const allSaintsDay: FederalState[] = ['Baden-Württemberg', 'Bayern', 'Nordrhein-Westfalen', 'Rheinland-Pfalz', 'Saarland'];
  const worldChildrensDay: FederalState[] = ['Thüringen'];
  const womensDay: FederalState[] = ['Berlin', 'Mecklenburg-Vorpommern'];

  if (epiphany.includes(federalState)) holidays.push(new Date(year, 0, 6));
  if (womensDay.includes(federalState)) holidays.push(new Date(year, 2, 8));
  if (corpusChristi.includes(federalState)) holidays.push(addDays(easter, 60));
  if (assumptionOfMary.includes(federalState)) holidays.push(new Date(year, 7, 15));
  if (worldChildrensDay.includes(federalState)) holidays.push(new Date(year, 8, 20));
  if (reformationDay.includes(federalState)) holidays.push(new Date(year, 9, 31));
  if (allSaintsDay.includes(federalState)) holidays.push(new Date(year, 10, 1));

  return holidays;
}

export function holidaysForYearAndFederalState(year: number, federalState: FederalState): Set<string> {
  const all = [...nationwideHolidays(year), ...stateSpecificHolidays(year, federalState)];
  return new Set(all.map(toISODate));
}

/** Creates an `isHoliday` function for injection into the domain validation
 * (`sundayHolidayValidation.ts`), which itself has no federal-state knowledge. */
export function createHolidayCheck(federalState: FederalState): (isoDate: string) => boolean {
  const cache = new Map<number, Set<string>>();
  return (isoDate: string) => {
    const year = Number(isoDate.slice(0, 4));
    if (!cache.has(year)) {
      cache.set(year, holidaysForYearAndFederalState(year, federalState));
    }
    return cache.get(year)!.has(isoDate);
  };
}
