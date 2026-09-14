import type { NavKey } from '@ui/i18n/resources/de/nav';

/**
 * Path -> nav translation key mapping for every route AppShell renders (i.e. everywhere except
 * /print/:scheduleId, which lives outside the shell and is a print-only view with no nav chrome of
 * its own - see router.tsx). Kept as a plain lookup rather than attached to router.tsx's own route
 * objects, since react-router's route config has no first-class "title" field to hang this off.
 * Reuses the `nav` namespace's own keys rather than a separate set of strings - these are the exact
 * same 10 destinations navItems.ts already names, so a second copy would just be one more place a
 * rename could silently drift out of sync.
 *
 * Deliberately does not reintroduce a visible on-page heading - those were removed on purpose (see
 * ui/CLAUDE.md). This only ever reaches the browser tab and assistive tech.
 */
const ROUTE_TITLES: Record<string, NavKey> = {
  '/schedule': 'schedule',
  '/month': 'month',
  '/employees': 'employees',
  '/absences': 'absences',
  '/branches': 'branches',
  '/changelog': 'changelog',
  '/privacy': 'privacy',
  '/terms': 'terms',
  '/settings': 'settings',
  '/more': 'more',
};

/** undefined for a path with no entry (e.g. the momentary "/" redirect) rather than a guessed
 * fallback - useDocumentTitle already renders the bare app name for that case. The caller
 * translates the returned key via t(..., { ns: 'nav' }) - this module has no React context of its
 * own to call useTranslation() from. */
export function titleForPath(pathname: string): NavKey | undefined {
  return ROUTE_TITLES[pathname];
}
