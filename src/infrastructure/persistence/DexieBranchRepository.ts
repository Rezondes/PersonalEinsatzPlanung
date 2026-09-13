import type { BranchId } from '@domain/shared/ids';
import type { Branch } from '@domain/branch/Branch';
import type { BranchRepository } from '@application/ports/BranchRepository';
import { DexieCrudRepository } from './DexieCrudRepository';
import { db } from './db';

export class DexieBranchRepository extends DexieCrudRepository<Branch, BranchId> implements BranchRepository {
  constructor() {
    super(db.branches);
  }
}
