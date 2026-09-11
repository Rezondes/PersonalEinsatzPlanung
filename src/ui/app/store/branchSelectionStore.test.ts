import { describe, it, expect, beforeEach } from 'vitest';
import { useBranchSelectionStore } from './branchSelectionStore';
import type { BranchId } from '@domain/shared/ids';

describe('branchSelectionStore', () => {
  beforeEach(() => {
    useBranchSelectionStore.setState({ selectedBranchId: null });
  });

  it('starts with no branch selected', () => {
    expect(useBranchSelectionStore.getState().selectedBranchId).toBeNull();
  });

  it('setSelectedBranch sets the selected branch id', () => {
    useBranchSelectionStore.getState().setSelectedBranch('b1' as BranchId);

    expect(useBranchSelectionStore.getState().selectedBranchId).toBe('b1');
  });

  it('setSelectedBranch(null) clears the selection', () => {
    useBranchSelectionStore.getState().setSelectedBranch('b1' as BranchId);
    useBranchSelectionStore.getState().setSelectedBranch(null);

    expect(useBranchSelectionStore.getState().selectedBranchId).toBeNull();
  });

  it('setSelectedBranch replaces a previously selected branch with a different one', () => {
    useBranchSelectionStore.getState().setSelectedBranch('b1' as BranchId);
    useBranchSelectionStore.getState().setSelectedBranch('b2' as BranchId);

    expect(useBranchSelectionStore.getState().selectedBranchId).toBe('b2');
  });
});
