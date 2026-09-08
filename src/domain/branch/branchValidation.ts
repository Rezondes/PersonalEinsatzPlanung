import { isSunday as dateFnsIsSunday, isValid, parseISO } from 'date-fns';
import type { FieldError } from '@domain/validation/FieldError';

export type BranchField = 'name' | 'branchNumber';

/** Field rules for creating a branch. Address fields are optional (they only appear on the printed
 * form), the federal state is always preselected in the dialog. Not applied on update paths. */
export function validateBranch(draft: { name: string; branchNumber: string }): FieldError<BranchField>[] {
  const errors: FieldError<BranchField>[] = [];
  if (!draft.name.trim()) {
    errors.push({ field: 'name', message: 'Bitte Namen der Filiale eingeben.' });
  }
  if (!draft.branchNumber.trim()) {
    errors.push({ field: 'branchNumber', message: 'Bitte Filialnummer eingeben.' });
  }
  return errors;
}

/** parseISO reads "YYYY-MM-DD" as local midnight, so the weekday is the calendar weekday the user
 * picked - `new Date(isoDate)` would parse it as UTC and shift the weekday west of Greenwich. */
export function isSunday(isoDate: string): boolean {
  const date = parseISO(isoDate);
  return isValid(date) && dateFnsIsSunday(date);
}

export type OpenSundayField = 'newSunday';

/** Rules for the "Datum hinzufügen" sub-form of the open-Sundays list. Only the date being added
 * is checked; dates already in the list stay as they are (older data may contain non-Sundays). */
export function validateOpenSundayDate(isoDate: string, existing: readonly string[]): FieldError<OpenSundayField>[] {
  if (!isoDate) {
    return [{ field: 'newSunday', message: 'Bitte ein Datum wählen.' }];
  }
  if (!isSunday(isoDate)) {
    return [{ field: 'newSunday', message: 'Das Datum ist kein Sonntag.' }];
  }
  if (existing.includes(isoDate)) {
    return [{ field: 'newSunday', message: 'Dieses Datum ist bereits eingetragen.' }];
  }
  return [];
}
