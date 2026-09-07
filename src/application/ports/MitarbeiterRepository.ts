import type { FilialId, MitarbeiterId } from '@domain/shared/ids';
import type { Mitarbeiter } from '@domain/mitarbeiter/Mitarbeiter';

export interface MitarbeiterRepository {
  findAll(): Promise<Mitarbeiter[]>;
  findByFiliale(filialeId: FilialId): Promise<Mitarbeiter[]>;
  findById(id: MitarbeiterId): Promise<Mitarbeiter | null>;
  save(mitarbeiter: Mitarbeiter): Promise<void>;
  delete(id: MitarbeiterId): Promise<void>;
  deleteAll(): Promise<void>;
}
