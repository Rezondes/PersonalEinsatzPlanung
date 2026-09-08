/** One user-facing problem with one form field. `field` is the key the UI uses to attach the
 * message to the right input; `message` is the German text shown as helper text there. Unlike
 * ValidationResult (ArbZG rules, which only ask for confirmation), a FieldError blocks saving. */
export interface FieldError<F extends string = string> {
  field: F;
  message: string;
}

/** Shared message for every "must be > 0" number rule, so it reads the same in every dialog. */
export const MUST_BE_POSITIVE_MESSAGE = 'Muss größer als 0 sein.';
