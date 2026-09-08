import { useEffect, useRef, useState } from 'react';
import type { FieldError } from '@domain/validation/FieldError';

export interface FieldValidationProps {
  error: boolean;
  helperText?: string;
}

/** MUI puts aria-invalid on the native input of an errored TextField; the two fallbacks cover a
 * `select` TextField, whose focusable element is a div with role combobox. */
const FIRST_INVALID_SELECTOR = '[aria-invalid="true"], .Mui-error input, .Mui-error [role="combobox"]';

/**
 * Submit-time field validation for a dialog form, built on plain MUI props (no form library).
 *
 * - Before the first `submit()` nothing is marked, so a user is not shouted at while still typing.
 * - After a failed `submit()` the errors are recomputed on every render, so a message disappears
 *   the moment its field is corrected.
 * - `submit()` returns true when valid. When invalid it also moves focus to the first invalid
 *   field inside `containerRef` (attach the ref to DialogContent), so keyboard and screen-reader
 *   users land on the problem instead of a button that appears to do nothing.
 *
 * `validate` closes over the current form state and returns every FieldError at once; keep the
 * rules themselves in the domain layer (validateEmployee, validateBranch, ...) and only glue them
 * to the form here.
 */
export function useFormValidation<F extends string>(validate: () => FieldError<F>[]) {
  const [submitted, setSubmitted] = useState(false);
  const [focusRequest, setFocusRequest] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const errors: FieldError<F>[] = submitted ? validate() : [];

  // Runs after the render that painted the error states, so aria-invalid is already in the DOM.
  useEffect(() => {
    if (focusRequest === 0) return;
    containerRef.current?.querySelector<HTMLElement>(FIRST_INVALID_SELECTOR)?.focus();
  }, [focusRequest]);

  /** `defaultHelperText` is what the field shows while it has no error (e.g. an explanatory hint). */
  const fieldProps = (field: F, defaultHelperText?: string): FieldValidationProps => {
    const hit = errors.find((e) => e.field === field);
    return { error: hit !== undefined, helperText: hit?.message ?? defaultHelperText };
  };

  const submit = (): boolean => {
    setSubmitted(true);
    if (validate().length === 0) {
      return true;
    }
    setFocusRequest((n) => n + 1);
    return false;
  };

  const reset = () => setSubmitted(false);

  return { submitted, errors, fieldProps, submit, reset, containerRef };
}
