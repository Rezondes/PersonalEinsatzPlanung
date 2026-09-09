import { useEffect, useRef } from 'react';

/**
 * MODULE-level, deliberately not a ref: the race this guards against isn't limited to one
 * component instance re-mounting (StrictMode's synchronous double-invoke of the same hook call) -
 * it also happens across two genuinely different mounts close together in time (the same dialog
 * closed and immediately reopened; two different ResponsiveDialogs in quick succession; two
 * separate test cases sharing one jsdom `window` with real, un-mocked timers). In every one of
 * those, a still-pending deferred `history.back()` from whoever closed last must be cancelled by
 * whoever opens next, or its eventual `popstate` fires against the NEW listener instead of the one
 * that scheduled it. A module-level singleton is safe here because the app only ever shows one
 * back-dismissible full-screen sheet at a time (ConfirmDialog, which can stack on top, does not use
 * this hook).
 */
let pendingStaleEntryCancel: (() => void) | null = null;

/**
 * Makes a full-screen sheet close on the mobile back gesture / hardware back button, instead of
 * falling through to page navigation - matches "the app behaves like an app" (this is an
 * installable PWA, see the `feat(pwa)` commit). Pushes one history entry while the sheet is open
 * and listens for `popstate` (the back gesture) to call `onClose`.
 *
 * Verified safe against `createHashRouter` (app/router.tsx): the pushed entry is a synthetic
 * re-push of the CURRENT location (same hash, no new route), so React Router's own history
 * listener sees a location it already has and does not re-render the route tree - only this
 * hook's own `popstate` listener reacts to the resulting back navigation.
 *
 * The stale-entry cleanup (closed by Abbrechen/Speichern/backdrop, not the back gesture) is
 * DEFERRED and CANCELLABLE, not an immediate `history.back()` - `history.back()` is asynchronous,
 * so an immediate call in one instance's cleanup could still be pending when the NEXT open (by
 * this same hook, anywhere) attaches its own `popstate` listener moments later, and the resulting
 * navigation would fire against that new listener instead - closing a sheet that had just (really)
 * opened. See `pendingStaleEntryCancel` above for why the cancellation has to be shared, not local
 * to one component instance.
 */
export function useDismissOnBack(open: boolean, onClose: () => void): void {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;

    // Whoever closed most recently (if their deferred cleanup below hasn't fired yet) must not
    // consume THIS entry - we're about to push a fresh one of our own.
    pendingStaleEntryCancel?.();
    pendingStaleEntryCancel = null;

    window.history.pushState({ pepDismissOnBack: true }, '');
    let consumedByBackGesture = false;

    const onPopState = () => {
      consumedByBackGesture = true;
      onCloseRef.current();
    };
    window.addEventListener('popstate', onPopState);

    return () => {
      window.removeEventListener('popstate', onPopState);
      // The back gesture already popped this entry itself - nothing left to consume.
      if (consumedByBackGesture) return;

      const timer = setTimeout(() => {
        pendingStaleEntryCancel = null;
        window.history.back();
      }, 0);
      pendingStaleEntryCancel = () => clearTimeout(timer);
    };
  }, [open]);
}
