import Dexie, { type Table } from 'dexie';
import type { Filiale } from '@domain/filiale/Filiale';
import type { Mitarbeiter } from '@domain/mitarbeiter/Mitarbeiter';
import type { Wochenplan } from '@domain/wochenplan/Wochenplan';
import type { Abwesenheit } from '@domain/abwesenheit/Abwesenheit';

export class PepDatabase extends Dexie {
  filialen!: Table<Filiale, string>;
  mitarbeiter!: Table<Mitarbeiter, string>;
  wochenplaene!: Table<Wochenplan, string>;
  abwesenheiten!: Table<Abwesenheit, string>;

  constructor() {
    super('pep-datenbank');
    this.version(1).stores({
      filialen: 'id, filialnummer, aktiv',
      mitarbeiter: 'id, filialeId, aktiv, [filialeId+aktiv]',
      wochenplaene: 'id, filialeId, [filialeId+kalenderwoche.jahr+kalenderwoche.woche]',
      abwesenheiten: 'id, mitarbeiterId, art, von, [mitarbeiterId+von]',
    });
    // Further structural changes to the IndexedDB schema are added as their own version, e.g.:
    // this.version(2).stores({ ... }).upgrade(tx => { ... });
  }
}

export const db = new PepDatabase();

/** Runs `fn` inside a single Dexie transaction spanning all 4 stores, so a multi-store write (e.g.
 * JSON import replace) either fully applies or fully rolls back - a failure partway through can
 * never leave the database with some stores cleared and others not yet repopulated. */
export function transaktion<T>(fn: () => Promise<T>): Promise<T> {
  return db.transaction('rw', db.filialen, db.mitarbeiter, db.wochenplaene, db.abwesenheiten, fn);
}
