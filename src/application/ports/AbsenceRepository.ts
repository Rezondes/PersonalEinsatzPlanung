import type { AbsenceId, EmployeeId } from '@domain/shared/ids';
import type { Absence } from '@domain/absence/Absence';

export interface AbsenceRepository {
  findAll(): Promise<Absence[]>;
  findByEmployee(employeeId: EmployeeId): Promise<Absence[]>;
  findByEmployeeIds(employeeIds: EmployeeId[]): Promise<Absence[]>;
  save(absence: Absence): Promise<void>;
  delete(id: AbsenceId): Promise<void>;
  deleteAll(): Promise<void>;
}
