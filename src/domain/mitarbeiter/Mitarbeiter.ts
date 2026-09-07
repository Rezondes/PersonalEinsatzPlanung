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
