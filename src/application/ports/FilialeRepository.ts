import type { FilialId } from '@domain/shared/ids';
import type { Filiale } from '@domain/filiale/Filiale';

export interface FilialeRepository {
  findAll(): Promise<Filiale[]>;
  findById(id: FilialId): Promise<Filiale | null>;
  save(filiale: Filiale): Promise<void>;
  delete(id: FilialId): Promise<void>;
  deleteAll(): Promise<void>;
}
