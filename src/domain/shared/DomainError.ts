import type { FieldError } from '@domain/validation/FieldError';

export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DomainError';
  }
}

/** Thrown by the create* factories when a draft fails its field validator (validateEmployee,
 * validateBranch, validateAbsence, validateShiftDrafts). Carries the individual field errors so a
 * caller that can show them per field may do so; the joined message serves everything else
 * (e.g. the generic ErrorSnackbar, which only reads `.message`). */
export class DomainValidationError extends DomainError {
  readonly fieldErrors: FieldError[];

  constructor(fieldErrors: FieldError[]) {
    super(fieldErrors.map((e) => e.message).join(' '));
    this.name = 'DomainValidationError';
    this.fieldErrors = fieldErrors;
  }
}

export function assertNoFieldErrors(errors: FieldError[]): void {
  if (errors.length > 0) {
    throw new DomainValidationError(errors);
  }
}
