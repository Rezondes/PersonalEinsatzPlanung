import type { FieldError } from '@domain/validation/FieldError';
import { validateHourRange } from '@domain/validation/FieldError';
// Type-only, so this doesn't create a real runtime dependency cycle even though Absence.ts
// imports validateAbsence from this file at runtime - only the erased `type` import goes back.
import type { AbsenceType } from './Absence';

export type AbsenceField = 'employeeId' | 'label' | 'hoursPerDay' | 'creditedMinutesOverride' | 'from' | 'to';

/** Field key for the manual credited-minutes override (Vacation/Illness/PublicHoliday), mirroring
 * domain/schedule/shiftDraft.ts's NET_OVERRIDE_FIELD naming. */
export const CREDITED_OVERRIDE_FIELD: AbsenceField = 'creditedMinutesOverride';

export interface AbsenceDraft {
  employeeId: string;
  type: AbsenceType;
  from: string;
  to: string;
  /** Only checked for type 'Other', where it is the text shown in the schedule. */
  label?: string;
  /** Only checked for type 'Other'. Optional hours credited per day of the range. */
  hoursPerDay?: number;
  /** Only checked for Vacation/Illness/PublicHoliday: replaces the automatically calculated
   * credited minutes for every day of the range. In minutes, matching
   * Absence.creditedMinutesOverride directly - the field itself is entered in hours in the UI, but
   * converted before reaching this draft, same as how Shift's netMinutesOverride is handled. */
  creditedMinutesOverride?: number;
  /** The employee's employment period, when the caller knows it. Left out by createAbsence, which
   * only sees the absence itself - the dialogs pass it so a range outside Eintritt/Austritt is
   * rejected at the field instead of silently creating an unplannable entry. */
  employment?: { entryDate?: string; exitDate?: string };
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
  if (draft.type === 'Other' && draft.hoursPerDay !== undefined) {
    errors.push(...validateHourRange(draft.hoursPerDay, 'hoursPerDay'));
  }
  if (draft.type !== 'Other' && draft.creditedMinutesOverride !== undefined) {
    errors.push(...validateHourRange(draft.creditedMinutesOverride, CREDITED_OVERRIDE_FIELD, 24 * 60));
  }
  if (!draft.from) {
    errors.push({ field: 'from', message: 'Bitte Startdatum wählen.' });
  }
  if (!draft.to) {
    errors.push({ field: 'to', message: 'Bitte Enddatum wählen.' });
  } else if (draft.from && draft.to < draft.from) {
    errors.push({ field: 'to', message: TO_BEFORE_FROM_MESSAGE });
  }

  const employment = draft.employment;
  if (employment) {
    if (draft.from && employment.entryDate && draft.from < employment.entryDate) {
      errors.push({ field: 'from', message: 'Liegt vor dem Eintrittsdatum des Mitarbeiters.' });
    }
    if (draft.to && employment.exitDate && draft.to > employment.exitDate) {
      errors.push({ field: 'to', message: 'Liegt nach dem Austrittsdatum des Mitarbeiters.' });
    }
  }

  return errors;
}
