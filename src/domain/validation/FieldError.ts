/** One user-facing problem with one form field. `field` is the key the UI uses to attach the
 * message to the right input; `message` is the German text shown as helper text there. Unlike
 * ValidationResult (ArbZG rules, which only ask for confirmation), a FieldError blocks saving. */
export interface FieldError<F extends string = string> {
  field: F;
  message: string;
}

/** Shared message for every "must be > 0" number rule, so it reads the same in every dialog. */
export const MUST_BE_POSITIVE_MESSAGE = 'Muss größer als 0 sein.';

/** Shared messages for the "hours-style field" range rule below. */
export const NOT_NEGATIVE_MESSAGE = 'Darf nicht negativ sein.';
export const MAX_24_HOURS_MESSAGE = 'Höchstens 24 Stunden.';

/** Shared "finite, not negative, at most `max`" check behind every hours-style field in the app
 * (a day's manual net-hours override, an absence's manual/credited hours, an employee's Std. je
 * Feier-/Urlaubstag) - all of which happen to cap at 24 hours (or the equivalent in minutes, via
 * `max`), so the wording is shared too. Assumes the caller already handled "is this field even
 * required/present" (e.g. via its own optional-field check or `isMissing`) - this only validates a
 * value that IS present. Returns at most one error, since "negative" and "too large" are mutually
 * exclusive. */
export function validateHourRange<F extends string>(value: number, field: F, max = 24): FieldError<F>[] {
  if (!Number.isFinite(value) || value < 0) {
    return [{ field, message: NOT_NEGATIVE_MESSAGE }];
  }
  if (value > max) {
    return [{ field, message: MAX_24_HOURS_MESSAGE }];
  }
  return [];
}
