import type { FilialId, MitarbeiterId } from '@domain/shared/ids';
import { neueId } from '@domain/shared/ids';
import type { Beschaeftigungsart } from './Beschaeftigungsart';

export interface Mitarbeiter {
  id: MitarbeiterId;
  filialeId: FilialId;
  nachname: string;
  vorname: string;
  /** Free text, e.g. "Verkäufer/-in Lebensmittel" (suggestion list in taetigkeitsVorschlaege.ts). */
  taetigkeit: string;
  beschaeftigungsart: Beschaeftigungsart;
  urlaubsanspruchProJahr: number;
  /** Optional, only relevant for the youth-labor-protection check (data minimization: only collect when needed). */
  geburtsdatum?: string;
  aktiv: boolean;
  erstelltAm: string;
  aktualisiertAm: string;
}

export function neuerMitarbeiter(angaben: {
  filialeId: FilialId;
  nachname: string;
  vorname: string;
  taetigkeit: string;
  beschaeftigungsart: Beschaeftigungsart;
  urlaubsanspruchProJahr: number;
  geburtsdatum?: string;
}): Mitarbeiter {
  const jetzt = new Date().toISOString();
  return {
    id: neueId<MitarbeiterId>(),
    filialeId: angaben.filialeId,
    nachname: angaben.nachname,
    vorname: angaben.vorname,
    taetigkeit: angaben.taetigkeit,
    beschaeftigungsart: angaben.beschaeftigungsart,
    urlaubsanspruchProJahr: angaben.urlaubsanspruchProJahr,
    geburtsdatum: angaben.geburtsdatum,
    aktiv: true,
    erstelltAm: jetzt,
    aktualisiertAm: jetzt,
  };
}

export function vollerName(mitarbeiter: Pick<Mitarbeiter, 'nachname' | 'vorname'>): string {
  return `${mitarbeiter.nachname}, ${mitarbeiter.vorname}`;
}

/** Sorts by Nachname A-Z (Vorname as tiebreaker), German collation (so e.g. umlauts sort correctly).
 * Single source of truth for the "Mitarbeiter always sorted by Nachname" rule - used for Stammdaten,
 * Monatsübersicht, Abwesenheiten, the Wochenplan table, and the print export, so the order stays
 * consistent everywhere the app lists employees. */
export function vergleicheNachname(
  a: Pick<Mitarbeiter, 'nachname' | 'vorname'>,
  b: Pick<Mitarbeiter, 'nachname' | 'vorname'>,
): number {
  return a.nachname.localeCompare(b.nachname, 'de') || a.vorname.localeCompare(b.vorname, 'de');
}
