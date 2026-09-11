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

describe('DexieBranchRepository', () => {
  const repository = new DexieBranchRepository();

  beforeEach(async () => {
    await db.branches.clear();
  });

  describe('findAll', () => {
    it('returns an empty array when the table is empty', async () => {
      await expect(repository.findAll()).resolves.toEqual([]);
    });

    it('returns saved records', async () => {
      const branchA = makeBranch({ id: 'branch-1' as BranchId, name: 'Filiale Nord' });
      const branchB = makeBranch({ id: 'branch-2' as BranchId, name: 'Filiale Süd' });

      await repository.save(branchA);
      await repository.save(branchB);

      const all = await repository.findAll();
      expect(all).toHaveLength(2);
      expect(all).toEqual(expect.arrayContaining([branchA, branchB]));
    });
  });

  describe('findById', () => {
    it('returns null for a missing id', async () => {
      await expect(repository.findById('missing' as BranchId)).resolves.toBeNull();
    });

    it('returns the exact record for an existing id', async () => {
      const branch = makeBranch({ id: 'branch-1' as BranchId });
      await repository.save(branch);

      await expect(repository.findById('branch-1' as BranchId)).resolves.toEqual(branch);
    });
  });

  describe('save', () => {
    it('inserts a new record', async () => {
      const branch = makeBranch({ id: 'branch-1' as BranchId });
      await repository.save(branch);

      await expect(repository.findAll()).resolves.toEqual([branch]);
    });

    it('overwrites an existing record with the same id instead of duplicating it', async () => {
      const branch = makeBranch({ id: 'branch-1' as BranchId, name: 'Filiale Nord', active: true });
      await repository.save(branch);

      const updated: Branch = { ...branch, name: 'Filiale Nord (umbenannt)', active: false };
      await repository.save(updated);

      const all = await repository.findAll();
      expect(all).toHaveLength(1);
      expect(all[0]).toEqual(updated);
    });
  });

  describe('delete', () => {
    it('removes exactly the targeted record and leaves others untouched', async () => {
      const branchA = makeBranch({ id: 'branch-1' as BranchId });
      const branchB = makeBranch({ id: 'branch-2' as BranchId });
      await repository.save(branchA);
      await repository.save(branchB);

      await repository.delete('branch-1' as BranchId);

      await expect(repository.findById('branch-1' as BranchId)).resolves.toBeNull();
      await expect(repository.findAll()).resolves.toEqual([branchB]);
    });
  });

  describe('deleteAll', () => {
    it('empties the table', async () => {
      await repository.save(makeBranch({ id: 'branch-1' as BranchId }));
      await repository.save(makeBranch({ id: 'branch-2' as BranchId }));

      await repository.deleteAll();

      await expect(repository.findAll()).resolves.toEqual([]);
    });
  });
});
