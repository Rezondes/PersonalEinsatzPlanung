import { create } from 'zustand';
import type { Branch } from '@domain/branch/Branch';
import { services } from '@infrastructure/services';

interface BranchesState {
  branches: Branch[];
  loading: boolean;
  loaded: boolean;
  reload: () => Promise<void>;
}

/**
 * Shared store instead of per-component local state: multiple components (AppShell, the master data
 * view, every hook using useSelectedBranch) previously each held their own independent copy of
 * the Branches list, so a save in one place (e.g. deactivating a Branch) never refreshed the header
 * dropdown elsewhere - a bug found during review. A single shared store fixes that at the root.
 */
export const useBranchesStore = create<BranchesState>((set) => ({
  branches: [],
  loading: true,
  loaded: false,
  reload: async () => {
    set({ loading: true });
    const list = await services.branch.all();
    set({ branches: list, loading: false, loaded: true });
  },
}));
