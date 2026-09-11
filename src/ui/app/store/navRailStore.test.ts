import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useNavRailStore } from './navRailStore';

describe('navRailStore', () => {
  beforeEach(() => {
    // Order matters: navRailStore uses the `persist` middleware, so setState() below also
    // re-writes localStorage. Resetting state first and clearing storage second guarantees every
    // test starts with both a clean in-memory singleton AND an empty localStorage - clearing
    // first would get silently undone by the setState() call that follows it.
    useNavRailStore.setState({ collapsed: false });
    localStorage.clear();
  });

  it('defaults to collapsed false on a fresh module load with no persisted value', async () => {
    vi.resetModules();
    const fresh = await import('./navRailStore');

    expect(fresh.useNavRailStore.getState().collapsed).toBe(false);
  });

  it('rehydrates a previously persisted collapsed:true value from localStorage on module load', async () => {
    localStorage.setItem(
      'pep-nav-rail-collapsed',
      JSON.stringify({ state: { collapsed: true }, version: 0 }),
    );
    vi.resetModules();
    const fresh = await import('./navRailStore');

    expect(fresh.useNavRailStore.getState().collapsed).toBe(true);
  });

  it('toggle() flips collapsed from false to true', () => {
    useNavRailStore.getState().toggle();

    expect(useNavRailStore.getState().collapsed).toBe(true);
  });

  it('toggle() flips collapsed back to false on a second call', () => {
    useNavRailStore.getState().toggle();
    useNavRailStore.getState().toggle();

    expect(useNavRailStore.getState().collapsed).toBe(false);
  });

  it('persists the toggled value to localStorage under pep-nav-rail-collapsed', async () => {
    useNavRailStore.getState().toggle();

    await vi.waitFor(() => {
      const raw = localStorage.getItem('pep-nav-rail-collapsed');
      expect(raw).not.toBeNull();
      const parsed = JSON.parse(raw as string);
      expect(parsed.state.collapsed).toBe(true);
    });
  });

  it('persists the value again after toggling back to false', async () => {
    useNavRailStore.getState().toggle();
    useNavRailStore.getState().toggle();

    await vi.waitFor(() => {
      const raw = localStorage.getItem('pep-nav-rail-collapsed');
      const parsed = JSON.parse(raw as string);
      expect(parsed.state.collapsed).toBe(false);
    });
  });
});
