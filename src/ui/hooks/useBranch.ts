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
    if (!selectedBranchId && branches.length > 0) {
      setSelectedBranch(branches[0].id);
    } else if (selectedBranchId && !branches.some((b) => b.id === selectedBranchId) && branches.length > 0) {
      // previously selected Branch no longer exists in the list (e.g. deactivated while filtered out elsewhere)
      setSelectedBranch(branches[0].id);
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
