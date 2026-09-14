import { describe, it, expect } from 'vitest';
import { isSupportedLocale, buildLocalizedPath, stripLocalePrefix } from './locale';

describe('isSupportedLocale', () => {
  it('returns true for a supported locale', () => {
    expect(isSupportedLocale('de')).toBe(true);
  });

  it('returns false for an unsupported locale', () => {
    expect(isSupportedLocale('en')).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isSupportedLocale(undefined)).toBe(false);
  });

  it('returns false for an empty string', () => {
    expect(isSupportedLocale('')).toBe(false);
  });
});

describe('buildLocalizedPath', () => {
  it('prefixes a path that already starts with a slash', () => {
    expect(buildLocalizedPath('de', '/schedule')).toBe('/de/schedule');
  });

  it('prefixes a path with no leading slash', () => {
    expect(buildLocalizedPath('de', 'schedule')).toBe('/de/schedule');
  });

  it('handles the bare root path', () => {
    expect(buildLocalizedPath('de', '/')).toBe('/de/');
  });
});

describe('stripLocalePrefix', () => {
  it('strips a matching locale prefix followed by a path', () => {
    expect(stripLocalePrefix('/de/schedule', 'de')).toBe('/schedule');
  });

  it('reduces the bare locale root to a single slash', () => {
    expect(stripLocalePrefix('/de', 'de')).toBe('/');
  });

  it('is a no-op on a path that is already bare (no locale prefix)', () => {
    expect(stripLocalePrefix('/schedule', 'de')).toBe('/schedule');
  });

  it('is a no-op on the bare root', () => {
    expect(stripLocalePrefix('/', 'de')).toBe('/');
  });

  it('does not strip a different locale it was not asked to strip', () => {
    expect(stripLocalePrefix('/en/schedule', 'de')).toBe('/en/schedule');
  });
});
