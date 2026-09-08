import { useEffect } from 'react';
import { SELECTABLE_SELECTOR } from '@ui/app/selectableText';

/**
 * Takes the browser's own context menu away everywhere except where text is released for
 * selection (see app/selectableText.ts) - so the app stops announcing on every right-click that
 * it is a web page.
 *
 * Called from App.tsx, not from AppShell: the print route at /print/:scheduleId is a top-level
 * route outside the shell, and the rule is meant to hold everywhere.
 *
 * THREE THINGS HERE ARE LOAD-BEARING. The Wochenplanung has its own document-level contextmenu
 * listener (views/schedule/ScheduleView.tsx) that builds the Kopieren/Einfuegen/Frei menu, and
 * this one must coexist with it:
 *
 * 1. No stopPropagation, no stopImmediatePropagation. preventDefault() alone suppresses the native
 *    menu and leaves other listeners running, which is exactly what we want. Nearly every
 *    "disable right click" snippet on the web calls stopImmediatePropagation() - here that would
 *    destroy the schedule's own menu, and only sometimes, because the two listeners' registration
 *    order changes at runtime (ScheduleView re-registers whenever its rows change).
 * 2. No `return false` either: that only works when assigning to oncontextmenu, never with
 *    addEventListener.
 * 3. e.target, not document.elementsFromPoint: while a MUI menu is open its backdrop is the
 *    topmost element, and the two approaches disagree about what was clicked. `closest` is guarded
 *    with ?. because in jsdom an event dispatched on document has document as its target, which
 *    has no closest().
 */
export function useSuppressBrowserContextMenu(): void {
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Element | null;
      if (target?.closest?.(SELECTABLE_SELECTOR)) {
        return;
      }
      e.preventDefault();
    };
    document.addEventListener('contextmenu', handler);
    return () => document.removeEventListener('contextmenu', handler);
  }, []);
}
