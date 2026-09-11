import { describe, it, expect, vi } from 'vitest';
import type { BranchId } from '@domain/shared/ids';
import type { Branch } from '@domain/branch/Branch';
import type { BranchRepository } from '@application/ports/BranchRepository';
import { createBranchService } from './branchService';

function fakeRepo(): BranchRepository {
  return {
    findAll: vi.fn(async () => []),
    findById: vi.fn(async () => null),
    save: vi.fn(async () => {}),
    delete: vi.fn(async () => {}),
    deleteAll: vi.fn(),
  };
}

function existingBranch(overrides: Partial<Branch> = {}): Branch {
  return {
    id: 'b1' as BranchId,
    name: 'Filiale Velpke',
    branchNumber: '2504',
    address: { street: '', houseNumber: '', postalCode: '', city: '' },
    logoBase64: null,
    federalState: 'Niedersachsen',
    allowedOpenSundays: [],
    active: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('branchService', () => {
  it('all delegates to the repository', async () => {
    const repo = fakeRepo();
    await createBranchService(repo).all();
    expect(repo.findAll).toHaveBeenCalled();
  });

  it('find delegates to the repository with the given id', async () => {
    const repo = fakeRepo();
    await createBranchService(repo).find('b1' as BranchId);
    expect(repo.findById).toHaveBeenCalledWith('b1');
  });

  it('create builds a new Branch and saves it', async () => {
    const repo = fakeRepo();
    const branch = await createBranchService(repo).create({
      name: 'Filiale Velpke',
      branchNumber: '2504',
      federalState: 'Niedersachsen',
    });

    expect(branch.id).toBeTruthy();
    expect(branch.active).toBe(true);
    expect(repo.save).toHaveBeenCalledWith(branch);
  });

  it('update saves the branch with a refreshed updatedAt', async () => {
    const repo = fakeRepo();
    const branch = existingBranch();

    const updated = await createBranchService(repo).update({ ...branch, name: 'Filiale Weidenweg' });

    expect(updated.name).toBe('Filiale Weidenweg');
    expect(updated.updatedAt).not.toBe(branch.updatedAt);
    expect(repo.save).toHaveBeenCalledWith(updated);
  });

  it('changeActiveStatus flips active without hard-deleting', async () => {
    const repo = fakeRepo();
    const branch = existingBranch({ active: true });

    const deactivated = await createBranchService(repo).changeActiveStatus(branch, false);

    expect(deactivated.active).toBe(false);
    expect(deactivated.id).toBe(branch.id);
    expect(repo.save).toHaveBeenCalledWith(deactivated);
    expect(repo.delete).not.toHaveBeenCalled();
  });

  it('delete calls the repository with the given id', async () => {
    const repo = fakeRepo();
    await createBranchService(repo).delete('b1' as BranchId);
    expect(repo.delete).toHaveBeenCalledWith('b1');
  });
});
