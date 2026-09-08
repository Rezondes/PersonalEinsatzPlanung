import type { FieldError } from '@domain/validation/FieldError';
import { SHIFT_LIST_FIELD } from './shiftDraft';

export type ShiftTemplateField = 'name' | typeof SHIFT_LIST_FIELD;

export interface ShiftTemplateDraft {
  name: string;
  /** Only the count matters here; the shifts themselves are checked by validateShiftDrafts, which
   * the dialog already runs on its in-progress drafts. Reusing SHIFT_LIST_FIELD as the key means
   * both messages land on the same spot in the form. */
  shiftCount: number;
}

/** Field rules for a reusable shift template. Same shape as every other validator in the domain:
 * a pure function returning every problem at once. */
export function validateShiftTemplate(draft: ShiftTemplateDraft): FieldError<ShiftTemplateField>[] {
  const errors: FieldError<ShiftTemplateField>[] = [];

  if (!draft.name.trim()) {
    errors.push({ field: 'name', message: 'Bitte Bezeichnung eingeben.' });
  }
  if (draft.shiftCount === 0) {
    errors.push({ field: SHIFT_LIST_FIELD, message: 'Bitte mindestens eine Schicht anlegen.' });
  }

  return errors;
}
