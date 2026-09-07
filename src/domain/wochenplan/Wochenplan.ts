import type { FilialId, WochenplanId, MitarbeiterId } from '@domain/shared/ids';
import { neueId } from '@domain/shared/ids';
import type { Kalenderwoche, Wochentag } from '@domain/shared/Kalenderwoche';
import type { MitarbeiterWocheneinsatz, Tageseintrag } from './MitarbeiterWocheneinsatz';
import { leererWocheneinsatz } from './MitarbeiterWocheneinsatz';

/**
 * One weekly plan per (filialeId, Kalenderwoche). References employees only via mitarbeiterId;
 * name/position are loaded live from the employee master record at display/export time (DRY,
 * no duplicated snapshot). Abwesenheiten are deliberately NOT stored here but overlaid onto the
 * plan in the application layer (avoids sync problems between two aggregates).
 */
export interface Wochenplan {
  id: WochenplanId;
  filialeId: FilialId;
  kalenderwoche: Kalenderwoche;
  geplanterWochenumsatz?: number;
  geplanteWochenstunden?: number;
  mitarbeiterEinsaetze: MitarbeiterWocheneinsatz[];
  erstelltAm: string;
  aktualisiertAm: string;
}

export function neuerWochenplan(
  filialeId: FilialId,
  kalenderwoche: Kalenderwoche,
  mitarbeiterIds: MitarbeiterId[],
): Wochenplan {
  const jetzt = new Date().toISOString();
  return {
    id: neueId<WochenplanId>(),
    filialeId,
    kalenderwoche,
    mitarbeiterEinsaetze: mitarbeiterIds.map(leererWocheneinsatz),
    erstelltAm: jetzt,
    aktualisiertAm: jetzt,
  };
}

export function einsatzFuerMitarbeiter(
  plan: Wochenplan,
  mitarbeiterId: MitarbeiterId,
): MitarbeiterWocheneinsatz | undefined {
  return plan.mitarbeiterEinsaetze.find((einsatz) => einsatz.mitarbeiterId === mitarbeiterId);
}

/** Pure, immutable update: returns a new Wochenplan with the changed day entry for
 * an employee. If the employee isn't in the plan yet (e.g. hired afterward),
 * their assignment is newly created. */
export function mitTageseintrag(
  plan: Wochenplan,
  mitarbeiterId: MitarbeiterId,
  tag: Wochentag,
  eintrag: Tageseintrag,
): Wochenplan {
  const bestehenderEinsatz = einsatzFuerMitarbeiter(plan, mitarbeiterId) ?? leererWocheneinsatz(mitarbeiterId);
  const neuerEinsatz: MitarbeiterWocheneinsatz = { ...bestehenderEinsatz, tage: { ...bestehenderEinsatz.tage, [tag]: eintrag } };

  const vorhanden = plan.mitarbeiterEinsaetze.some((e) => e.mitarbeiterId === mitarbeiterId);
  const mitarbeiterEinsaetze = vorhanden
    ? plan.mitarbeiterEinsaetze.map((e) => (e.mitarbeiterId === mitarbeiterId ? neuerEinsatz : e))
    : [...plan.mitarbeiterEinsaetze, neuerEinsatz];

  return { ...plan, mitarbeiterEinsaetze, aktualisiertAm: new Date().toISOString() };
}

/** Pure, immutable update: sets the Soll-Stunden adjustment (carried over from a previous week's
 * Ist/Soll difference) for one employee. Same "find or create the einsatz" shape as
 * mitTageseintrag. */
export function mitSollAnpassung(plan: Wochenplan, mitarbeiterId: MitarbeiterId, minuten: number): Wochenplan {
  const bestehenderEinsatz = einsatzFuerMitarbeiter(plan, mitarbeiterId) ?? leererWocheneinsatz(mitarbeiterId);
  const neuerEinsatz: MitarbeiterWocheneinsatz = { ...bestehenderEinsatz, sollAnpassungMinuten: minuten };

  const vorhanden = plan.mitarbeiterEinsaetze.some((e) => e.mitarbeiterId === mitarbeiterId);
  const mitarbeiterEinsaetze = vorhanden
    ? plan.mitarbeiterEinsaetze.map((e) => (e.mitarbeiterId === mitarbeiterId ? neuerEinsatz : e))
    : [...plan.mitarbeiterEinsaetze, neuerEinsatz];

  return { ...plan, mitarbeiterEinsaetze, aktualisiertAm: new Date().toISOString() };
}
