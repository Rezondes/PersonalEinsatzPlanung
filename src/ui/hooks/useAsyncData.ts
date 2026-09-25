import { useCallback, useEffect, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { notify } from '@ui/app/store/notificationStore';
import i18n from '@ui/i18n/i18n';

/** Shared shape behind every selection-scoped data-loading hook (useSchedule, useEmployeeList,
 * useShiftTemplates, useAbsences): state + a loading flag + a reload callback, guarded against a
 * stale response landing after a newer one already resolved - e.g. switching the selected Filiale
 * or week faster than a round trip completes. useSchedule was the only one of the four hooks that
 * originally had this guard (`loadIdRef`, added alongside undo/redo - see its own history); lifted
 * out here so all four share it instead of the other three silently missing the same fix.
 *
 * `load` must return the "empty" value itself when its own precondition fails (e.g. no branch
 * selected yet) - this hook has no selection-specific knowledge. `deps` is the dependency array
 * `load` closes over; like the hooks this replaces, it is passed straight into `useCallback`
 * without static analysis, so exhaustive-deps needs the same disable-comment at each call site. */
export function useAsyncData<T>(
  initial: T,
  load: () => Promise<T>,
  deps: readonly unknown[],
): {
  data: T;
  loading: boolean;
  /** The last load's failure, or null. Lets a view show "could not load" instead of its empty
   * state - `data` stays at `initial` on failure and is indistinguishable from "nothing there". */
  error: unknown;
  reload: () => Promise<void>;
  setData: Dispatch<SetStateAction<T>>;
} {
  const [data, setData] = useState<T>(initial);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const loadIdRef = useRef(0);

  const reload = useCallback(async () => {
    const loadId = loadIdRef.current + 1;
    loadIdRef.current = loadId;
    setLoading(true);
    try {
      const loaded = await load();
      if (loadIdRef.current !== loadId) {
        return;
      }
      setData(loaded);
      setError(null);
    } catch (failure) {
      if (loadIdRef.current !== loadId) {
        return;
      }
      setError(failure);
      notify.report(failure, i18n.t('loadFailed'));
    } finally {
      if (loadIdRef.current === loadId) {
        setLoading(false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    reload();
  }, [reload]);

  return { data, loading, error, reload, setData };
}
