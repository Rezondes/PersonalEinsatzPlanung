import type { AbsenceId, EmployeeId } from '@domain/shared/ids';
import type { AbsenceInput } from '@domain/absence/Absence';
import { createAbsence } from '@domain/absence/Absence';
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
  };
}

export type AbsenceService = ReturnType<typeof createAbsenceService>;
