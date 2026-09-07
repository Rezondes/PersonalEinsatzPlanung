import type { MitarbeiterId } from '@domain/shared/ids';
import type { Schicht } from '@domain/wochenplan/Schicht';
import { schichtBruttoMinuten } from '@domain/wochenplan/wochenplanBerechnung';
import type { ValidierungsErgebnis } from '../ValidierungsErgebnis';

export interface SchichtdauerValidierungsKontext {
  mitarbeiterId: MitarbeiterId;
  datum: string;
}

/** Not an ArbZG paragraph, but a basic input-sanity check: a shift with Ende at or before Beginn
 * and "Ende liegt am Folgetag" unset computes a zero/negative gross duration
 * (schichtBruttoMinuten) that would otherwise silently pass every downstream hour calculation and
 * legal validation (negative numbers never exceed a ">" threshold). */
export function validiereSchichtdauer(
  schicht: Schicht,
  kontext: SchichtdauerValidierungsKontext,
): ValidierungsErgebnis[] {
  if (schichtBruttoMinuten(schicht) <= 0) {
    return [
      {
        regel: 'Schichtdauer_Ungueltig',
        schweregrad: 'fehler',
        meldung: `Schicht ${schicht.beginn}-${schicht.ende} endet vor oder gleichzeitig mit dem Beginn. Bei einer Nachtschicht "Ende liegt am Folgetag" aktivieren.`,
        ...kontext,
      },
    ];
  }
  return [];
}
