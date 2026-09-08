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
  /** Optional, only relevant for the youth-labor-protection check (data minimization: only collect when needed). */
  birthDate?: string;
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
  birthDate?: string;
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
    birthDate: details.birthDate,
    active: true,
    createdAt: now,
    updatedAt: now,
  };
}

export function fullName(employee: Pick<Employee, 'lastName' | 'firstName'>): string {
  return `${employee.lastName}, ${employee.firstName}`;
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
