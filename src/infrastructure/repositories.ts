import { DexieBranchRepository } from './persistence/DexieBranchRepository';
import { DexieEmployeeRepository } from './persistence/DexieEmployeeRepository';
import { DexieWeeklyScheduleRepository } from './persistence/DexieWeeklyScheduleRepository';
import { DexieAbsenceRepository } from './persistence/DexieAbsenceRepository';

/**
 * Simple manual composition (no DI framework needed): the application layer only knows the
 * port interfaces; the UI layer gets the concrete implementations from here.
 */
export const repositories = {
  branch: new DexieBranchRepository(),
  employee: new DexieEmployeeRepository(),
  weeklySchedule: new DexieWeeklyScheduleRepository(),
  absence: new DexieAbsenceRepository(),
};
