import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import type { BranchId } from '@domain/shared/ids';
import type { Branch } from '@domain/branch/Branch';
import { services } from '@infrastructure/services';
import { useBranchesStore } from '@ui/app/store/branchesStore';
import { useBranchSelectionStore } from '@ui/app/store/branchSelectionStore';
import { useBranchList, useSelectedBranch } from './useBranch';

vi.mock('@infrastructure/services', () => ({
  services: { branch: { all: vi.fn() } },
}));

const allMock = vi.mocked(services.branch.all);

function makeBranch(overrides: Partial<Branch> = {}): Branch {
  return {
    id: 'branch-1' as BranchId,
    name: 'Filiale Nord',
    branchNumber: '001',
    address: { street: 'Hauptstraße', houseNumber: '12', postalCode: '30159', city: 'Hannover' },
    logoBase64: null,
    federalState: 'Niedersachsen',
    allowedOpenSundays: [],
    active: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('useBranchList', () => {
  beforeEach(() => {
    allMock.mockReset();
    allMock.mockResolvedValue([]);
    useBranchesStore.setState({ branches: [], loading: true, loaded: false });
    useBranchSelectionStore.setState({ selectedBranchId: null });
  });

  it('reloads automatically on first render and reflects the loaded state', async () => {
    const branches = [makeBranch({ id: 'branch-1' as BranchId })];
    allMock.mockResolvedValue(branches);

    const { result } = renderHook(() => useBranchList());

    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(allMock).toHaveBeenCalledTimes(1);
    expect(result.current.branches).toEqual(branches);
  });

  it('does not reload again on a render while already loaded', async () => {
    const branches = [makeBranch({ id: 'branch-1' as BranchId })];
    useBranchesStore.setState({ branches, loading: false, loaded: true });
    allMock.mockResolvedValue(branches);

    renderHook(() => useBranchList());

    await waitFor(() => {
      expect(allMock).not.toHaveBeenCalled();
    });
  });

  it('manually calling reload re-fetches', async () => {
    const first = [makeBranch({ id: 'branch-1' as BranchId })];
    const second = [makeBranch({ id: 'branch-1' as BranchId }), makeBranch({ id: 'branch-2' as BranchId })];
    allMock.mockResolvedValueOnce(first).mockResolvedValueOnce(second);

    const { result } = renderHook(() => useBranchList());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(allMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.reload();
    });

    expect(allMock).toHaveBeenCalledTimes(2);
    expect(useBranchesStore.getState().branches).toEqual(second);
  });
});

describe('useSelectedBranch', () => {
  beforeEach(() => {
    allMock.mockReset();
    allMock.mockResolvedValue([]);
    useBranchesStore.setState({ branches: [], loading: true, loaded: false });
    useBranchSelectionStore.setState({ selectedBranchId: null });
  });

  it('returns branch: null while no branch is selected and none loaded yet', async () => {
    const { result } = renderHook(() => useSelectedBranch());

    expect(result.current.branch).toBeNull();

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.branch).toBeNull();
  });

  it('auto-selects the first branch when none is currently selected', async () => {
    const branches = [makeBranch({ id: 'branch-1' as BranchId }), makeBranch({ id: 'branch-2' as BranchId })];
    allMock.mockResolvedValue(branches);

    const { result } = renderHook(() => useSelectedBranch());

    await waitFor(() => expect(result.current.branch?.id).toBe('branch-1'));

    expect(useBranchSelectionStore.getState().selectedBranchId).toBe('branch-1');
  });

  it('falls back to the first branch when the previously selected one no longer exists', async () => {
    useBranchSelectionStore.setState({ selectedBranchId: 'deleted-branch' as BranchId });
    const branches = [makeBranch({ id: 'branch-1' as BranchId }), makeBranch({ id: 'branch-2' as BranchId })];
    allMock.mockResolvedValue(branches);

    const { result } = renderHook(() => useSelectedBranch());

    await waitFor(() => expect(result.current.branch?.id).toBe('branch-1'));

    expect(useBranchSelectionStore.getState().selectedBranchId).toBe('branch-1');
  });

  it('leaves the selection alone when the previously selected branch still exists', async () => {
    useBranchSelectionStore.setState({ selectedBranchId: 'branch-2' as BranchId });
    const branches = [makeBranch({ id: 'branch-1' as BranchId }), makeBranch({ id: 'branch-2' as BranchId })];
    allMock.mockResolvedValue(branches);

    const { result } = renderHook(() => useSelectedBranch());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.branch?.id).toBe('branch-2');
    expect(useBranchSelectionStore.getState().selectedBranchId).toBe('branch-2');
  });
});
