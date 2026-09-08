import type { FieldError } from '@domain/validation/FieldError';

export type AbsenceField = 'employeeId' | 'label' | 'from' | 'to';

export interface AbsenceDraft {
  employeeId: string;
  type: 'Vacation' | 'Illness' | 'Other';
  from: string;
  to: string;
  /** Only checked for type 'Other', where it is the text shown in the schedule. */
  label?: string;
}

/** Single source of the "Bis vor Von" wording: shown as helper text on the Bis field in the
 * dialogs and used by createAbsence for the same rule at the aggregate boundary. */
export const TO_BEFORE_FROM_MESSAGE = '"Bis" darf nicht vor "Von" liegen.';

/** Field rules shared by every place an absence is entered (Abwesenheiten dialog and the
 * Tageseditor) and enforced again by createAbsence. Dates are ISO strings, so the plain string
 * comparison for from/to order is correct. */
export function validateAbsence(draft: AbsenceDraft): FieldError<AbsenceField>[] {
  const errors: FieldError<AbsenceField>[] = [];

  if (!draft.employeeId) {
    errors.push({ field: 'employeeId', message: 'Bitte Mitarbeiter auswählen.' });
  }
  if (draft.type === 'Other' && !draft.label?.trim()) {
    errors.push({ field: 'label', message: 'Bitte Bezeichnung eingeben.' });
  }
  if (!draft.from) {
    errors.push({ field: 'from', message: 'Bitte Startdatum wählen.' });
  }
  if (!draft.to) {
    errors.push({ field: 'to', message: 'Bitte Enddatum wählen.' });
  } else if (draft.from && draft.to < draft.from) {
    errors.push({ field: 'to', message: TO_BEFORE_FROM_MESSAGE });
  }

  return errors;
}
