import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { BranchId } from '@domain/shared/ids';

interface BranchSelectionState {
  selectedBranchId: BranchId | null;
  setSelectedBranch: (id: BranchId | null) => void;
}

/**
 * Persisted to sessionStorage (not localStorage, and never Dexie/the JSON/Google-Drive backup
 * format - same "small global UI state" rule as themeModeStore/localeStore) so the selected
 * Filiale survives a reload (F5) instead of always falling back to the first active branch (see
 * useBranch.ts's fallback effect). sessionStorage specifically, not localStorage: a genuinely new
 * browser session/tab is expected to start without a selection, same as before this existed.
 */
export const useBranchSelectionStore = create<BranchSelectionState>()(
  persist(
    (set) => ({
      selectedBranchId: null,
      setSelectedBranch: (id) => set({ selectedBranchId: id }),
    }),
    { name: 'pep-selected-branch', storage: createJSONStorage(() => sessionStorage) },
  ),
);
