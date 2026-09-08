import type { BranchId } from '@domain/shared/ids';
import type { Branch } from '@domain/branch/Branch';

export interface BranchRepository {
  findAll(): Promise<Branch[]>;
  findById(id: BranchId): Promise<Branch | null>;
  save(branch: Branch): Promise<void>;
  delete(id: BranchId): Promise<void>;
  deleteAll(): Promise<void>;
}
