import { differenceInYears, parseISO } from 'date-fns';
import type { FieldError } from '@domain/validation/FieldError';
import { MUST_BE_POSITIVE_MESSAGE, validateHourRange } from '@domain/validation/FieldError';
import type { EmploymentType } from '@domain/employee/EmploymentType';
import { toISODate } from '@domain/shared/DateFormat';

export type EmployeeField =
  | 'firstName'
  | 'lastName'
  | 'jobTitle'
  | 'weeklyHours'
  | 'minHours'
  | 'maxHours'
  | 'maxMonthlyHours'
  | 'vacationEntitlementPerYear'
  | 'holidayVacationHours'
  | 'birthDate'
  | 'exitDate';

/** Sanity ceilings for the two number families below - deliberately generous (well past any real
 * contract or vacation entitlement), so these only ever catch an actual data-entry slip (e.g. a
 * stray extra digit), never a real value. `holidayVacationHours` two fields down already has its
 * own ceiling via `validateHourRange` (that one caps at 24 REAL hours in a day, a different kind of
 * field entirely, so it is not reused here). */
const MAX_WEEKLY_HOURS = 60;
const MAX_WEEKLY_HOURS_MESSAGE = `Höchstens ${MAX_WEEKLY_HOURS} Std. pro Woche.`;
const MAX_VACATION_DAYS_PER_YEAR = 60;
const MAX_VACATION_DAYS_MESSAGE = `Höchstens ${MAX_VACATION_DAYS_PER_YEAR} Tage.`;
/** Plausibility-only, not a legal age limit - §5 JArbSchG's actual employment ban for children is
 * enforced at schedule-validation time (`youthProtection.validateChildEmploymentBan`), since a
 * birth date alone does not yet mean the person is scheduled. This just catches an obviously wrong
 * date (typo'd year, wrong century). */
const MAX_PLAUSIBLE_AGE_YEARS = 100;

/** EmploymentType with its numbers optional, so an unfinished form draft can be validated before
 * the numbers exist. A complete EmploymentType is assignable to this.
 *
 * Derived via a distributive conditional type instead of hand-duplicating EmploymentType's two
 * branches, the same pattern domain/absence/Absence.ts's AbsenceInput uses and for the same
 * reason: a plain `Partial<EmploymentType>` would NOT work here. `keyof`/mapped types over a
 * union compute the INTERSECTION of the branches' keys (only 'type' is common to both), so
 * `Partial<EmploymentType>` collapses to roughly `{ type?: ... }` and silently loses
 * weeklyHours/minHours/maxHours entirely. Distributing first (`EmploymentType extends infer U ?
 * U extends EmploymentType ? ... : never : never`) applies Omit/Partial to each branch
 * individually, keeping 'type' as that branch's own literal (not widened to the full union) so
 * validateEmployee's `employment.type === 'Minijob'` narrowing below still works exactly as
 * before. */
export type EmploymentTypeDraft = EmploymentType extends infer U
  ? U extends EmploymentType
    ? { type: U['type'] } & Partial<Omit<U, 'type'>>
    : never
  : never;

export interface EmployeeDraft {
  firstName: string;
  lastName: string;
  jobTitle: string;
  employmentType: EmploymentTypeDraft;
  vacationEntitlementPerYear?: number;
  holidayVacationHours?: number;
  birthDate?: string;
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
    const { minHours, maxHours, maxMonthlyHours } = employment;
    if (isMissing(minHours)) {
      errors.push({ field: 'minHours', message: 'Bitte Min. Std. eingeben.' });
    } else if (minHours <= 0) {
      errors.push({ field: 'minHours', message: MUST_BE_POSITIVE_MESSAGE });
    } else if (minHours > MAX_WEEKLY_HOURS) {
      errors.push({ field: 'minHours', message: MAX_WEEKLY_HOURS_MESSAGE });
    }
    if (isMissing(maxHours)) {
      errors.push({ field: 'maxHours', message: 'Bitte Max. Std. eingeben.' });
    } else if (maxHours <= 0) {
      errors.push({ field: 'maxHours', message: MUST_BE_POSITIVE_MESSAGE });
    } else if (maxHours > MAX_WEEKLY_HOURS) {
      errors.push({ field: 'maxHours', message: MAX_WEEKLY_HOURS_MESSAGE });
    }
    // Only meaningful once both bounds are present and positive; otherwise the messages above apply.
    if (!isMissing(minHours) && !isMissing(maxHours) && minHours > 0 && maxHours > 0 && minHours > maxHours) {
      errors.push({ field: 'minHours', message: 'Min. Std. darf nicht über Max. Std. liegen.' });
    }
    // Optional (unlike minHours/maxHours above) - only checked once actually entered.
    if (!isMissing(maxMonthlyHours) && maxMonthlyHours <= 0) {
      errors.push({ field: 'maxMonthlyHours', message: MUST_BE_POSITIVE_MESSAGE });
    }
  } else if (isMissing(employment.weeklyHours)) {
    errors.push({ field: 'weeklyHours', message: 'Bitte Wochenstunden eingeben.' });
  } else if (employment.weeklyHours <= 0) {
    errors.push({ field: 'weeklyHours', message: MUST_BE_POSITIVE_MESSAGE });
  } else if (employment.weeklyHours > MAX_WEEKLY_HOURS) {
    errors.push({ field: 'weeklyHours', message: MAX_WEEKLY_HOURS_MESSAGE });
  }

  if (isMissing(draft.vacationEntitlementPerYear)) {
    errors.push({ field: 'vacationEntitlementPerYear', message: 'Bitte Urlaubsanspruch eingeben.' });
  } else if (draft.vacationEntitlementPerYear < 0) {
    errors.push({ field: 'vacationEntitlementPerYear', message: 'Darf nicht negativ sein.' });
  } else if (draft.vacationEntitlementPerYear > MAX_VACATION_DAYS_PER_YEAR) {
    errors.push({ field: 'vacationEntitlementPerYear', message: MAX_VACATION_DAYS_MESSAGE });
  }

  // Required, because it decides how much a vacation day counts towards this employee's actual
  // hours - 0 is a valid answer, but it has to be a deliberate one.
  if (isMissing(draft.holidayVacationHours)) {
    errors.push({ field: 'holidayVacationHours', message: 'Bitte Std. je Feier-/Urlaubstag eingeben.' });
  } else {
    errors.push(...validateHourRange(draft.holidayVacationHours, 'holidayVacationHours'));
  }

  // Both dates are optional; only their order can be wrong. ISO strings compare correctly as text.
  if (draft.entryDate && draft.exitDate && draft.exitDate < draft.entryDate) {
    errors.push({ field: 'exitDate', message: 'Austrittsdatum darf nicht vor dem Eintrittsdatum liegen.' });
  }

  // Optional; only checked once entered. Plain string comparison for "in the future" is correct for
  // ISO dates (same reasoning as isEmployedOn), age itself needs a real calendar diff.
  if (draft.birthDate) {
    if (draft.birthDate > toISODate(new Date())) {
      errors.push({ field: 'birthDate', message: 'Geburtsdatum darf nicht in der Zukunft liegen.' });
    } else if (differenceInYears(new Date(), parseISO(draft.birthDate)) > MAX_PLAUSIBLE_AGE_YEARS) {
      errors.push({ field: 'birthDate', message: 'Geburtsdatum ist unplausibel.' });
    }
  }

  return errors;
}
