import type { BranchId, EmployeeId } from '@domain/shared/ids';
import { createId } from '@domain/shared/ids';
import type { EmploymentType } from './EmploymentType';
import { assertNoFieldErrors } from '@domain/shared/DomainError';
import { validateEmployee } from './employeeValidation';

export interface Employee {
  id: EmployeeId;
  branchId: BranchId;
  lastName: string;
  firstName: string;
  /** Free text, e.g. "Verkäufer/-in Lebensmittel" (suggestion list in jobTitleSuggestions.ts). */
  jobTitle: string;
  employmentType: EmploymentType;
  vacationEntitlementPerYear: number;
  /** Hours credited to this employee for one full holiday/vacation day. Counts towards the
   * employee's own weekly actual hours but never towards a branch total (nobody was in the store),
   * see application/schedule/scheduleAssessment.ts. */
  holidayVacationHours: number;
  /** Optional, only relevant for the youth-labor-protection check (data minimization: only collect when needed). */
  birthDate?: string;
  /** Optional ISO date ("YYYY-MM-DD"). Before it, the employee cannot be scheduled (see isEmployedOn). */
  entryDate?: string;
  /** Optional ISO date ("YYYY-MM-DD"). After it, the employee cannot be scheduled (see isEmployedOn). */
  exitDate?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export function createEmployee(details: {
  branchId: BranchId;
  lastName: string;
  firstName: string;
  jobTitle: string;
  employmentType: EmploymentType;
  vacationEntitlementPerYear: number;
  holidayVacationHours: number;
  birthDate?: string;
  entryDate?: string;
  exitDate?: string;
}): Employee {
  // Field rules live in employeeValidation.ts; enforced here too so no service or import path can
  // create an employee the dialog would refuse. Updates are deliberately not re-validated.
  assertNoFieldErrors(validateEmployee(details));
  const now = new Date().toISOString();
  return {
    id: createId<EmployeeId>(),
    branchId: details.branchId,
    lastName: details.lastName,
    firstName: details.firstName,
    jobTitle: details.jobTitle,
    employmentType: details.employmentType,
    vacationEntitlementPerYear: details.vacationEntitlementPerYear,
    holidayVacationHours: details.holidayVacationHours,
    birthDate: details.birthDate,
    entryDate: details.entryDate,
    exitDate: details.exitDate,
    active: true,
    createdAt: now,
    updatedAt: now,
  };
}

export function fullName(employee: Pick<Employee, 'lastName' | 'firstName'>): string {
  return `${employee.lastName}, ${employee.firstName}`;
}

type EmploymentPeriod = Pick<Employee, 'entryDate' | 'exitDate'>;

/** Whether the employee may be scheduled on that ISO date. Both bounds are inclusive and optional -
 * an employee without dates is employable forever, which is what every record created before these
 * fields existed looks like. Plain string comparison is correct for ISO dates (same reasoning as
 * absenceValidation.ts and scheduleAssessment.findAbsenceForDay). */
export function isEmployedOn(employee: EmploymentPeriod, isoDate: string): boolean {
  if (employee.entryDate && isoDate < employee.entryDate) {
    return false;
  }
  return !(employee.exitDate && isoDate > employee.exitDate);
}

/** Whether the employment period overlaps the inclusive range at all, i.e. whether there is at
 * least one day in [fromISO, toISO] the employee may be scheduled on. */
export function isEmployedDuring(employee: EmploymentPeriod, fromISO: string, toISO: string): boolean {
  if (employee.entryDate && employee.entryDate > toISO) {
    return false;
  }
  return !(employee.exitDate && employee.exitDate < fromISO);
}

/** Whether the employee may be scheduled at all in this range: active AND their employment period
 * overlaps it. The single shared definition of "plannable" - scheduleService.ts,
 * printDataPreparation.ts and ui/views/schedule/scheduleRows.ts each used to reimplement this
 * exact `active && isEmployedDuring(...)` check independently, a drift risk if the definition
 * ever grows a third condition. */
export function isPlannable(employee: Pick<Employee, 'active' | 'entryDate' | 'exitDate'>, fromISO: string, toISO: string): boolean {
  return employee.active && isEmployedDuring(employee, fromISO, toISO);
}

/** Sorts by last name A-Z (first name as tiebreaker), German collation (so e.g. umlauts sort
 * correctly). Single source of truth for the "employees always sorted by last name" rule - used
 * for master data, monthly overview, absences, the weekly schedule table, and the print export,
 * so the order stays consistent everywhere the app lists employees. */
export function compareByLastName(
  a: Pick<Employee, 'lastName' | 'firstName'>,
  b: Pick<Employee, 'lastName' | 'firstName'>,
): number {
  return a.lastName.localeCompare(b.lastName, 'de') || a.firstName.localeCompare(b.firstName, 'de');
}
