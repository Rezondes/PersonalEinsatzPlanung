import type { AbsenceId, EmployeeId } from '@domain/shared/ids';
import type { Absence } from '@domain/absence/Absence';
import type { AbsenceRepository } from '@application/ports/AbsenceRepository';
import { DexieCrudRepository } from './DexieCrudRepository';
import { db } from './db';

export class DexieAbsenceRepository extends DexieCrudRepository<Absence, AbsenceId> implements AbsenceRepository {
  constructor() {
    super(db.absences);
  }

  async findByEmployee(employeeId: EmployeeId): Promise<Absence[]> {
    return db.absences.where('employeeId').equals(employeeId).toArray();
  }

  async findByEmployeeIds(employeeIds: EmployeeId[]): Promise<Absence[]> {
    if (employeeIds.length === 0) {
      return [];
    }
    return db.absences.where('employeeId').anyOf(employeeIds).toArray();
  }
}
