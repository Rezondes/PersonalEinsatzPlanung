import type { AbsenceId, EmployeeId } from '@domain/shared/ids';
import type { Absence, AbsenceInput } from '@domain/absence/Absence';
import { createAbsence } from '@domain/absence/Absence';
import type { AbsenceRepository } from '@application/ports/AbsenceRepository';

export function createAbsenceService(repo: AbsenceRepository) {
  return {
    forEmployee: (employeeId: EmployeeId) => repo.findByEmployee(employeeId),

    forEmployees: (employeeIds: EmployeeId[]) => repo.findByEmployeeIds(employeeIds),

    create: async (details: AbsenceInput) => {
      const absence = createAbsence(details);
      await repo.save(absence);
      return absence;
    },

    /** Writes an absence back exactly as it was, keeping its id and createdAt - deliberately past
     * createAbsence, the same way the JSON import bypasses the create* factories (see
     * dataExportService). Used only by the Wochenplanung's undo/redo: re-creating instead would
     * mint a new id, and the next undo/redo step would then target an id that no longer exists. */
    restore: (absence: Absence) => repo.save(absence),

    delete: (id: AbsenceId) => repo.delete(id),
  };
}

export type AbsenceService = ReturnType<typeof createAbsenceService>;
