import type { BranchId } from '@domain/shared/ids';
import type { Branch, FederalState } from '@domain/branch/Branch';
import { createBranch } from '@domain/branch/Branch';
import type { Address } from '@domain/branch/Address';
import type { BranchRepository } from '@application/ports/BranchRepository';

export function createBranchService(repo: BranchRepository) {
  return {
    all: () => repo.findAll(),

    find: (id: BranchId) => repo.findById(id),

    create: async (details: {
      name: string;
      branchNumber: string;
      federalState: FederalState;
      address?: Address;
      logoBase64?: string | null;
    }) => {
      const branch = createBranch(details);
      await repo.save(branch);
      return branch;
    },

    update: async (branch: Branch) => {
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

    delete: (id: BranchId) => repo.delete(id),
  };
}

export type BranchService = ReturnType<typeof createBranchService>;
