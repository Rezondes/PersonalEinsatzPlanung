import type { MitarbeiterId } from '@domain/shared/ids';
import type { Wochentag } from '@domain/shared/Kalenderwoche';
import type { ValidierungsErgebnis } from '../ValidierungsErgebnis';

export interface SonntagsFeiertagsKontext {
  mitarbeiterId: MitarbeiterId;
}

/** Checks Sunday/holiday work. Deliberately a configurable warning rather than a hard rule, since
 * store-opening law (open Sundays) is regulated differently by each German state.
 * `istFeiertag` is injected (from infrastructure/feiertage); the domain has no Bundesland knowledge. */
export function validiereSonntagsFeiertagsarbeit(
  datum: string,
  wochentag: Wochentag,
  filiale: { erlaubteVerkaufsoffeneSonntage: string[] },
  istFeiertag: (datum: string) => boolean,
  kontext: SonntagsFeiertagsKontext,
): ValidierungsErgebnis[] {
  const ergebnisse: ValidierungsErgebnis[] = [];

  if (wochentag === 'Sonntag' && !filiale.erlaubteVerkaufsoffeneSonntage.includes(datum)) {
    ergebnisse.push({
      regel: 'Sonntagsarbeit',
      schweregrad: 'warnung',
      meldung: 'Sonntagsarbeit außerhalb eines verkaufsoffenen Sonntags geplant. Bitte rechtliche Zulässigkeit nach Landesrecht prüfen.',
      datum,
      ...kontext,
    });
  }

  if (istFeiertag(datum)) {
    ergebnisse.push({
      regel: 'Feiertagsarbeit',
      schweregrad: 'warnung',
      meldung: 'Arbeit an einem gesetzlichen Feiertag geplant.',
      datum,
      ...kontext,
    });
  }

  return ergebnisse;
}
