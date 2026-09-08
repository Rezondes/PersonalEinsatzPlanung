import { useCallback, useSyncExternalStore } from 'react';

function subscribe(onChange: () => void): () => void {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
}

/**
 * Whether the device currently has a network connection.
 *
 * Used ONLY by the Google Drive section, which is the only part of the app that needs the network.
 * Deliberately no app-wide offline banner: navigator.onLine is true whenever any interface is up,
 * including a shop's wifi with a dead uplink, so it would be wrong exactly when it mattered - and
 * a permanent "you are offline" chip reads to a non-technical user as "my data might be gone",
 * which is the opposite of the truth here.
 */
export function useOnlineStatus(): boolean {
  const getSnapshot = useCallback(() => navigator.onLine, []);
  // The server snapshot never runs in this app (no SSR); assume online so nothing renders as
  // disabled during the very first paint.
  return useSyncExternalStore(subscribe, getSnapshot, () => true);
}
