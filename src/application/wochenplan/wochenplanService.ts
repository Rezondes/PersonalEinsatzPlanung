import type { FilialId, MitarbeiterId, WochenplanId } from '@domain/shared/ids';
import type { Kalenderwoche, Wochentag } from '@domain/shared/Kalenderwoche';
import { kalenderwocheDavor } from '@domain/shared/Kalenderwoche';
import type { Wochenplan } from '@domain/wochenplan/Wochenplan';
import { neuerWochenplan, mitTageseintrag, mitSollAnpassung } from '@domain/wochenplan/Wochenplan';
import type { Tageseintrag } from '@domain/wochenplan/MitarbeiterWocheneinsatz';
import { leererWocheneinsatz } from '@domain/wochenplan/MitarbeiterWocheneinsatz';
import type { WochenplanRepository } from '@application/ports/WochenplanRepository';
import type { MitarbeiterRepository } from '@application/ports/MitarbeiterRepository';

export function erstelleWochenplanService(repo: WochenplanRepository, mitarbeiterRepo: MitarbeiterRepository) {
  async function aktiveMitarbeiterIds(filialeId: FilialId): Promise<MitarbeiterId[]> {
    const mitarbeiterListe = await mitarbeiterRepo.findByFiliale(filialeId);
    return mitarbeiterListe.filter((m) => m.aktiv).map((m) => m.id);
  }

  return {
    /** Loads the weekly plan for (filialeId, kw), creating an empty plan for all active
     * employees of the branch if needed and saving it immediately. Employees hired AFTER the
     * plan was created are automatically appended with an empty assignment on load ("self
     * healing"), so newly hired employees don't have to be manually added to every existing
     * weekly plan. */
    getOderErstelle: async (filialeId: FilialId, kw: Kalenderwoche): Promise<Wochenplan> => {
      const aktiveIds = await aktiveMitarbeiterIds(filialeId);

      // find + conditional create must be one atomic unit: without the transaction, two concurrent
      // calls for the same (filialeId, kw) could both read "not found" and each save a new plan,
      // creating a duplicate aggregate for the same week.
      return repo.transaktion(async () => {
        const bestehend = await repo.findByFilialeUndWoche(filialeId, kw);

        if (bestehend) {
          const fehlendeIds = aktiveIds.filter(
            (id) => !bestehend.mitarbeiterEinsaetze.some((e) => e.mitarbeiterId === id),
          );
          if (fehlendeIds.length === 0) {
            return bestehend;
          }
          const ergaenzt: Wochenplan = {
            ...bestehend,
            mitarbeiterEinsaetze: [...bestehend.mitarbeiterEinsaetze, ...fehlendeIds.map(leererWocheneinsatz)],
          };
          await repo.save(ergaenzt);
          return ergaenzt;
        }

        const plan = neuerWochenplan(filialeId, kw, aktiveIds);
        await repo.save(plan);
        return plan;
      });
    },

    /** Creates a new weekly plan and carries over the previous week's shifts as a starting point
     * (useful for recurring schedules). Existing plans are never overwritten. */
    ausVorwocheKopieren: async (filialeId: FilialId, kw: Kalenderwoche): Promise<Wochenplan> => {
      const aktiveIds = await aktiveMitarbeiterIds(filialeId);

      return repo.transaktion(async () => {
        const bestehend = await repo.findByFilialeUndWoche(filialeId, kw);
        if (bestehend) {
          return bestehend;
        }

        const vorwoche = await repo.findByFilialeUndWoche(filialeId, kalenderwocheDavor(kw));

        const mitarbeiterEinsaetze = aktiveIds.map((mitarbeiterId) => {
          const vorwocheEinsatz = vorwoche?.mitarbeiterEinsaetze.find((e) => e.mitarbeiterId === mitarbeiterId);
          return vorwocheEinsatz ?? leererWocheneinsatz(mitarbeiterId);
        });

        const plan: Wochenplan = { ...neuerWochenplan(filialeId, kw, []), mitarbeiterEinsaetze };
        await repo.save(plan);
        return plan;
      });
    },

    speichern: async (plan: Wochenplan): Promise<Wochenplan> => {
      const aktualisiert: Wochenplan = { ...plan, aktualisiertAm: new Date().toISOString() };
      await repo.save(aktualisiert);
      return aktualisiert;
    },

    tageseintragSetzenUndSpeichern: async (
      plan: Wochenplan,
      mitarbeiterId: MitarbeiterId,
      tag: Wochentag,
      eintrag: Tageseintrag,
    ): Promise<Wochenplan> => {
      const aktualisiert = mitTageseintrag(plan, mitarbeiterId, tag, eintrag);
      await repo.save(aktualisiert);
      return aktualisiert;
    },

    fuerFiliale: (filialeId: FilialId) => repo.findByFiliale(filialeId),

    finden: (id: WochenplanId) => repo.findById(id),

    /** Reads the plan for exactly (filialeId, kw) without creating one if it's missing - unlike
     * getOderErstelle, used e.g. to look at the previous week's plan without side effects. */
    findenFuerWoche: (filialeId: FilialId, kw: Kalenderwoche) => repo.findByFilialeUndWoche(filialeId, kw),

    /** Applies a batch of Soll-Stunden carry-over adjustments (see mitSollAnpassung) and saves the
     * plan once. */
    sollAnpassungenUebernehmen: async (
      plan: Wochenplan,
      anpassungen: { mitarbeiterId: MitarbeiterId; minuten: number }[],
    ): Promise<Wochenplan> => {
      const aktualisiert = anpassungen.reduce(
        (zwischenstand, { mitarbeiterId, minuten }) => mitSollAnpassung(zwischenstand, mitarbeiterId, minuten),
        plan,
      );
      await repo.save(aktualisiert);
      return aktualisiert;
    },
  };
}

export type WochenplanService = ReturnType<typeof erstelleWochenplanService>;
