import { describe, it, expect, beforeEach } from 'vitest';
import type { BranchId } from '@domain/shared/ids';
import type { Branch } from '@domain/branch/Branch';
import { db } from './db';
import { DexieBranchRepository } from './DexieBranchRepository';

function makeBranch(overrides: Partial<Branch> = {}): Branch {
  return {
    id: 'branch-1' as BranchId,
    name: 'Filiale Nord',
    branchNumber: '001',
    address: { street: 'Hauptstraße', houseNumber: '12', postalCode: '30159', city: 'Hannover' },
    logoBase64: null,
    federalState: 'Niedersachsen',
    allowedOpenSundays: [],
    active: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

// Generic findAll/findById/save/delete/deleteAll behavior is covered once, against a real table,
// in DexieCrudRepository.test.ts - this file only needs to confirm DexieBranchRepository wires up
// to the actual branches table and shape correctly.
describe('DexieBranchRepository', () => {
  const repository = new DexieBranchRepository();

  beforeEach(async () => {
    await db.branches.clear();
  });

  it('round-trips a full Branch through the real branches table', async () => {
    const branch = makeBranch({ id: 'branch-1' as BranchId });

    await repository.save(branch);

    await expect(repository.findById('branch-1' as BranchId)).resolves.toEqual(branch);
    await expect(repository.findAll()).resolves.toEqual([branch]);
  });
});
