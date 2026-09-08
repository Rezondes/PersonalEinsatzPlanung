import { createBranchService } from '@application/branch/branchService';
import { createEmployeeService } from '@application/employee/employeeService';
import { createScheduleService } from '@application/schedule/scheduleService';
import { createRestPeriodCheckService } from '@application/schedule/restPeriodCheckService';
import { createAbsenceService } from '@application/absence/absenceService';
import { createDataExportService } from '@application/export/dataExportService';
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
  dataExport: createDataExportService({ ...repositories, transaction }),
};
