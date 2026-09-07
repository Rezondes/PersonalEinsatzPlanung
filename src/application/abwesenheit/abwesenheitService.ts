import type { AbwesenheitId, MitarbeiterId } from '@domain/shared/ids';
import type { AbwesenheitEingabe } from '@domain/abwesenheit/Abwesenheit';
import { neueAbwesenheit } from '@domain/abwesenheit/Abwesenheit';
import { zaehleUrlaubstageInZeitraum, berechneResturlaub } from '@domain/abwesenheit/urlaubsBerechnung';
import type { Mitarbeiter } from '@domain/mitarbeiter/Mitarbeiter';
import type { AbwesenheitRepository } from '@application/ports/AbwesenheitRepository';

export function erstelleAbwesenheitService(repo: AbwesenheitRepository) {
  return {
    fuerMitarbeiter: (mitarbeiterId: MitarbeiterId) => repo.findByMitarbeiter(mitarbeiterId),

    fuerFiliale: (mitarbeiterIds: MitarbeiterId[]) => repo.findByFiliale(mitarbeiterIds),

    anlegen: async (angaben: AbwesenheitEingabe) => {
      const abwesenheit = neueAbwesenheit(angaben);
      await repo.save(abwesenheit);
      return abwesenheit;
    },

    loeschen: (id: AbwesenheitId) => repo.delete(id),

    resturlaubBerechnen: async (
      mitarbeiter: Mitarbeiter,
      jahr: number,
      istFeiertag?: (isoDatum: string) => boolean,
    ): Promise<number> => {
      const abwesenheiten = await repo.findByMitarbeiter(mitarbeiter.id);
      const genommeneTage = zaehleUrlaubstageInZeitraum(abwesenheiten, jahr, istFeiertag);
      return berechneResturlaub(mitarbeiter, genommeneTage);
    },
  };
}

export type AbwesenheitService = ReturnType<typeof erstelleAbwesenheitService>;
