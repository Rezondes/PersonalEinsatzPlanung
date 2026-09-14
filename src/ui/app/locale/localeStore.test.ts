import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useLocaleStore } from './localeStore';

describe('localeStore', () => {
  beforeEach(() => {
    // Order matters: localeStore uses the `persist` middleware, so setState() below also re-writes
    // localStorage. Resetting state first and clearing storage second guarantees every test starts
    // with both a clean in-memory singleton AND an empty localStorage - clearing first would get
    // silently undone by the setState() call that follows it.
    useLocaleStore.setState({ locale: 'de' });
    localStorage.clear();
  });

  it('defaults to "de" on a fresh module load with no persisted value', async () => {
    vi.resetModules();
    const fresh = await import('./localeStore');

    expect(fresh.useLocaleStore.getState().locale).toBe('de');
  });

  it('rehydrates a previously persisted locale from localStorage on module load', async () => {
    localStorage.setItem('pep-locale', JSON.stringify({ state: { locale: 'de' }, version: 0 }));
    vi.resetModules();
    const fresh = await import('./localeStore');

    expect(fresh.useLocaleStore.getState().locale).toBe('de');
  });

  it('setLocale() updates the in-memory locale', () => {
    useLocaleStore.getState().setLocale('de');

    expect(useLocaleStore.getState().locale).toBe('de');
  });

  it('persists the locale to localStorage under pep-locale', async () => {
    useLocaleStore.getState().setLocale('de');

    await vi.waitFor(() => {
      const raw = localStorage.getItem('pep-locale');
      expect(raw).not.toBeNull();
      const parsed = JSON.parse(raw as string);
      expect(parsed.state.locale).toBe('de');
    });
  });
});
