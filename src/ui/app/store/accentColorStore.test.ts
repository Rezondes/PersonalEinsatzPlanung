import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAccentColorStore } from './accentColorStore';

describe('accentColorStore', () => {
  beforeEach(() => {
    // Order matters: see themeModeStore.test.ts's identical note - reset in-memory state first,
    // then clear storage, since setState() re-writes localStorage via the persist middleware.
    useAccentColorStore.setState({ accentColor: 'gruen' });
    localStorage.clear();
  });

  it('defaults to gruen on a fresh module load with no persisted value', async () => {
    vi.resetModules();
    const fresh = await import('./accentColorStore');

    expect(fresh.useAccentColorStore.getState().accentColor).toBe('gruen');
  });

  it('rehydrates a previously persisted color from localStorage on module load', async () => {
    localStorage.setItem('pep-accent-color', JSON.stringify({ state: { accentColor: 'blau' }, version: 0 }));
    vi.resetModules();
    const fresh = await import('./accentColorStore');

    expect(fresh.useAccentColorStore.getState().accentColor).toBe('blau');
  });

  it('setAccentColor updates the in-memory state immediately', () => {
    useAccentColorStore.getState().setAccentColor('lila');

    expect(useAccentColorStore.getState().accentColor).toBe('lila');
  });

  it('persists the set color to localStorage under pep-accent-color', async () => {
    useAccentColorStore.getState().setAccentColor('petrol');

    await vi.waitFor(() => {
      const raw = localStorage.getItem('pep-accent-color');
      expect(raw).not.toBeNull();
      const parsed = JSON.parse(raw as string);
      expect(parsed.state.accentColor).toBe('petrol');
    });
  });
});
