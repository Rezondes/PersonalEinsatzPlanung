import { create } from 'zustand';
import type { BranchId } from '@domain/shared/ids';

interface BranchSelectionState {
  selectedBranchId: BranchId | null;
  setSelectedBranch: (id: BranchId | null) => void;
}

export const useBranchSelectionStore = create<BranchSelectionState>((set) => ({
  selectedBranchId: null,
  setSelectedBranch: (id) => set({ selectedBranchId: id }),
}));
