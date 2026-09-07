import type { FilialId, MitarbeiterId } from '@domain/shared/ids';
import type { Kalenderwoche } from '@domain/shared/Kalenderwoche';
import { WOCHENTAGE, datumFuerWochentag, kalenderwocheDavor, kalenderwocheDanach } from '@domain/shared/Kalenderwoche';
import { toISODatum } from '@domain/shared/Zeitspanne';
import type { Wochenplan } from '@domain/wochenplan/Wochenplan';
import { einsatzFuerMitarbeiter } from '@domain/wochenplan/Wochenplan';
import type { Abwesenheit } from '@domain/abwesenheit/Abwesenheit';
import type { DatierteSchicht } from '@domain/validierung/arbeitszeitgesetz/ruhezeitValidierung';
import { schichtZuDatiert, validiereRuhezeitReihe } from '@domain/validierung/arbeitszeitgesetz/ruhezeitValidierung';
import type { ValidierungsErgebnis } from '@domain/validierung/ValidierungsErgebnis';
import type { WochenplanRepository } from '@application/ports/WochenplanRepository';
import { wochenplanOhneAbwesendeTage } from '@application/wochenplan/wochenplanAuswertung';

function extrahiereDatierteSchichten(plan: Wochenplan, mitarbeiterId: MitarbeiterId): DatierteSchicht[] {
  const einsatz = einsatzFuerMitarbeiter(plan, mitarbeiterId);
  if (!einsatz) {
    return [];
  }
  return WOCHENTAGE.flatMap((tag) => {
    const eintrag = einsatz.tage[tag];
    if (eintrag.typ !== 'Schicht') {
      return [];
    }
    const datum = toISODatum(datumFuerWochentag(plan.kalenderwoche, tag));
    return eintrag.schichten.map((schicht) => schichtZuDatiert(datum, schicht, mitarbeiterId));
  });
}

/** Checks the minimum rest period (§5 ArbZG) for an employee across week boundaries by
 * loading the previous/current/next week (a weekend night shift can extend
 * into the next week). `abwesenheiten` clears out leftover Schicht data on days now covered by an
 * Abwesenheit (same reasoning as wochenplanOhneAbwesendeTage's callers elsewhere) - without this, a
 * stale shift next to a since-added vacation/sick day would wrongly count toward the rest period. */
export function erstelleRuhezeitPruefungService(repo: WochenplanRepository) {
  return {
    pruefeFuerMitarbeiter: async (
      mitarbeiterId: MitarbeiterId,
      filialeId: FilialId,
      kw: Kalenderwoche,
      abwesenheiten: Abwesenheit[] = [],
    ): Promise<ValidierungsErgebnis[]> => {
      const wochen = [kalenderwocheDavor(kw), kw, kalenderwocheDanach(kw)];
      const plaene = await Promise.all(wochen.map((w) => repo.findByFilialeUndWoche(filialeId, w)));

      const datierteSchichten = plaene
        .filter((p): p is Wochenplan => p !== null)
        .map((plan) => wochenplanOhneAbwesendeTage(plan, abwesenheiten))
        .flatMap((plan) => extrahiereDatierteSchichten(plan, mitarbeiterId));

      return validiereRuhezeitReihe(datierteSchichten);
    },
  };
}

export type RuhezeitPruefungService = ReturnType<typeof erstelleRuhezeitPruefungService>;
