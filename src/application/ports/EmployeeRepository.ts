import type { BranchId, EmployeeId } from '@domain/shared/ids';
import type { Employee } from '@domain/employee/Employee';

export interface EmployeeRepository {
  findAll(): Promise<Employee[]>;
  findByBranch(branchId: BranchId): Promise<Employee[]>;
  findById(id: EmployeeId): Promise<Employee | null>;
  save(employee: Employee): Promise<void>;
  delete(id: EmployeeId): Promise<void>;
  deleteAll(): Promise<void>;
}
