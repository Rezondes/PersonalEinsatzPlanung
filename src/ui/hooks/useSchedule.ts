import { useCallback, useEffect, useRef, useState } from 'react';
import type { BranchId } from '@domain/shared/ids';
import type { CalendarWeek } from '@domain/shared/CalendarWeek';
import type { WeeklySchedule } from '@domain/schedule/WeeklySchedule';
import { services } from '@infrastructure/services';

export function useSchedule(branchId: BranchId | null, cw: CalendarWeek) {
  const [schedule, setSchedule] = useState<WeeklySchedule | null>(null);
  const [loading, setLoading] = useState(true);
  // Incremented on every load; a response whose id no longer matches belongs to a week the user has
  // already navigated away from and is dropped. Without this, clicking quickly through weeks can
  // land an older getOrCreate after a newer one and leave the view showing another week's schedule -
  // which the undo history would then attach its steps to.
  const loadIdRef = useRef(0);

  const reload = useCallback(async () => {
    const loadId = loadIdRef.current + 1;
    loadIdRef.current = loadId;

    if (!branchId) {
      setSchedule(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const loaded = await services.schedule.getOrCreate(branchId, cw);
    if (loadIdRef.current !== loadId) {
      return;
    }
    setSchedule(loaded);
    setLoading(false);
    // cw.year/cw.week instead of cw itself: CalendarWeek is created as a new object on every render,
    // a reference comparison would re-trigger the effect chain on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId, cw.year, cw.week]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { schedule, loading, reload, setSchedule };
}
