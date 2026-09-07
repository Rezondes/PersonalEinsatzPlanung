import type { MitarbeiterId } from '@domain/shared/ids';
import type { Schicht } from '@domain/wochenplan/Schicht';
import { schichtNettoMinuten, minutenZuDezimalstunden } from '@domain/wochenplan/wochenplanBerechnung';
import type { ValidierungsErgebnis } from '../ValidierungsErgebnis';

export interface ArbZGKonfiguration {
  minPauseAb6hMinuten: number;
  minPauseAb9hMinuten: number;
  minPausenblockMinuten: number;
}

export const STANDARD_ARBZG_KONFIGURATION: ArbZGKonfiguration = {
  minPauseAb6hMinuten: 30,
  minPauseAb9hMinuten: 45,
  minPausenblockMinuten: 15,
};

export interface PausenValidierungsKontext {
  mitarbeiterId: MitarbeiterId;
  datum: string;
}

/** Checks the break rules under §4 ArbZG: >6h work -> min. 30 min. break, >9h -> min. 45 min.
 * Only break blocks at or above minPausenblockMinuten count toward the legal minimum.
 *
 * Takes ALL shifts of one day (not a single shift): §4 ArbZG applies to a person's total daily
 * working time, so a split shift of e.g. 4h+4h needs the same break as one continuous 8h shift -
 * checking each shift block in isolation would wrongly report no break required at all. */
export function validierePausen(
  schichten: Schicht[],
  kontext: PausenValidierungsKontext,
  konfig: ArbZGKonfiguration = STANDARD_ARBZG_KONFIGURATION,
): ValidierungsErgebnis[] {
  const ergebnisse: ValidierungsErgebnis[] = [];
  // §2(1) ArbZG: "Arbeitszeit" is time excluding rest breaks, so the thresholds apply to
  // net working time (after subtracting breaks), not the gross span including breaks.
  const nettoMinuten = schichten.reduce((summe, s) => summe + schichtNettoMinuten(s), 0);

  const erforderlicheMinuten =
    nettoMinuten > 9 * 60
      ? konfig.minPauseAb9hMinuten
      : nettoMinuten > 6 * 60
        ? konfig.minPauseAb6hMinuten
        : 0;

  const allePausen = schichten.flatMap((s) => s.pausen);
  const anrechenbareBloecke = allePausen.filter((p) => p.dauerMinuten >= konfig.minPausenblockMinuten);
  const nichtAnrechenbareBloecke = allePausen.filter((p) => p.dauerMinuten < konfig.minPausenblockMinuten);
  const anrechenbareMinuten = anrechenbareBloecke.reduce((summe, p) => summe + p.dauerMinuten, 0);

  if (nichtAnrechenbareBloecke.length > 0) {
    ergebnisse.push({
      regel: 'ArbZG_4_Pausenblock',
      schweregrad: 'warnung',
      meldung: `${nichtAnrechenbareBloecke.length} Pausenblock(-blöcke) unter ${konfig.minPausenblockMinuten} Min. zählen nicht als gesetzliche Pause.`,
      ...kontext,
    });
  }

  if (anrechenbareMinuten < erforderlicheMinuten) {
    ergebnisse.push({
      regel: 'ArbZG_4_Mindestpause',
      schweregrad: 'fehler',
      meldung: `Bei ${minutenZuDezimalstunden(nettoMinuten)} Std. Arbeitszeit sind mind. ${erforderlicheMinuten} Min. Pause vorgeschrieben (angerechnet: ${anrechenbareMinuten} Min.).`,
      ...kontext,
    });
  }

  return ergebnisse;
}
