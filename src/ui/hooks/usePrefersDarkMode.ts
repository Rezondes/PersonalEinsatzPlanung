import { useCallback, useSyncExternalStore } from 'react';

const QUERY = '(prefers-color-scheme: dark)';

function subscribe(onChange: () => void): () => void {
  const mql = window.matchMedia(QUERY);
  mql.addEventListener('change', onChange);
  return () => mql.removeEventListener('change', onChange);
}

/**
 * Whether the OS is currently set to dark mode - feeds the theme factory's 'system' option. Only
 * consulted while the user has explicitly chosen 'System' in Einstellungen (see themeModeStore);
 * this hook itself has no opinion on whether that choice is active.
 */
export function usePrefersDarkMode(): boolean {
  const getSnapshot = useCallback(() => window.matchMedia(QUERY).matches, []);
  // The server snapshot never runs in this app (no SSR); assume light so nothing renders as dark
  // during the very first paint if this were ever called before hydration.
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
