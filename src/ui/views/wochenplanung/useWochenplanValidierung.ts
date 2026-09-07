import { useEffect, useState } from 'react';
import { WOCHENTAGE, datumFuerWochentag } from '@domain/shared/Kalenderwoche';
import { toISODatum } from '@domain/shared/Zeitspanne';
import type { Wochenplan } from '@domain/wochenplan/Wochenplan';
import type { Filiale } from '@domain/filiale/Filiale';
import type { Abwesenheit } from '@domain/abwesenheit/Abwesenheit';
import { tageseintragNettoMinuten } from '@domain/wochenplan/wochenplanBerechnung';
import { validierePausen } from '@domain/validierung/arbeitszeitgesetz/pausenValidierung';
import { validiereSchichtdauer } from '@domain/validierung/arbeitszeitgesetz/schichtdauerValidierung';
import { validiereTagesarbeitszeit, validiereWochenarbeitszeit } from '@domain/validierung/arbeitszeitgesetz/hoechstarbeitszeitValidierung';
import { validiereSonntagsFeiertagsarbeit } from '@domain/validierung/arbeitszeitgesetz/sonntagsFeiertagsValidierung';
import type { ValidierungsErgebnis } from '@domain/validierung/ValidierungsErgebnis';
import { wochenplanOhneAbwesendeTage } from '@application/wochenplan/wochenplanAuswertung';
import { erstelleFeiertagsPruefung } from '@infrastructure/feiertage/feiertageDeutschland';
import { services } from '@infrastructure/services';

/** Runs all ArbZG (working hours law) validations for the current Wochenplan: synchronous per
 * day/week (breaks, maximum working time, Sunday/holiday work) as well as asynchronous per
 * employee across week boundaries (rest period, needs the previous/next week from the repository).
 *
 * Days with an absence are set to "Frei" before checking (wochenplanOhneAbwesendeTage), so that
 * ArbZG rules don't fire against leftover shift data on vacation/sick days. The rest-period check
 * loads neighboring weeks directly from the repository and applies the same absence-clearing there,
 * since `abwesenheiten` is not week-scoped (useAbwesenheiten loads all of a Filiale's records). */
export function useWochenplanValidierung(
  plan: Wochenplan | null,
  filiale: Filiale | null,
  abwesenheiten: Abwesenheit[],
): ValidierungsErgebnis[] {
  const [ergebnisse, setErgebnisse] = useState<ValidierungsErgebnis[]>([]);

  useEffect(() => {
    let abgebrochen = false;

    async function pruefen() {
      if (!plan || !filiale) {
        setErgebnisse([]);
        return;
      }

      const bereinigterPlan = wochenplanOhneAbwesendeTage(plan, abwesenheiten);
      const istFeiertag = erstelleFeiertagsPruefung(filiale.bundesland);
      const synchron: ValidierungsErgebnis[] = [];

      for (const einsatz of bereinigterPlan.mitarbeiterEinsaetze) {
        let wochenNettoMinuten = 0;

        for (const tag of WOCHENTAGE) {
          const eintrag = einsatz.tage[tag];
          if (eintrag.typ !== 'Schicht' || eintrag.schichten.length === 0) {
            continue;
          }
          const datum = toISODatum(datumFuerWochentag(plan.kalenderwoche, tag));

          for (const schicht of eintrag.schichten) {
            synchron.push(...validiereSchichtdauer(schicht, { mitarbeiterId: einsatz.mitarbeiterId, datum }));
          }
          // §4 ArbZG applies to the day's total working time, not each shift block separately
          // (see pausenValidierung.ts) - validated once per day across all of that day's shifts.
          synchron.push(
            ...validierePausen(eintrag.schichten, { mitarbeiterId: einsatz.mitarbeiterId, datum }),
          );

          // Reuses wochenplanBerechnung.ts (single source of truth for hour math) instead of
          // re-summing schichtNettoMinuten manually here.
          const tagNettoMinuten = tageseintragNettoMinuten(eintrag);

          synchron.push(
            ...validiereTagesarbeitszeit(tagNettoMinuten, { mitarbeiterId: einsatz.mitarbeiterId, datum }),
          );
          synchron.push(
            ...validiereSonntagsFeiertagsarbeit(datum, tag, filiale, istFeiertag, { mitarbeiterId: einsatz.mitarbeiterId }),
          );

          wochenNettoMinuten += tagNettoMinuten;
        }

        synchron.push(...validiereWochenarbeitszeit(wochenNettoMinuten, { mitarbeiterId: einsatz.mitarbeiterId }));
      }

      const ruhezeitErgebnisse = await Promise.all(
        plan.mitarbeiterEinsaetze.map((einsatz) =>
          services.ruhezeitPruefung.pruefeFuerMitarbeiter(
            einsatz.mitarbeiterId,
            plan.filialeId,
            plan.kalenderwoche,
            abwesenheiten,
          ),
        ),
      );

      if (!abgebrochen) {
        setErgebnisse([...synchron, ...ruhezeitErgebnisse.flat()]);
      }
    }

    pruefen();
    return () => {
      abgebrochen = true;
    };
  }, [plan, filiale, abwesenheiten]);

  return ergebnisse;
}
