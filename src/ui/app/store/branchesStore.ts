import { create } from 'zustand';
import type { Branch } from '@domain/branch/Branch';
import { services } from '@infrastructure/services';
import { notify } from '@ui/app/store/notificationStore';

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
    try {
      const list = await services.branch.all();
      set({ branches: list, loaded: true });
    } catch (e) {
      // Without this, a rejected initial load left `loading` true forever - every consumer of
      // useBranchList/useSelectedBranch shows its own loading state, so the whole app appeared to
      // hang silently rather than surfacing the failure.
      notify.report(e, 'Filialen konnten nicht geladen werden');
    } finally {
      set({ loading: false });
    }
  },
}));
