import { create } from 'zustand';

export interface AppNotification {
  id: number;
  severity: 'success' | 'error';
  text: string;
}

/** At most this many wait their turn. Beyond that the oldest QUEUED one is dropped - never the one
 * currently on screen, which the user may be halfway through reading. */
const MAX_QUEUED = 3;

// A counter rather than Date.now(): two notifications raised in the same millisecond would collide,
// and a test can predict this one.
let nextId = 0;

interface NotificationState {
  /** queue[0] is the one on screen. */
  queue: AppNotification[];
  notifySuccess: (text: string) => void;
  notifyError: (text: string) => void;
  /** The shape every view already uses via its onError prop, kept identical so no German string in
   * the app changes: a thrown Error contributes its message, anything else a generic sentence. */
  reportError: (e: unknown, context?: string) => void;
  dismiss: () => void;
  /** Tests only - the store is a module singleton and would otherwise leak between them. */
  clear: () => void;
}

/**
 * The one place feedback after an interaction goes, for the whole app.
 *
 * Before this there were three: an Alert pinned to the top of the Einstellungen page (invisible to
 * anyone scrolled past it, which is everyone, since the buttons that produce it sit further down),
 * an error-only toast four views mounted for themselves, and one inline "Gespeichert" caption. A
 * store rather than a hook because the surface that renders it is mounted once in App.tsx, above
 * the router, so it also covers the print route - and because a view must be able to report an
 * error while it is unmounting.
 *
 * DELIBERATELY no de-duplication. ScheduleView hands every cell write the same context string, so
 * two cells failing from one cause produce byte-identical text; dropping the second would leave a
 * lost write with no feedback at all. Two identical messages is honest, silence is not.
 */
export const useNotificationStore = create<NotificationState>((set) => {
  const push = (severity: AppNotification['severity'], text: string) =>
    set((state) => {
      const next = [...state.queue, { id: nextId++, severity, text }];
      // Trim from index 1: the visible one stays put.
      return { queue: next.length > MAX_QUEUED + 1 ? [next[0], ...next.slice(-MAX_QUEUED)] : next };
    });

  return {
    queue: [],
    notifySuccess: (text) => push('success', text),
    notifyError: (text) => push('error', text),
    reportError: (e, context) => {
      const text = e instanceof Error ? e.message : 'Unbekannter Fehler.';
      push('error', context ? `${context}: ${text}` : text);
    },
    dismiss: () => set((state) => ({ queue: state.queue.slice(1) })),
    clear: () => set({ queue: [] }),
  };
});

/**
 * For call sites outside React, and for the many that just want to fire and forget. Reading
 * getState() at call time rather than at import time keeps them pointing at the live store.
 */
export const notify = {
  success: (text: string) => useNotificationStore.getState().notifySuccess(text),
  error: (text: string) => useNotificationStore.getState().notifyError(text),
  report: (e: unknown, context?: string) => useNotificationStore.getState().reportError(e, context),
};
