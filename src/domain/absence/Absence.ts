import type { AbsenceId, EmployeeId } from '@domain/shared/ids';
import { createId } from '@domain/shared/ids';
import { assertNoFieldErrors } from '@domain/shared/DomainError';
import { validateAbsence } from './absenceValidation';

interface AbsenceBase {
  id: AbsenceId;
  employeeId: EmployeeId;
  from: string;
  to: string;
  createdAt: string;
}

/**
 * "Illness" deliberately has NO free-text/diagnosis field (Privacy by Design in the type system):
 * a medical note can structurally never be stored by accident.
 *
 * "Other" carries an optional `hoursPerDay`: hours credited to the employee for every day of the
 * range (e.g. a training day or a public holiday). They count towards the employee's own weekly
 * actual hours but never towards a branch total - see application/schedule/scheduleAssessment.ts.
 */
export type Absence =
  | (AbsenceBase & { type: 'Vacation'; halfDay?: { atStart: boolean; atEnd: boolean }; note?: string })
  | (AbsenceBase & { type: 'Illness' })
  | (AbsenceBase & { type: 'Other'; label: string; hoursPerDay?: number; note?: string });

/** Plain Omit<Union, K> loses the discriminated-union structure (keyof a union forms the
 * intersection of keys); this distributive variant applies Omit to each union member individually,
 * so e.g. 'label' on type: 'Other' stays required/type-safe. */
export type AbsenceInput = Absence extends infer U
  ? U extends Absence
    ? Omit<U, 'id' | 'createdAt'>
    : never
  : never;

/** Enforces the field rules (see absenceValidation.ts) at the aggregate boundary, not only in UI
 * forms - a service-level or import-driven caller could otherwise construct an invalid date range
 * or an "Other" absence without the label the schedule displays. The employment-period rule is not
 * checked here: this factory only sees the absence, not the employee. */
export function createAbsence(input: AbsenceInput): Absence {
  assertNoFieldErrors(
    validateAbsence({
      employeeId: input.employeeId,
      type: input.type,
      from: input.from,
      to: input.to,
      label: input.type === 'Other' ? input.label : undefined,
      hoursPerDay: input.type === 'Other' ? input.hoursPerDay : undefined,
    }),
  );
  return { ...input, id: createId<AbsenceId>(), createdAt: new Date().toISOString() } as Absence;
}
