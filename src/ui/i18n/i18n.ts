import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { DEFAULT_LOCALE } from '@ui/app/locale/locale';
import common from './resources/de/common';
import nav from './resources/de/nav';
import absences from './resources/de/absences';
import app from './resources/de/app';
import changelog from './resources/de/changelog';
import privacy from './resources/de/privacy';
import terms from './resources/de/terms';
import settings from './resources/de/settings';

/**
 * The one i18next instance for the whole app - imported for its side effect by both main.tsx
 * (before <App/> renders) and testSetup.ts (before any test renders), so there is exactly one
 * place that ever defines what German resources exist, and tests exercise the same real
 * translations the app ships, never a mocked t: key => key passthrough.
 *
 * Resources are statically imported, never fetched at runtime - required for this app's fully
 * offline PWA guarantee (see ui/CLAUDE.md). No i18next-http-backend, ever.
 *
 * Language is NEVER auto-detected (no i18next-browser-languagedetector): app/locale/'s
 * useLocale()/localeLoader is the only source of truth, and LocaleRoot.tsx calls
 * i18n.changeLanguage() to keep this instance in sync with the URL. `lng` below only covers the
 * brief window before that effect first runs (or a component/test with no :locale ancestor).
 *
 * No <I18nextProvider> needed anywhere: this initializes i18next's own default exported instance
 * (not i18next.createInstance()), so useTranslation() anywhere in the tree already resolves to it.
 */
void i18n.use(initReactI18next).init({
  resources: { [DEFAULT_LOCALE]: { common, nav, absences, app, changelog, privacy, terms, settings } },
  lng: DEFAULT_LOCALE,
  fallbackLng: DEFAULT_LOCALE,
  ns: ['common', 'nav', 'absences', 'app', 'changelog', 'privacy', 'terms', 'settings'],
  defaultNS: 'common',
  // React already escapes interpolated values; i18next's own HTML-escaping on top would
  // double-escape (e.g. a literal "&" becomes "&amp;amp;"). Standard react-i18next guidance.
  interpolation: { escapeValue: false },
  debug: import.meta.env.DEV,
  // Resources are 100% bundled/synchronous (no backend, no detector), so init() resolves in this
  // tick regardless - the side-effect import below still guarantees a fully ready instance before
  // the first render/test. No Suspense boundary needed anywhere in the tree.
  react: { useSuspense: false },
});

export default i18n;
