import type { BranchId } from '@domain/shared/ids';
import type { Branch, FederalState } from '@domain/branch/Branch';
import { createBranch, compareByName } from '@domain/branch/Branch';
import type { Address } from '@domain/branch/Address';
import type { BranchRepository } from '@application/ports/BranchRepository';
import { DomainError } from '@domain/shared/DomainError';

export function createBranchService(repo: BranchRepository) {
  // N12: no reliable key exists to de-duplicate employees (name+birthdate is a real false-positive
  // risk for two same-named employees, and there is no employee-number field), but a branch DOES
  // have one - branchNumber - so uniqueness is enforced for branches only, deliberately narrower
  // than "no duplicate records" in general. excludeId lets update() ignore the branch's own
  // (unchanged) number instead of flagging it as colliding with itself.
  async function assertBranchNumberAvailable(branchNumber: string, excludeId?: BranchId): Promise<void> {
    const all = await repo.findAll();
    if (all.some((b) => b.branchNumber === branchNumber && b.id !== excludeId)) {
      throw new DomainError('Diese Filialnummer ist bereits vergeben.');
    }
  }

  return {
    // Sorted on a copy, not in place - mutating the array the repository returned could surprise a
    // caller still holding the same reference.
    all: async () => [...(await repo.findAll())].sort(compareByName),

    find: (id: BranchId) => repo.findById(id),

    create: async (details: {
      name: string;
      branchNumber: string;
      federalState: FederalState;
      address?: Address;
      logoBase64?: string | null;
    }) => {
      await assertBranchNumberAvailable(details.branchNumber);
      const branch = createBranch(details);
      await repo.save(branch);
      return branch;
    },

    update: async (branch: Branch) => {
      await assertBranchNumberAvailable(branch.branchNumber, branch.id);
      const updated: Branch = { ...branch, updatedAt: new Date().toISOString() };
      await repo.save(updated);
      return updated;
    },

    /** Soft delete: employees/weekly schedules/absences referencing this Branch must stay intact and
     * historically accurate, so the UI never hard-deletes a Branch with any data attached. */
    changeActiveStatus: async (branch: Branch, active: boolean) => {
      const updated: Branch = { ...branch, active, updatedAt: new Date().toISOString() };
      await repo.save(updated);
      return updated;
    },

  };
}
