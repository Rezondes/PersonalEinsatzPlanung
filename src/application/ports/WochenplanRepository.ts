import type { FilialId, WochenplanId } from '@domain/shared/ids';
import type { Kalenderwoche } from '@domain/shared/Kalenderwoche';
import type { Wochenplan } from '@domain/wochenplan/Wochenplan';

export interface WochenplanRepository {
  findAll(): Promise<Wochenplan[]>;
  findByFilialeUndWoche(filialeId: FilialId, kw: Kalenderwoche): Promise<Wochenplan | null>;
  findByFiliale(filialeId: FilialId): Promise<Wochenplan[]>;
  findById(id: WochenplanId): Promise<Wochenplan | null>;
  save(plan: Wochenplan): Promise<void>;
  delete(id: WochenplanId): Promise<void>;
  deleteAll(): Promise<void>;
  /** Runs `fn` inside a single atomic transaction over the Wochenplan store. Needed for
   * find-or-create logic (getOderErstelle): without it, two concurrent calls for the same
   * (filialeId, Kalenderwoche) could both see "not found" and each create a duplicate plan. */
  transaktion<T>(fn: () => Promise<T>): Promise<T>;
}
