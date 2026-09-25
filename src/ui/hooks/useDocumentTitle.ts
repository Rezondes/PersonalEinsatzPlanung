import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Sets the browser tab's title (and with it, what a screen reader announces on route change) to
 * `${title} - Personaleinsatzplanung`, or the bare app name when no title is given. Generic and
 * route-agnostic on purpose - the current route's title is looked up separately (routeMeta.ts) and
 * passed in by AppShell, the one place this is mounted.
 */
export function useDocumentTitle(title: string | undefined): void {
  const { t } = useTranslation('app');
  const appName = t('appName');
  useEffect(() => {
    document.title = title ? `${title} - ${appName}` : appName;
  }, [title, appName]);
}
