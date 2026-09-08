import { useCallback, useEffect, useState } from 'react';
import type { BranchId } from '@domain/shared/ids';
import type { CalendarWeek } from '@domain/shared/CalendarWeek';
import type { WeeklySchedule } from '@domain/schedule/WeeklySchedule';
import { services } from '@infrastructure/services';

export function useSchedule(branchId: BranchId | null, cw: CalendarWeek) {
  const [schedule, setSchedule] = useState<WeeklySchedule | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!branchId) {
      setSchedule(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const loaded = await services.schedule.getOrCreate(branchId, cw);
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
