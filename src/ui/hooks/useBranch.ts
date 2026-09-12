import { useEffect } from 'react';
import { useBranchesStore } from '@ui/app/store/branchesStore';
import { useBranchSelectionStore } from '@ui/app/store/branchSelectionStore';

export function useBranchList() {
  const branches = useBranchesStore((s) => s.branches);
  const loading = useBranchesStore((s) => s.loading);
  const loaded = useBranchesStore((s) => s.loaded);
  const reload = useBranchesStore((s) => s.reload);
  const selectedBranchId = useBranchSelectionStore((s) => s.selectedBranchId);
  const setSelectedBranch = useBranchSelectionStore((s) => s.setSelectedBranch);

  useEffect(() => {
    if (!loaded) {
      reload();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  useEffect(() => {
    // Nothing to judge the current selection against yet (still loading) - touching it here would
    // clobber a pre-existing selection with null for one render, before the real list arrives.
    if (branches.length === 0) return;
    // Checked against ACTIVE branches only, not the raw list: a deactivated branch stays IN
    // branches (only deleted ones disappear), so a bare "is the id still present" check never
    // fired for it - the header (which itself filters to activeBranches) was left pointing at a
    // Select value with no matching MenuItem, rendering blank. Falls back to no selection at all
    // when every branch is inactive, which every view's existing "no branch selected" state
    // already covers - deliberately not a new, separate empty state to invent.
    const activeBranches = branches.filter((b) => b.active);
    const selectedIsActive = activeBranches.some((b) => b.id === selectedBranchId);
    if (selectedIsActive) return;
    const fallbackId = activeBranches[0]?.id ?? null;
    if (fallbackId !== selectedBranchId) {
      setSelectedBranch(fallbackId);
    }
  }, [branches, selectedBranchId, setSelectedBranch]);

  return { branches, loading, reload };
}

export function useSelectedBranch() {
  const { branches, loading, reload } = useBranchList();
  const selectedBranchId = useBranchSelectionStore((s) => s.selectedBranchId);
  const branch = branches.find((b) => b.id === selectedBranchId) ?? null;
  return { branch, branches, loading, reload };
}
