import type { BranchId, EmployeeId } from '@domain/shared/ids';
import type { Employee } from '@domain/employee/Employee';
import type { EmployeeRepository } from '@application/ports/EmployeeRepository';
import { db } from './db';

export class DexieEmployeeRepository implements EmployeeRepository {
  async findAll(): Promise<Employee[]> {
    return db.employees.toArray();
  }

  async findByBranch(branchId: BranchId): Promise<Employee[]> {
    return db.employees.where('branchId').equals(branchId).toArray();
  }

  async findById(id: EmployeeId): Promise<Employee | null> {
    return (await db.employees.get(id)) ?? null;
  }

  async save(employee: Employee): Promise<void> {
    await db.employees.put(employee);
  }

  async delete(id: EmployeeId): Promise<void> {
    await db.employees.delete(id);
  }

  async deleteAll(): Promise<void> {
    await db.employees.clear();
  }
}
