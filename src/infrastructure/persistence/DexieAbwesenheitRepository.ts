import type { AbwesenheitId, MitarbeiterId } from '@domain/shared/ids';
import type { Abwesenheit } from '@domain/abwesenheit/Abwesenheit';
import type { AbwesenheitRepository } from '@application/ports/AbwesenheitRepository';
import { db } from './db';

export class DexieAbwesenheitRepository implements AbwesenheitRepository {
  async findAll(): Promise<Abwesenheit[]> {
    return db.abwesenheiten.toArray();
  }

  async findByMitarbeiter(mitarbeiterId: MitarbeiterId): Promise<Abwesenheit[]> {
    return db.abwesenheiten.where('mitarbeiterId').equals(mitarbeiterId).toArray();
  }

  async findByFiliale(mitarbeiterIds: MitarbeiterId[]): Promise<Abwesenheit[]> {
    if (mitarbeiterIds.length === 0) {
      return [];
    }
    return db.abwesenheiten.where('mitarbeiterId').anyOf(mitarbeiterIds).toArray();
  }

  async save(abwesenheit: Abwesenheit): Promise<void> {
    await db.abwesenheiten.put(abwesenheit);
  }

  async delete(id: AbwesenheitId): Promise<void> {
    await db.abwesenheiten.delete(id);
  }

  async deleteAll(): Promise<void> {
    await db.abwesenheiten.clear();
  }
}
