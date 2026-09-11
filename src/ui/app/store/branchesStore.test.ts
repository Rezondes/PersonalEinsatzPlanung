import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createBranch } from '@domain/branch/Branch';
import { services } from '@infrastructure/services';
import { useBranchesStore } from './branchesStore';

vi.mock('@infrastructure/services', () => ({
  services: { branch: { all: vi.fn() } },
}));

const allMock = vi.mocked(services.branch.all);

function branch(name: string) {
  return createBranch({ name, branchNumber: '2504', federalState: 'Niedersachsen' });
}

beforeEach(() => {
  allMock.mockReset();
  useBranchesStore.setState({ branches: [], loading: true, loaded: false });
});

describe('useBranchesStore', () => {
  it('starts with an empty branch list, loading, not yet loaded', async () => {
    vi.resetModules();
    const fresh = await import('./branchesStore');
    const state = fresh.useBranchesStore.getState();
    expect(state.branches).toEqual([]);
    expect(state.loading).toBe(true);
    expect(state.loaded).toBe(false);
  });

  it('sets loading true synchronously when reload() is called, before the promise resolves', () => {
    useBranchesStore.setState({ loading: false });
    let resolveAll!: (branches: ReturnType<typeof branch>[]) => void;
    allMock.mockReturnValue(
      new Promise((resolve) => {
        resolveAll = resolve;
      }),
    );

    const pending = useBranchesStore.getState().reload();

    expect(useBranchesStore.getState().loading).toBe(true);

    resolveAll([]);
    return pending;
  });

  it('populates branches from services.branch.all() and marks loading false, loaded true once resolved', async () => {
    const b1 = branch('Velpke');
    const b2 = branch('Helmstedt');
    allMock.mockResolvedValue([b1, b2]);

    await useBranchesStore.getState().reload();

    const state = useBranchesStore.getState();
    expect(state.branches).toEqual([b1, b2]);
    expect(state.loading).toBe(false);
    expect(state.loaded).toBe(true);
  });

  it('replaces a previously loaded branch list with whatever the next reload() returns', async () => {
    const first = branch('Velpke');
    allMock.mockResolvedValue([first]);
    await useBranchesStore.getState().reload();
    expect(useBranchesStore.getState().branches).toEqual([first]);

    const second = branch('Helmstedt');
    allMock.mockResolvedValue([second]);
    await useBranchesStore.getState().reload();

    expect(useBranchesStore.getState().branches).toEqual([second]);
  });
});
