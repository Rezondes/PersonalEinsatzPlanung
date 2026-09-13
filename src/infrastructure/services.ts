import { createBranchService } from '@application/branch/branchService';
import { createEmployeeService } from '@application/employee/employeeService';
import { createScheduleService } from '@application/schedule/scheduleService';
import { createRestPeriodCheckService } from '@application/schedule/restPeriodCheckService';
import { createAbsenceService } from '@application/absence/absenceService';
import { createHolidayBulkCreationService } from '@application/absence/holidayBulkCreation';
import { createShiftTemplateService } from '@application/schedule/shiftTemplateService';
import { createDataExportService } from '@application/export/dataExportService';
import { GoogleDriveBackupStorage } from './backup/GoogleDriveBackupStorage';
import { fetchChangelog } from './changelog/githubReleases';
import { repositories } from './repositories';
import { transaction } from './persistence/db';

/** Composition of the application services with the concrete repository implementations - the only
 * place where application/* and infrastructure/* are wired together. The UI layer imports
 * exclusively from here, never a Dexie repository class directly. */
export const services = {
  branch: createBranchService(repositories.branch),
  employee: createEmployeeService(repositories.employee),
  schedule: createScheduleService(repositories.weeklySchedule, repositories.employee),
  restPeriodCheck: createRestPeriodCheckService(repositories.weeklySchedule),
  absence: createAbsenceService(repositories.absence),
  holidayBulkCreation: createHolidayBulkCreationService(repositories.absence),
  shiftTemplate: createShiftTemplateService(repositories.shiftTemplate),
  dataExport: createDataExportService({ ...repositories, transaction }),
  // Optional remote destination for the backup, next to the local file download.
  backupStorage: new GoogleDriveBackupStorage(),
  // Reads the project's own public GitHub Releases as the in-app changelog - see
  // infrastructure/changelog/githubReleases.ts for why this is a deliberate exception to "no
  // outbound requests".
  changelog: { fetchChangelog },
};
