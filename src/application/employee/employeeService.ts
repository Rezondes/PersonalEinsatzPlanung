import type { BranchId, EmployeeId } from '@domain/shared/ids';
import type { Employee } from '@domain/employee/Employee';
import { createEmployee, compareByLastName } from '@domain/employee/Employee';
import type { EmploymentType } from '@domain/employee/EmploymentType';
import type { EmployeeRepository } from '@application/ports/EmployeeRepository';

export function createEmployeeService(repo: EmployeeRepository) {
  return {
    // Sorted by last name A-Z here (not left to callers) so every view listing employees for a
    // Branch is consistent by construction.
    forBranch: async (branchId: BranchId) => (await repo.findByBranch(branchId)).sort(compareByLastName),

    find: (id: EmployeeId) => repo.findById(id),

    create: async (details: {
      branchId: BranchId;
      lastName: string;
      firstName: string;
      jobTitle: string;
      employmentType: EmploymentType;
      vacationEntitlementPerYear: number;
      birthDate?: string;
    }) => {
      const employee = createEmployee(details);
      await repo.save(employee);
      return employee;
    },

    update: async (employee: Employee) => {
      const updated: Employee = { ...employee, updatedAt: new Date().toISOString() };
      await repo.save(updated);
      return updated;
    },

    /** Soft delete: weekly schedules/absences referencing this employee must stay intact (already
     * worked hours, past absences), so the UI never hard-deletes an employee with any data attached. */
    changeActiveStatus: async (employee: Employee, active: boolean) => {
      const updated: Employee = { ...employee, active, updatedAt: new Date().toISOString() };
      await repo.save(updated);
      return updated;
    },

    delete: (id: EmployeeId) => repo.delete(id),
  };
}

export type EmployeeService = ReturnType<typeof createEmployeeService>;
