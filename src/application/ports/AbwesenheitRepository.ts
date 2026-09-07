import type { AbwesenheitId, MitarbeiterId } from '@domain/shared/ids';
import type { Abwesenheit } from '@domain/abwesenheit/Abwesenheit';

export interface AbwesenheitRepository {
  findAll(): Promise<Abwesenheit[]>;
  findByMitarbeiter(mitarbeiterId: MitarbeiterId): Promise<Abwesenheit[]>;
  findByFiliale(mitarbeiterIds: MitarbeiterId[]): Promise<Abwesenheit[]>;
  save(abwesenheit: Abwesenheit): Promise<void>;
  delete(id: AbwesenheitId): Promise<void>;
  deleteAll(): Promise<void>;
}
