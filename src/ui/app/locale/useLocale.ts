import { useParams } from 'react-router-dom';
import type { Locale } from './locale';
import { DEFAULT_LOCALE, isSupportedLocale } from './locale';

/**
 * The current locale, read from the `:locale` route param - already validated by `localeLoader`
 * by the time anything under `/:locale` renders, so this is the render-time source of truth.
 * Falls back to DEFAULT_LOCALE for anything rendered outside that route (e.g. a component mounted
 * directly in a test with no `/:locale` ancestor), never throws.
 */
export function useLocale(): Locale {
  const { locale } = useParams<{ locale: string }>();
  return isSupportedLocale(locale) ? locale : DEFAULT_LOCALE;
}
