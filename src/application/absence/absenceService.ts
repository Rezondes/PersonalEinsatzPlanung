import type { AbsenceId, EmployeeId } from '@domain/shared/ids';
import type { AbsenceInput } from '@domain/absence/Absence';
import { createAbsence } from '@domain/absence/Absence';
import { countVacationDaysInYear, calculateRemainingVacation } from '@domain/absence/vacationCalculation';
import type { Employee } from '@domain/employee/Employee';
import type { AbsenceRepository } from '@application/ports/AbsenceRepository';

export function createAbsenceService(repo: AbsenceRepository) {
  return {
    forEmployee: (employeeId: EmployeeId) => repo.findByEmployee(employeeId),

    forBranch: (employeeIds: EmployeeId[]) => repo.findByBranch(employeeIds),

    create: async (details: AbsenceInput) => {
      const absence = createAbsence(details);
      await repo.save(absence);
      return absence;
    },

    delete: (id: AbsenceId) => repo.delete(id),

    calculateRemainingVacation: async (
      employee: Employee,
      year: number,
      isHoliday?: (isoDate: string) => boolean,
    ): Promise<number> => {
      const absences = await repo.findByEmployee(employee.id);
      const daysTaken = countVacationDaysInYear(absences, year, isHoliday);
      return calculateRemainingVacation(employee, daysTaken);
    },
  };
}

export type AbsenceService = ReturnType<typeof createAbsenceService>;
