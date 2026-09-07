import { getISOWeek, getISOWeekYear, startOfISOWeek, addWeeks, subWeeks, addDays } from 'date-fns';

/** ISO calendar week. `jahr` is the ISO week-year, which can differ from the calendar year
 * (e.g. depending on the year, Dec 30 may already belong to week 1 of the following year). */
export interface Kalenderwoche {
  jahr: number;
  woche: number;
}

export const WOCHENTAGE = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'] as const;
export type Wochentag = (typeof WOCHENTAGE)[number];

export function kalenderwocheVonDatum(datum: Date): Kalenderwoche {
  return { jahr: getISOWeekYear(datum), woche: getISOWeek(datum) };
}

/** Monday of the given calendar week, computed via Jan 4 (which by ISO-8601 definition
 * always falls in week 1 of that week-year) instead of date-fns' setISOWeek (not available in all versions). */
export function montagDerWoche(kw: Kalenderwoche): Date {
  const vierterJanuar = new Date(kw.jahr, 0, 4);
  const montagKw1 = startOfISOWeek(vierterJanuar);
  return addWeeks(montagKw1, kw.woche - 1);
}

export function datumFuerWochentag(kw: Kalenderwoche, tag: Wochentag): Date {
  const index = WOCHENTAGE.indexOf(tag);
  return addDays(montagDerWoche(kw), index);
}

export function kalenderwocheDavor(kw: Kalenderwoche): Kalenderwoche {
  return kalenderwocheVonDatum(subWeeks(montagDerWoche(kw), 1));
}

export function kalenderwocheDanach(kw: Kalenderwoche): Kalenderwoche {
  return kalenderwocheVonDatum(addWeeks(montagDerWoche(kw), 1));
}

export function kalenderwochenGleich(a: Kalenderwoche, b: Kalenderwoche): boolean {
  return a.jahr === b.jahr && a.woche === b.woche;
}

/** All calendar weeks whose Monday falls in the given calendar month (monat: 1-12). */
export function kalenderwochenImMonat(jahr: number, monat: number): Kalenderwoche[] {
  const letzterTagDesMonats = new Date(jahr, monat, 0);
  const wochen: Kalenderwoche[] = [];

  let montag = startOfISOWeek(new Date(jahr, monat - 1, 1));
  while (montag <= letzterTagDesMonats) {
    if (montag.getMonth() === monat - 1) {
      wochen.push(kalenderwocheVonDatum(montag));
    }
    montag = addWeeks(montag, 1);
  }
  return wochen;
}
