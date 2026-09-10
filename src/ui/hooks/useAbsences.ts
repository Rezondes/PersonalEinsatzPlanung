import type { EmployeeId } from '@domain/shared/ids';
import type { Absence } from '@domain/absence/Absence';
import { services } from '@infrastructure/services';
import { useAsyncData } from './useAsyncData';

export function useAbsences(employeeIds: EmployeeId[]) {
  const idsKey = employeeIds.join(',');
  const { data: absences, loading, reload } = useAsyncData<Absence[]>(
    [],
    () => (employeeIds.length === 0 ? Promise.resolve([]) : services.absence.forBranch(employeeIds)),
    // idsKey instead of employeeIds itself: a new array reference every render would re-trigger
    // the effect chain on every render even when the actual ids haven't changed.
    [idsKey],
  );

  return { absences, loading, reload };
}
