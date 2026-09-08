import { useCallback, useSyncExternalStore } from 'react';
import { canInstall, subscribeToInstallPrompt } from '@ui/app/installPrompt';

/**
 * Whether the browser is currently offering to install the app. Backed by the module-level capture
 * in app/installPrompt.ts, because the event fires before any component exists.
 */
export function useInstallPrompt(): boolean {
  const getSnapshot = useCallback(() => canInstall(), []);
  return useSyncExternalStore(subscribeToInstallPrompt, getSnapshot, () => false);
}
