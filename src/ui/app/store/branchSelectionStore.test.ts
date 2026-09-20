import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useBranchSelectionStore } from './branchSelectionStore';
import type { BranchId } from '@domain/shared/ids';

describe('branchSelectionStore', () => {
  beforeEach(() => {
    // Order matters: the store uses the `persist` middleware, so setState() below also re-writes
    // sessionStorage. Resetting state first and clearing storage second guarantees every test
    // starts with both a clean in-memory singleton AND empty storage - clearing first would get
    // silently undone by the setState() call that follows it (same pattern as themeModeStore.test.ts).
    useBranchSelectionStore.setState({ selectedBranchId: null });
    sessionStorage.clear();
    localStorage.clear();
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

  it('defaults to no selection on a fresh module load with empty sessionStorage', async () => {
    vi.resetModules();
    const fresh = await import('./branchSelectionStore');

    expect(fresh.useBranchSelectionStore.getState().selectedBranchId).toBeNull();
  });

  it('rehydrates a previously persisted branch from sessionStorage on module load', async () => {
    sessionStorage.setItem('pep-selected-branch', JSON.stringify({ state: { selectedBranchId: 'b2' }, version: 0 }));
    vi.resetModules();
    const fresh = await import('./branchSelectionStore');

    expect(fresh.useBranchSelectionStore.getState().selectedBranchId).toBe('b2');
  });

  it('persists a selected branch to sessionStorage under pep-selected-branch', async () => {
    useBranchSelectionStore.getState().setSelectedBranch('b1' as BranchId);

    await vi.waitFor(() => {
      const raw = sessionStorage.getItem('pep-selected-branch');
      expect(raw).not.toBeNull();
      const parsed = JSON.parse(raw as string);
      expect(parsed.state.selectedBranchId).toBe('b1');
    });
  });

  it('does not write the selection to localStorage', async () => {
    useBranchSelectionStore.getState().setSelectedBranch('b1' as BranchId);

    await vi.waitFor(() => {
      expect(sessionStorage.getItem('pep-selected-branch')).not.toBeNull();
    });
    expect(localStorage.getItem('pep-selected-branch')).toBeNull();
  });
});
