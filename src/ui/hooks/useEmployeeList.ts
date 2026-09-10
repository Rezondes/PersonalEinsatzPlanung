import type { BranchId } from '@domain/shared/ids';
import type { Employee } from '@domain/employee/Employee';
import { services } from '@infrastructure/services';
import { useAsyncData } from './useAsyncData';

export function useEmployeeList(branchId: BranchId | null) {
  const { data: employeeList, loading, reload } = useAsyncData<Employee[]>(
    [],
    () => (branchId ? services.employee.forBranch(branchId) : Promise.resolve([])),
    [branchId],
  );

  return { employeeList, loading, reload };
}
