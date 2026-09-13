import type { BranchId, EmployeeId } from '@domain/shared/ids';
import type { Employee } from '@domain/employee/Employee';
import type { EmployeeRepository } from '@application/ports/EmployeeRepository';
import { DexieCrudRepository } from './DexieCrudRepository';
import { db } from './db';

export class DexieEmployeeRepository extends DexieCrudRepository<Employee, EmployeeId> implements EmployeeRepository {
  constructor() {
    super(db.employees);
  }

  async findByBranch(branchId: BranchId): Promise<Employee[]> {
    return db.employees.where('branchId').equals(branchId).toArray();
  }
}
