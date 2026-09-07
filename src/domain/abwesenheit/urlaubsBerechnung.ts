import { eachDayOfInterval, getDay, parseISO } from 'date-fns';
import type { Mitarbeiter } from '@domain/mitarbeiter/Mitarbeiter';
import { toISODatum } from '@domain/shared/Zeitspanne';
import type { Abwesenheit } from './Abwesenheit';

/** Counts work days (Mon-Sat, 6-day week per BUrlG practice) in the period, excluding Sundays and,
 * if `istFeiertag` is given, public holidays - a public holiday isn't a work day the employee would
 * otherwise have worked, so taking vacation on it (or a range including it) should not consume
 * vacation entitlement for that day (standard BUrlG interpretation). `istFeiertag` is injected
 * (Bundesland-specific, from infrastructure) since domain/ has no Bundesland knowledge of its own. */
export function zaehleWerktage(
  von: string,
  bis: string,
  halbtags?: { amBeginn: boolean; amEnde: boolean },
  istFeiertag?: (isoDatum: string) => boolean,
): number {
  const werktage = eachDayOfInterval({ start: parseISO(von), end: parseISO(bis) }).filter(
    (tag) => getDay(tag) !== 0 && !istFeiertag?.(toISODatum(tag)),
  );
  if (werktage.length === 0) {
    return 0;
  }

  if (von === bis) {
    // amBeginn/amEnde both true on a single-day range is a redundant (not additive) description of
    // the same one half-day - without this guard, subtracting both would wrongly zero out the day.
    const istHalbtags = !!halbtags?.amBeginn || !!halbtags?.amEnde;
    return istHalbtags ? 0.5 : werktage.length;
  }

  let anzahl = werktage.length;
  if (halbtags?.amBeginn) {
    anzahl -= 0.5;
  }
  if (halbtags?.amEnde) {
    anzahl -= 0.5;
  }
  return Math.max(anzahl, 0);
}

/** Counts vacation days that fall within `jahr`, clipping ranges that cross a year boundary (e.g.
 * Dec 29 - Jan 2) to just the portion inside that year - a plain `von`-year filter would either
 * drop such a range from both years or double-count it into the wrong one. A halbtags flag only
 * applies at whichever end is the absence's real start/end, not at an artificial clip point. */
export function zaehleUrlaubstageInZeitraum(
  abwesenheiten: Abwesenheit[],
  jahr: number,
  istFeiertag?: (isoDatum: string) => boolean,
): number {
  const jahresstart = `${jahr}-01-01`;
  const jahresende = `${jahr}-12-31`;

  return abwesenheiten
    .filter((a): a is Extract<Abwesenheit, { art: 'Urlaub' }> => a.art === 'Urlaub')
    .reduce((summe, a) => {
      const von = a.von < jahresstart ? jahresstart : a.von;
      const bis = a.bis > jahresende ? jahresende : a.bis;
      if (von > bis) {
        return summe;
      }
      const halbtags = {
        amBeginn: von === a.von && !!a.halbtags?.amBeginn,
        amEnde: bis === a.bis && !!a.halbtags?.amEnde,
      };
      return summe + zaehleWerktage(von, bis, halbtags, istFeiertag);
    }, 0);
}

export function berechneResturlaub(mitarbeiter: Pick<Mitarbeiter, 'urlaubsanspruchProJahr'>, genommeneTage: number): number {
  return mitarbeiter.urlaubsanspruchProJahr - genommeneTage;
}
