import { useCallback, useState } from 'react';

/** Shared error-reporting pattern for views: catch a service-call failure, show it to the user
 * via ErrorSnackbar instead of letting it disappear silently in the console. */
export function useErrorSnackbar() {
  const [error, setError] = useState<string | null>(null);

  const report = useCallback((e: unknown, context?: string) => {
    const text = e instanceof Error ? e.message : 'Unbekannter Fehler.';
    setError(context ? `${context}: ${text}` : text);
  }, []);

  const reset = useCallback(() => setError(null), []);

  return { error, report, reset };
}
