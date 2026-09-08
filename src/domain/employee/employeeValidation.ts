import type { FieldError } from '@domain/validation/FieldError';
import { MUST_BE_POSITIVE_MESSAGE } from '@domain/validation/FieldError';

export type EmployeeField =
  | 'firstName'
  | 'lastName'
  | 'jobTitle'
  | 'weeklyHours'
  | 'minHours'
  | 'maxHours'
  | 'vacationEntitlementPerYear'
  | 'holidayVacationHours'
  | 'exitDate';

/** EmploymentType with its numbers optional, so an unfinished form draft can be validated before
 * the numbers exist. A complete EmploymentType is assignable to this. */
export type EmploymentTypeDraft =
  | { type: 'FullTime' | 'PartTime'; weeklyHours?: number }
  | { type: 'Minijob'; minHours?: number; maxHours?: number };

export interface EmployeeDraft {
  firstName: string;
  lastName: string;
  jobTitle: string;
  employmentType: EmploymentTypeDraft;
  vacationEntitlementPerYear?: number;
  holidayVacationHours?: number;
  entryDate?: string;
  exitDate?: string;
}

function isMissing(value: number | undefined): value is undefined {
  return value === undefined || !Number.isFinite(value);
}

/** Field rules for creating an employee. Returns every problem at once so the dialog can mark all
 * affected fields in one go. Deliberately NOT applied on update paths: employees stored before
 * these rules existed (e.g. with an empty job title) must stay editable and deactivatable. */
export function validateEmployee(draft: EmployeeDraft): FieldError<EmployeeField>[] {
  const errors: FieldError<EmployeeField>[] = [];

  if (!draft.firstName.trim()) {
    errors.push({ field: 'firstName', message: 'Bitte Vornamen eingeben.' });
  }
  if (!draft.lastName.trim()) {
    errors.push({ field: 'lastName', message: 'Bitte Nachnamen eingeben.' });
  }
  if (!draft.jobTitle.trim()) {
    errors.push({ field: 'jobTitle', message: 'Bitte Tätigkeit angeben.' });
  }

  const employment = draft.employmentType;
  if (employment.type === 'Minijob') {
    const { minHours, maxHours } = employment;
    if (isMissing(minHours)) {
      errors.push({ field: 'minHours', message: 'Bitte Min. Std. eingeben.' });
    } else if (minHours <= 0) {
      errors.push({ field: 'minHours', message: MUST_BE_POSITIVE_MESSAGE });
    }
    if (isMissing(maxHours)) {
      errors.push({ field: 'maxHours', message: 'Bitte Max. Std. eingeben.' });
    } else if (maxHours <= 0) {
      errors.push({ field: 'maxHours', message: MUST_BE_POSITIVE_MESSAGE });
    }
    // Only meaningful once both bounds are present and positive; otherwise the messages above apply.
    if (!isMissing(minHours) && !isMissing(maxHours) && minHours > 0 && maxHours > 0 && minHours > maxHours) {
      errors.push({ field: 'minHours', message: 'Min. Std. darf nicht über Max. Std. liegen.' });
    }
  } else if (isMissing(employment.weeklyHours)) {
    errors.push({ field: 'weeklyHours', message: 'Bitte Wochenstunden eingeben.' });
  } else if (employment.weeklyHours <= 0) {
    errors.push({ field: 'weeklyHours', message: MUST_BE_POSITIVE_MESSAGE });
  }

  if (isMissing(draft.vacationEntitlementPerYear)) {
    errors.push({ field: 'vacationEntitlementPerYear', message: 'Bitte Urlaubsanspruch eingeben.' });
  } else if (draft.vacationEntitlementPerYear < 0) {
    errors.push({ field: 'vacationEntitlementPerYear', message: 'Darf nicht negativ sein.' });
  }

  // Required, because it decides how much a vacation day counts towards this employee's actual
  // hours - 0 is a valid answer, but it has to be a deliberate one.
  if (isMissing(draft.holidayVacationHours)) {
    errors.push({ field: 'holidayVacationHours', message: 'Bitte Std. je Feier-/Urlaubstag eingeben.' });
  } else if (draft.holidayVacationHours < 0) {
    errors.push({ field: 'holidayVacationHours', message: 'Darf nicht negativ sein.' });
  } else if (draft.holidayVacationHours > 24) {
    errors.push({ field: 'holidayVacationHours', message: 'Höchstens 24 Stunden.' });
  }

  // Both dates are optional; only their order can be wrong. ISO strings compare correctly as text.
  if (draft.entryDate && draft.exitDate && draft.exitDate < draft.entryDate) {
    errors.push({ field: 'exitDate', message: 'Austrittsdatum darf nicht vor dem Eintrittsdatum liegen.' });
  }

  return errors;
}
