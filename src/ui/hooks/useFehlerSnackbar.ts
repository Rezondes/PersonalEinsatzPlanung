import { useCallback, useState } from 'react';

/** Shared error-reporting pattern for views: catch a service-call failure, show it to the user
 * via FehlerSnackbar instead of letting it disappear silently in the console. */
export function useFehlerSnackbar() {
  const [fehler, setFehler] = useState<string | null>(null);

  const melden = useCallback((e: unknown, kontext?: string) => {
    const text = e instanceof Error ? e.message : 'Unbekannter Fehler.';
    setFehler(kontext ? `${kontext}: ${text}` : text);
  }, []);

  const zuruecksetzen = useCallback(() => setFehler(null), []);

  return { fehler, melden, zuruecksetzen };
}
