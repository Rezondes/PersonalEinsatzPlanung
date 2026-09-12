/**
 * Path -> document-title mapping for every route AppShell renders (i.e. everywhere except
 * /print/:scheduleId, which lives outside the shell and is a print-only view with no nav chrome of
 * its own - see router.tsx). Kept as a plain lookup rather than attached to router.tsx's own route
 * objects, since react-router's route config has no first-class "title" field to hang this off.
 *
 * Deliberately does not reintroduce a visible on-page heading - those were removed on purpose (see
 * ui/CLAUDE.md). This only ever reaches the browser tab and assistive tech.
 */
const ROUTE_TITLES: Record<string, string> = {
  '/schedule': 'Wochenplanung',
  '/month': 'Monatsübersicht',
  '/employees': 'Mitarbeiter',
  '/absences': 'Abwesenheiten',
  '/branches': 'Filialen',
  '/privacy': 'Datenschutz',
  '/terms': 'Nutzungsbedingungen',
  '/settings': 'Einstellungen',
  '/more': 'Mehr',
};

/** undefined for a path with no entry (e.g. the momentary "/" redirect) rather than a guessed
 * fallback - useDocumentTitle already renders the bare app name for that case. */
export function titleForPath(pathname: string): string | undefined {
  return ROUTE_TITLES[pathname];
}
