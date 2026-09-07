import type { FilialId, MitarbeiterId } from '@domain/shared/ids';
import type { Mitarbeiter } from '@domain/mitarbeiter/Mitarbeiter';
import type { MitarbeiterRepository } from '@application/ports/MitarbeiterRepository';
import { db } from './db';

export class DexieMitarbeiterRepository implements MitarbeiterRepository {
  async findAll(): Promise<Mitarbeiter[]> {
    return db.mitarbeiter.toArray();
  }

  async findByFiliale(filialeId: FilialId): Promise<Mitarbeiter[]> {
    return db.mitarbeiter.where('filialeId').equals(filialeId).toArray();
  }

  async findById(id: MitarbeiterId): Promise<Mitarbeiter | null> {
    return (await db.mitarbeiter.get(id)) ?? null;
  }

  async save(mitarbeiter: Mitarbeiter): Promise<void> {
    await db.mitarbeiter.put(mitarbeiter);
  }

  async delete(id: MitarbeiterId): Promise<void> {
    await db.mitarbeiter.delete(id);
  }

  async deleteAll(): Promise<void> {
    await db.mitarbeiter.clear();
  }
}
