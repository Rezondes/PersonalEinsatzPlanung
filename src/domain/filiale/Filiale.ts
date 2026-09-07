import type { FilialId } from '@domain/shared/ids';
import { neueId } from '@domain/shared/ids';
import type { Adresse } from './Adresse';
import { leereAdresse } from './Adresse';

export const BUNDESLAENDER = [
  'Baden-Württemberg',
  'Bayern',
  'Berlin',
  'Brandenburg',
  'Bremen',
  'Hamburg',
  'Hessen',
  'Mecklenburg-Vorpommern',
  'Niedersachsen',
  'Nordrhein-Westfalen',
  'Rheinland-Pfalz',
  'Saarland',
  'Sachsen',
  'Sachsen-Anhalt',
  'Schleswig-Holstein',
  'Thüringen',
] as const;
export type Bundesland = (typeof BUNDESLAENDER)[number];

export interface Filiale {
  id: FilialId;
  name: string;
  filialnummer: string;
  adresse: Adresse;
  /** Data URL (e.g. "data:image/png;base64,..."), shown top-right in the print header. */
  logoBase64: string | null;
  bundesland: Bundesland;
  /** ISO date list of manually maintained open Sundays (varies by state law, hence configurable instead of hard-coded). */
  erlaubteVerkaufsoffeneSonntage: string[];
  aktiv: boolean;
  erstelltAm: string;
  aktualisiertAm: string;
}

export function neueFiliale(angaben: {
  name: string;
  filialnummer: string;
  bundesland: Bundesland;
  adresse?: Adresse;
  logoBase64?: string | null;
}): Filiale {
  const jetzt = new Date().toISOString();
  return {
    id: neueId<FilialId>(),
    name: angaben.name,
    filialnummer: angaben.filialnummer,
    adresse: angaben.adresse ?? leereAdresse(),
    logoBase64: angaben.logoBase64 ?? null,
    bundesland: angaben.bundesland,
    erlaubteVerkaufsoffeneSonntage: [],
    aktiv: true,
    erstelltAm: jetzt,
    aktualisiertAm: jetzt,
  };
}
