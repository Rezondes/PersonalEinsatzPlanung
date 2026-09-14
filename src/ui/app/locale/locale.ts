/**
 * Only German exists today. `Locale` is a union (not a bare string) and `SUPPORTED_LOCALES` the
 * one place that lists what's actually enabled, so adding a language later is a one-line change
 * here plus real translations - nothing else in this module needs to change.
 */
export type Locale = 'de';

export const SUPPORTED_LOCALES: readonly Locale[] = ['de'];

export const DEFAULT_LOCALE: Locale = 'de';

export function isSupportedLocale(value: string | undefined): value is Locale {
  return !!value && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

/** `buildLocalizedPath('de', '/schedule')` -> `/de/schedule`. `path` may be given with or without
 * its own leading slash. */
export function buildLocalizedPath(locale: Locale, path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `/${locale}${normalized}`;
}

/** The inverse of buildLocalizedPath: `stripLocalePrefix('/de/schedule', 'de')` -> `/schedule`.
 * A safe no-op passthrough when `pathname` doesn't actually start with that locale's prefix (e.g.
 * a component rendered in a test with no `/:locale` ancestor) - never throws, never mangles. */
export function stripLocalePrefix(pathname: string, locale: Locale): string {
  const prefix = `/${locale}`;
  if (pathname === prefix) return '/';
  if (pathname.startsWith(`${prefix}/`)) return pathname.slice(prefix.length);
  return pathname;
}
