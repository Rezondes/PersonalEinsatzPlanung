import { addDays, differenceInMinutes } from 'date-fns';
import type { MitarbeiterId } from '@domain/shared/ids';
import type { Schicht } from '@domain/wochenplan/Schicht';
import { kombiniereDatumUndUhrzeit, toISODatum } from '@domain/shared/Zeitspanne';
import { minutenZuDezimalstunden } from '@domain/wochenplan/wochenplanBerechnung';
import type { ValidierungsErgebnis } from '../ValidierungsErgebnis';

export const MINDEST_RUHEZEIT_MINUTEN = 11 * 60;

/** A shift already resolved to concrete points in time. Rest periods can span week/day boundaries,
 * so this check works week-independently on Date objects instead of Kalenderwoche data. */
export interface DatierteSchicht {
  mitarbeiterId: MitarbeiterId;
  start: Date;
  ende: Date;
}

export function schichtZuDatiert(datum: string, schicht: Schicht, mitarbeiterId: MitarbeiterId): DatierteSchicht {
  const start = kombiniereDatumUndUhrzeit(datum, schicht.beginn);
  let ende = kombiniereDatumUndUhrzeit(datum, schicht.ende);
  if (schicht.endeFolgetag) {
    ende = addDays(ende, 1);
  }
  return { mitarbeiterId, start, ende };
}

function formatUhrzeit(datum: Date): string {
  return `${String(datum.getHours()).padStart(2, '0')}:${String(datum.getMinutes()).padStart(2, '0')}`;
}

/** Checks the statutory minimum rest period under §5 ArbZG (11 hrs. between shift end and next
 * shift start) over a chronologically sorted list of shifts for the same employee. */
export function validiereRuhezeitReihe(
  schichten: DatierteSchicht[],
  minRuhezeitMinuten: number = MINDEST_RUHEZEIT_MINUTEN,
): ValidierungsErgebnis[] {
  const sortiert = [...schichten].sort((a, b) => a.start.getTime() - b.start.getTime());
  const ergebnisse: ValidierungsErgebnis[] = [];

  for (let i = 1; i < sortiert.length; i++) {
    const vorherige = sortiert[i - 1];
    const aktuelle = sortiert[i];
    const luecke = differenceInMinutes(aktuelle.start, vorherige.ende);

    if (luecke < 0) {
      ergebnisse.push({
        regel: 'Schichtueberschneidung',
        schweregrad: 'fehler',
        meldung: `Schichten überschneiden sich am ${toISODatum(aktuelle.start)}.`,
        mitarbeiterId: aktuelle.mitarbeiterId,
        datum: toISODatum(aktuelle.start),
      });
    } else if (luecke < minRuhezeitMinuten) {
      ergebnisse.push({
        regel: 'ArbZG_5_Ruhezeit',
        schweregrad: 'fehler',
        meldung: `Nur ${minutenZuDezimalstunden(luecke)} Std. Ruhezeit zwischen Schichtende (${formatUhrzeit(vorherige.ende)}) und nächstem Schichtbeginn (${formatUhrzeit(aktuelle.start)}), gesetzlich vorgeschrieben sind mind. 11 Std.`,
        mitarbeiterId: aktuelle.mitarbeiterId,
        datum: toISODatum(aktuelle.start),
      });
    }
  }

  return ergebnisse;
}
