import { useCallback, useEffect, useState } from 'react';
import type { EmployeeId } from '@domain/shared/ids';
import type { Absence } from '@domain/absence/Absence';
import { services } from '@infrastructure/services';

export function useAbsences(employeeIds: EmployeeId[]) {
  const [absences, setAbsences] = useState<Absence[]>([]);
  const [loading, setLoading] = useState(true);
  const idsKey = employeeIds.join(',');

  const reload = useCallback(async () => {
    if (employeeIds.length === 0) {
      setAbsences([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const list = await services.absence.forBranch(employeeIds);
    setAbsences(list);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { absences, loading, reload };
}
