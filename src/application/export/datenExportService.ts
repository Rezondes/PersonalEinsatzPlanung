import type { FilialeRepository } from '@application/ports/FilialeRepository';
import type { MitarbeiterRepository } from '@application/ports/MitarbeiterRepository';
import type { WochenplanRepository } from '@application/ports/WochenplanRepository';
import type { AbwesenheitRepository } from '@application/ports/AbwesenheitRepository';
import type { PepExportDatei } from './jsonExportFormat';
import { AKTUELLE_FORMAT_VERSION } from './jsonExportFormat';
import { migriereZuAktuellerVersion } from './jsonMigrations';

export interface DatenRepositories {
  filiale: FilialeRepository;
  mitarbeiter: MitarbeiterRepository;
  wochenplan: WochenplanRepository;
  abwesenheit: AbwesenheitRepository;
  /** Runs a block of repository calls atomically (all-or-nothing). Needed so a full-dataset
   * replace (import) can never fail halfway through and leave some stores cleared, others not. */
  transaktion: <T>(fn: () => Promise<T>) => Promise<T>;
}

/**
 * Main persistence mechanism for backup & device migration, since the app has no server: exports the
 * complete local dataset as a JSON file and re-imports such a file.
 */
export function erstelleDatenExportService(repos: DatenRepositories) {
  return {
    exportieren: async (): Promise<PepExportDatei> => {
      const [filialen, mitarbeiter, wochenplaene, abwesenheiten] = await Promise.all([
        repos.filiale.findAll(),
        repos.mitarbeiter.findAll(),
        repos.wochenplan.findAll(),
        repos.abwesenheit.findAll(),
      ]);

      return {
        formatVersion: AKTUELLE_FORMAT_VERSION,
        exportiertAm: new Date().toISOString(),
        daten: { filialen, mitarbeiter, wochenplaene, abwesenheiten },
      };
    },

    /** Replaces the complete local dataset with the content of the import file (main scenario:
     * device/browser migration). Existing data is deleted first. */
    importierenUndErsetzen: async (rohdaten: unknown): Promise<void> => {
      const datei = migriereZuAktuellerVersion(rohdaten);

      await repos.transaktion(async () => {
        await Promise.all([
          repos.filiale.deleteAll(),
          repos.mitarbeiter.deleteAll(),
          repos.wochenplan.deleteAll(),
          repos.abwesenheit.deleteAll(),
        ]);

        await Promise.all([
          ...datei.daten.filialen.map((f) => repos.filiale.save(f)),
          ...datei.daten.mitarbeiter.map((m) => repos.mitarbeiter.save(m)),
          ...datei.daten.wochenplaene.map((w) => repos.wochenplan.save(w)),
          ...datei.daten.abwesenheiten.map((a) => repos.abwesenheit.save(a)),
        ]);
      });
    },

    alleDatenLoeschen: async (): Promise<void> => {
      await Promise.all([
        repos.filiale.deleteAll(),
        repos.mitarbeiter.deleteAll(),
        repos.wochenplan.deleteAll(),
        repos.abwesenheit.deleteAll(),
      ]);
    },
  };
}

export type DatenExportService = ReturnType<typeof erstelleDatenExportService>;
