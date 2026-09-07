import type { FilialId } from '@domain/shared/ids';
import type { Filiale, Bundesland } from '@domain/filiale/Filiale';
import { neueFiliale } from '@domain/filiale/Filiale';
import type { Adresse } from '@domain/filiale/Adresse';
import type { FilialeRepository } from '@application/ports/FilialeRepository';

export function erstelleFilialeService(repo: FilialeRepository) {
  return {
    alle: () => repo.findAll(),

    finden: (id: FilialId) => repo.findById(id),

    anlegen: async (angaben: {
      name: string;
      filialnummer: string;
      bundesland: Bundesland;
      adresse?: Adresse;
      logoBase64?: string | null;
    }) => {
      const filiale = neueFiliale(angaben);
      await repo.save(filiale);
      return filiale;
    },

    aktualisieren: async (filiale: Filiale) => {
      const aktualisiert: Filiale = { ...filiale, aktualisiertAm: new Date().toISOString() };
      await repo.save(aktualisiert);
      return aktualisiert;
    },

    /** Soft delete: employees/weekly plans/absences referencing this Filiale must stay intact and
     * historically accurate, so the UI never hard-deletes a Filiale with any data attached. */
    aktivStatusAendern: async (filiale: Filiale, aktiv: boolean) => {
      const aktualisiert: Filiale = { ...filiale, aktiv, aktualisiertAm: new Date().toISOString() };
      await repo.save(aktualisiert);
      return aktualisiert;
    },

    loeschen: (id: FilialId) => repo.delete(id),
  };
}

export type FilialeService = ReturnType<typeof erstelleFilialeService>;
