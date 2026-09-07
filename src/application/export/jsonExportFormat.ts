import type { Filiale } from '@domain/filiale/Filiale';
import type { Mitarbeiter } from '@domain/mitarbeiter/Mitarbeiter';
import type { Wochenplan } from '@domain/wochenplan/Wochenplan';
import type { Abwesenheit } from '@domain/abwesenheit/Abwesenheit';

export const AKTUELLE_FORMAT_VERSION = 1 as const;

export interface PepExportDatei {
  formatVersion: typeof AKTUELLE_FORMAT_VERSION;
  exportiertAm: string;
  daten: {
    filialen: Filiale[];
    mitarbeiter: Mitarbeiter[];
    wochenplaene: Wochenplan[];
    abwesenheiten: Abwesenheit[];
  };
}
