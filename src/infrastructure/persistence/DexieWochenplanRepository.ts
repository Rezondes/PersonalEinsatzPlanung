import type { FilialId, WochenplanId } from '@domain/shared/ids';
import type { Kalenderwoche } from '@domain/shared/Kalenderwoche';
import type { Wochenplan } from '@domain/wochenplan/Wochenplan';
import type { WochenplanRepository } from '@application/ports/WochenplanRepository';
import { db } from './db';

export class DexieWochenplanRepository implements WochenplanRepository {
  async findAll(): Promise<Wochenplan[]> {
    return db.wochenplaene.toArray();
  }

  async findByFilialeUndWoche(filialeId: FilialId, kw: Kalenderwoche): Promise<Wochenplan | null> {
    const treffer = await db.wochenplaene
      .where('[filialeId+kalenderwoche.jahr+kalenderwoche.woche]')
      .equals([filialeId, kw.jahr, kw.woche])
      .first();
    return treffer ?? null;
  }

  async findByFiliale(filialeId: FilialId): Promise<Wochenplan[]> {
    return db.wochenplaene.where('filialeId').equals(filialeId).toArray();
  }

  async findById(id: WochenplanId): Promise<Wochenplan | null> {
    return (await db.wochenplaene.get(id)) ?? null;
  }

  async save(plan: Wochenplan): Promise<void> {
    await db.wochenplaene.put(plan);
  }

  async delete(id: WochenplanId): Promise<void> {
    await db.wochenplaene.delete(id);
  }

  async deleteAll(): Promise<void> {
    await db.wochenplaene.clear();
  }

  transaktion<T>(fn: () => Promise<T>): Promise<T> {
    return db.transaction('rw', db.wochenplaene, fn);
  }
}
