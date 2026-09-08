import type { BranchRepository } from '@application/ports/BranchRepository';
import type { EmployeeRepository } from '@application/ports/EmployeeRepository';
import type { WeeklyScheduleRepository } from '@application/ports/WeeklyScheduleRepository';
import type { AbsenceRepository } from '@application/ports/AbsenceRepository';
import type { PepExportFile } from './jsonExportFormat';
import { CURRENT_FORMAT_VERSION } from './jsonExportFormat';
import { migrateToCurrentVersion } from './jsonMigrations';

export interface DataRepositories {
  branch: BranchRepository;
  employee: EmployeeRepository;
  weeklySchedule: WeeklyScheduleRepository;
  absence: AbsenceRepository;
  /** Runs a block of repository calls atomically (all-or-nothing). Needed so a full-dataset
   * replace (import) can never fail halfway through and leave some stores cleared, others not. */
  transaction: <T>(fn: () => Promise<T>) => Promise<T>;
}

/**
 * Main persistence mechanism for backup & device migration, since the app has no server: exports the
 * complete local dataset as a JSON file and re-imports such a file.
 */
export function createDataExportService(repos: DataRepositories) {
  return {
    export: async (): Promise<PepExportFile> => {
      const [branches, employees, weeklySchedules, absences] = await Promise.all([
        repos.branch.findAll(),
        repos.employee.findAll(),
        repos.weeklySchedule.findAll(),
        repos.absence.findAll(),
      ]);

      return {
        formatVersion: CURRENT_FORMAT_VERSION,
        exportedAt: new Date().toISOString(),
        data: { branches, employees, weeklySchedules, absences },
      };
    },

    /** Replaces the complete local dataset with the content of the import file (main scenario:
     * device/browser migration). Existing data is deleted first. */
    importAndReplace: async (rawData: unknown): Promise<void> => {
      const file = migrateToCurrentVersion(rawData);

      await repos.transaction(async () => {
        await Promise.all([
          repos.branch.deleteAll(),
          repos.employee.deleteAll(),
          repos.weeklySchedule.deleteAll(),
          repos.absence.deleteAll(),
        ]);

        await Promise.all([
          ...file.data.branches.map((b) => repos.branch.save(b)),
          ...file.data.employees.map((e) => repos.employee.save(e)),
          ...file.data.weeklySchedules.map((w) => repos.weeklySchedule.save(w)),
          ...file.data.absences.map((a) => repos.absence.save(a)),
        ]);
      });
    },

    deleteAllData: async (): Promise<void> => {
      await Promise.all([
        repos.branch.deleteAll(),
        repos.employee.deleteAll(),
        repos.weeklySchedule.deleteAll(),
        repos.absence.deleteAll(),
      ]);
    },
  };
}

export type DataExportService = ReturnType<typeof createDataExportService>;
