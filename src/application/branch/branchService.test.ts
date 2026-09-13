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

  it('create() rejects a branchNumber that is already taken by another branch (N12)', async () => {
    const repo = fakeRepo();
    repo.findAll = vi.fn(async () => [existingBranch({ branchNumber: '2504' })]);

    await expect(
      createBranchService(repo).create({ name: 'Filiale Neu', branchNumber: '2504', federalState: 'Niedersachsen' }),
    ).rejects.toThrow('Diese Filialnummer ist bereits vergeben.');
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('update() rejects renaming to a branchNumber already taken by a different branch, but allows keeping its own unchanged number (N12)', async () => {
    const repo = fakeRepo();
    const own = existingBranch({ id: 'b1' as BranchId, branchNumber: '2504' });
    const other = existingBranch({ id: 'b2' as BranchId, branchNumber: '9999' });
    repo.findAll = vi.fn(async () => [own, other]);

    await expect(createBranchService(repo).update({ ...own, branchNumber: '9999' })).rejects.toThrow(
      'Diese Filialnummer ist bereits vergeben.',
    );
    expect(repo.save).not.toHaveBeenCalled();

    const updated = await createBranchService(repo).update({ ...own, name: 'Filiale Umbenannt' });
    expect(updated.name).toBe('Filiale Umbenannt');
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

});
