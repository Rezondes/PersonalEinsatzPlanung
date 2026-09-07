import type { FilialId } from '@domain/shared/ids';
import type { Filiale } from '@domain/filiale/Filiale';
import type { FilialeRepository } from '@application/ports/FilialeRepository';
import { db } from './db';

export class DexieFilialeRepository implements FilialeRepository {
  async findAll(): Promise<Filiale[]> {
    return db.filialen.toArray();
  }

  async findById(id: FilialId): Promise<Filiale | null> {
    return (await db.filialen.get(id)) ?? null;
  }

  async save(filiale: Filiale): Promise<void> {
    await db.filialen.put(filiale);
  }

  async delete(id: FilialId): Promise<void> {
    await db.filialen.delete(id);
  }

  async deleteAll(): Promise<void> {
    await db.filialen.clear();
  }
}
