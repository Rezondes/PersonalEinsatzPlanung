import type { Branch } from '@domain/branch/Branch';
import type { Employee } from '@domain/employee/Employee';
import type { WeeklySchedule } from '@domain/schedule/WeeklySchedule';
import type { Absence } from '@domain/absence/Absence';

export const CURRENT_FORMAT_VERSION = 2 as const;

export interface PepExportFile {
  formatVersion: typeof CURRENT_FORMAT_VERSION;
  exportedAt: string;
  data: {
    branches: Branch[];
    employees: Employee[];
    weeklySchedules: WeeklySchedule[];
    absences: Absence[];
  };
}
