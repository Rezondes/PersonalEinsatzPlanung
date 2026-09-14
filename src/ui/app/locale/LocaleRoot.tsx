import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import i18n from '@ui/i18n/i18n';
import { useLocaleStore } from './localeStore';
import { useLocale } from './useLocale';

/**
 * `element` for the `/:locale` route - sits above both AppShell and the print route (see
 * router.tsx), so both get the same sync. Mirrors the URL's already-validated locale into the
 * persisted store and `<html lang>`, then renders whichever child matched.
 */
export function LocaleRoot() {
  const locale = useLocale();

  useEffect(() => {
    useLocaleStore.getState().setLocale(locale);
    document.documentElement.lang = locale;
    void i18n.changeLanguage(locale);
  }, [locale]);

  return <Outlet />;
}
