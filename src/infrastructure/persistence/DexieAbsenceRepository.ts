import type { AbsenceId, EmployeeId } from '@domain/shared/ids';
import type { Absence } from '@domain/absence/Absence';
import type { AbsenceRepository } from '@application/ports/AbsenceRepository';
import { db } from './db';

export class DexieAbsenceRepository implements AbsenceRepository {
  async findAll(): Promise<Absence[]> {
    return db.absences.toArray();
  }

  async findByEmployee(employeeId: EmployeeId): Promise<Absence[]> {
    return db.absences.where('employeeId').equals(employeeId).toArray();
  }

  async findByBranch(employeeIds: EmployeeId[]): Promise<Absence[]> {
    if (employeeIds.length === 0) {
      return [];
    }
    return db.absences.where('employeeId').anyOf(employeeIds).toArray();
  }

  async save(absence: Absence): Promise<void> {
    await db.absences.put(absence);
  }

  async delete(id: AbsenceId): Promise<void> {
    await db.absences.delete(id);
  }

  async deleteAll(): Promise<void> {
    await db.absences.clear();
  }
}
