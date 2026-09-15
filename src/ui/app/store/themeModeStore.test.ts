import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useThemeModeStore } from './themeModeStore';

describe('themeModeStore', () => {
  beforeEach(() => {
    // Order matters: themeModeStore uses the `persist` middleware, so setState() below also
    // re-writes localStorage. Resetting state first and clearing storage second guarantees every
    // test starts with both a clean in-memory singleton AND an empty localStorage - clearing
    // first would get silently undone by the setState() call that follows it.
    useThemeModeStore.setState({ mode: 'light' });
    localStorage.clear();
  });

  it('defaults to light on a fresh module load with no persisted value', async () => {
    vi.resetModules();
    const fresh = await import('./themeModeStore');

    expect(fresh.useThemeModeStore.getState().mode).toBe('light');
  });

  it('rehydrates a previously persisted dark value from localStorage on module load', async () => {
    localStorage.setItem('pep-theme-mode', JSON.stringify({ state: { mode: 'dark' }, version: 0 }));
    vi.resetModules();
    const fresh = await import('./themeModeStore');

    expect(fresh.useThemeModeStore.getState().mode).toBe('dark');
  });

  it('setMode updates the in-memory state immediately', () => {
    useThemeModeStore.getState().setMode('system');

    expect(useThemeModeStore.getState().mode).toBe('system');
  });

  it('persists the set mode to localStorage under pep-theme-mode', async () => {
    useThemeModeStore.getState().setMode('dark');

    await vi.waitFor(() => {
      const raw = localStorage.getItem('pep-theme-mode');
      expect(raw).not.toBeNull();
      const parsed = JSON.parse(raw as string);
      expect(parsed.state.mode).toBe('dark');
    });
  });
});
