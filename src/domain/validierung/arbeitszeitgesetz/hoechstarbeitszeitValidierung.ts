import type { MitarbeiterId } from '@domain/shared/ids';
import { minutenZuDezimalstunden } from '@domain/wochenplan/wochenplanBerechnung';
import type { ValidierungsErgebnis } from '../ValidierungsErgebnis';

export interface HoechstarbeitszeitKontext {
  mitarbeiterId: MitarbeiterId;
  datum: string;
}

/** §3 ArbZG: max. 8h per working day, extendable to 10h if averaged out over 6 calendar months.
 * A full averaging account is deliberately not maintained here (too complex for the scope); the app
 * warns per day, and the averaging obligation stays an organizational task for the Marktleiter. */
export function validiereTagesarbeitszeit(
  nettoMinuten: number,
  kontext: HoechstarbeitszeitKontext,
): ValidierungsErgebnis[] {
  if (nettoMinuten > 10 * 60) {
    return [
      {
        regel: 'ArbZG_3_Hoechstarbeitszeit',
        schweregrad: 'fehler',
        meldung: `Tägliche Arbeitszeit von ${minutenZuDezimalstunden(nettoMinuten)} Std. überschreitet die gesetzlich zulässige Höchstgrenze von 10 Std.`,
        ...kontext,
      },
    ];
  }
  if (nettoMinuten > 8 * 60) {
    return [
      {
        regel: 'ArbZG_3_Hoechstarbeitszeit',
        schweregrad: 'warnung',
        meldung: `Tägliche Arbeitszeit von ${minutenZuDezimalstunden(nettoMinuten)} Std. über 8 Std., muss innerhalb von 6 Kalendermonaten im Schnitt ausgeglichen werden (§3 ArbZG).`,
        ...kontext,
      },
    ];
  }
  return [];
}

/** Additional, non-binding warning for very high weekly working time (>48h). */
export function validiereWochenarbeitszeit(
  nettoMinutenWoche: number,
  kontext: { mitarbeiterId: MitarbeiterId },
): ValidierungsErgebnis[] {
  if (nettoMinutenWoche > 48 * 60) {
    return [
      {
        regel: 'ArbZG_Wochenarbeitszeit',
        schweregrad: 'warnung',
        meldung: `Wochenarbeitszeit von ${minutenZuDezimalstunden(nettoMinutenWoche)} Std. über 48 Std.`,
        ...kontext,
      },
    ];
  }
  return [];
}
