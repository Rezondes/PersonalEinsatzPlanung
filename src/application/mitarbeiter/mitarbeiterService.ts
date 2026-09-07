import type { FilialId, MitarbeiterId } from '@domain/shared/ids';
import type { Mitarbeiter } from '@domain/mitarbeiter/Mitarbeiter';
import { neuerMitarbeiter, vergleicheNachname } from '@domain/mitarbeiter/Mitarbeiter';
import type { Beschaeftigungsart } from '@domain/mitarbeiter/Beschaeftigungsart';
import type { MitarbeiterRepository } from '@application/ports/MitarbeiterRepository';

export function erstelleMitarbeiterService(repo: MitarbeiterRepository) {
  return {
    // Sorted by Nachname A-Z here (not left to callers) so every view listing employees for a
    // Filiale is consistent by construction.
    fuerFiliale: async (filialeId: FilialId) => (await repo.findByFiliale(filialeId)).sort(vergleicheNachname),

    finden: (id: MitarbeiterId) => repo.findById(id),

    anlegen: async (angaben: {
      filialeId: FilialId;
      nachname: string;
      vorname: string;
      taetigkeit: string;
      beschaeftigungsart: Beschaeftigungsart;
      urlaubsanspruchProJahr: number;
      geburtsdatum?: string;
    }) => {
      const mitarbeiter = neuerMitarbeiter(angaben);
      await repo.save(mitarbeiter);
      return mitarbeiter;
    },

    aktualisieren: async (mitarbeiter: Mitarbeiter) => {
      const aktualisiert: Mitarbeiter = { ...mitarbeiter, aktualisiertAm: new Date().toISOString() };
      await repo.save(aktualisiert);
      return aktualisiert;
    },

    /** Soft delete: weekly plans/absences referencing this employee must stay intact (already
     * worked hours, past absences), so the UI never hard-deletes an employee with any data attached. */
    aktivStatusAendern: async (mitarbeiter: Mitarbeiter, aktiv: boolean) => {
      const aktualisiert: Mitarbeiter = { ...mitarbeiter, aktiv, aktualisiertAm: new Date().toISOString() };
      await repo.save(aktualisiert);
      return aktualisiert;
    },

    loeschen: (id: MitarbeiterId) => repo.delete(id),
  };
}

export type MitarbeiterService = ReturnType<typeof erstelleMitarbeiterService>;
