import { DomainError } from '@domain/shared/DomainError';
import type { PepExportDatei } from './jsonExportFormat';
import { AKTUELLE_FORMAT_VERSION } from './jsonExportFormat';

function istGueltigeDatenStruktur(daten: unknown): daten is PepExportDatei['daten'] {
  if (typeof daten !== 'object' || daten === null) {
    return false;
  }
  const d = daten as Record<string, unknown>;
  return (
    Array.isArray(d.filialen) &&
    Array.isArray(d.mitarbeiter) &&
    Array.isArray(d.wochenplaene) &&
    Array.isArray(d.abwesenheiten)
  );
}

/**
 * Brings an imported export file up to the current formatVersion. Currently only version 1 exists,
 * so there are no migration steps yet. Future versions will add sequential
 * migrateVxToVy(daten) functions here, before the data is written to Dexie.
 *
 * Only checks the top-level shape (formatVersion + the 4 data arrays exist and are arrays), not
 * every field of every record - deep per-record validation is out of scope (YAGNI, the file only
 * ever comes from this app's own export). Without even this shallow check, a malformed file would
 * previously reach `datei.daten.filialen.map(...)` in datenExportService and throw a raw, unhelpful
 * TypeError instead of a clear German error message - and since the atomic import transaction rolls
 * back on any thrown error, no data is lost either way, but the error message matters for the user.
 */
export function migriereZuAktuellerVersion(rohdaten: unknown): PepExportDatei {
  if (typeof rohdaten !== 'object' || rohdaten === null || !('formatVersion' in rohdaten)) {
    throw new DomainError('Die Datei enthält kein gültiges PEP-Exportformat.');
  }

  const datei = rohdaten as PepExportDatei;

  if (typeof datei.formatVersion !== 'number') {
    throw new DomainError('Die Datei enthält kein gültiges PEP-Exportformat.');
  }

  if (datei.formatVersion > AKTUELLE_FORMAT_VERSION) {
    throw new DomainError(
      `Diese Datei wurde mit einer neueren App-Version exportiert (Format ${datei.formatVersion}) und kann von dieser Version nicht importiert werden.`,
    );
  }

  if (!istGueltigeDatenStruktur(datei.daten)) {
    throw new DomainError('Die Datei enthält kein gültiges PEP-Exportformat (fehlende oder beschädigte Datenfelder).');
  }

  return datei;
}
