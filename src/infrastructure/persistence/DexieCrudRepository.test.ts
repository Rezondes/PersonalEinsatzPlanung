import { describe, it, expect, beforeEach } from 'vitest';
import type { BranchId } from '@domain/shared/ids';
import type { Branch } from '@domain/branch/Branch';
import { db } from './db';
import { DexieCrudRepository } from './DexieCrudRepository';

/** Exercises the generic CRUD behavior once against a real Dexie table, instead of duplicating the
 * same findAll/findById/save/delete/deleteAll assertions in every concrete repository's own test
 * file. Uses the branches table as the stand-in - the generic behavior doesn't depend on which
 * table it wraps, and each concrete repository's own test file still covers its aggregate-specific
 * finders (findByBranch, findByEmployee, findByBranchAndWeek, ...) plus that its `save`d/`findAll`n
 * shape matches its own domain type exactly. */
class TestRepository extends DexieCrudRepository<Branch, BranchId> {
  constructor() {
    super(db.branches);
  }
}

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

describe('DexieCrudRepository', () => {
  const repository = new TestRepository();

  beforeEach(async () => {
    await db.branches.clear();
  });

  describe('findAll', () => {
    it('returns an empty array when the table is empty', async () => {
      await expect(repository.findAll()).resolves.toEqual([]);
    });

    it('returns every saved record', async () => {
      const a = makeBranch({ id: 'branch-1' as BranchId, name: 'Filiale Nord' });
      const b = makeBranch({ id: 'branch-2' as BranchId, name: 'Filiale Süd' });
      await repository.save(a);
      await repository.save(b);

      const all = await repository.findAll();
      expect(all).toHaveLength(2);
      expect(all).toEqual(expect.arrayContaining([a, b]));
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

    it('overwrites an existing record with the same id instead of duplicating it (upsert)', async () => {
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
      const a = makeBranch({ id: 'branch-1' as BranchId });
      const b = makeBranch({ id: 'branch-2' as BranchId });
      await repository.save(a);
      await repository.save(b);

      await repository.delete('branch-1' as BranchId);

      await expect(repository.findById('branch-1' as BranchId)).resolves.toBeNull();
      await expect(repository.findAll()).resolves.toEqual([b]);
    });

    it('does not throw when the id does not exist', async () => {
      await expect(repository.delete('missing' as BranchId)).resolves.toBeUndefined();
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
