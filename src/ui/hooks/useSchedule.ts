import type { BranchId } from '@domain/shared/ids';
import type { CalendarWeek } from '@domain/shared/CalendarWeek';
import type { WeeklySchedule } from '@domain/schedule/WeeklySchedule';
import { services } from '@infrastructure/services';
import { useAsyncData } from './useAsyncData';

export function useSchedule(branchId: BranchId | null, cw: CalendarWeek) {
  const { data: schedule, loading, reload, setData: setSchedule } = useAsyncData<WeeklySchedule | null>(
    null,
    () => (branchId ? services.schedule.getOrCreate(branchId, cw) : Promise.resolve(null)),
    // cw.year/cw.week instead of cw itself: CalendarWeek is created as a new object on every
    // render, a reference comparison would re-trigger the effect chain on every render.
    [branchId, cw.year, cw.week],
  );

  return { schedule, loading, reload, setSchedule };
}
