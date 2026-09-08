import type { BranchId } from '@domain/shared/ids';
import type { Branch } from '@domain/branch/Branch';
import type { BranchRepository } from '@application/ports/BranchRepository';
import { db } from './db';

export class DexieBranchRepository implements BranchRepository {
  async findAll(): Promise<Branch[]> {
    return db.branches.toArray();
  }

  async findById(id: BranchId): Promise<Branch | null> {
    return (await db.branches.get(id)) ?? null;
  }

  async save(branch: Branch): Promise<void> {
    await db.branches.put(branch);
  }

  async delete(id: BranchId): Promise<void> {
    await db.branches.delete(id);
  }

  async deleteAll(): Promise<void> {
    await db.branches.clear();
  }
}
