import { useCallback, useEffect, useState } from 'react';
import type { BranchId } from '@domain/shared/ids';
import type { Employee } from '@domain/employee/Employee';
import { services } from '@infrastructure/services';

export function useEmployeeList(branchId: BranchId | null) {
  const [employeeList, setEmployeeList] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!branchId) {
      setEmployeeList([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const list = await services.employee.forBranch(branchId);
    setEmployeeList(list);
    setLoading(false);
  }, [branchId]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { employeeList, loading, reload };
}
