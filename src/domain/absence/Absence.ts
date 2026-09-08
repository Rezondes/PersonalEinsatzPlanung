import type { AbsenceId, EmployeeId } from '@domain/shared/ids';
import { createId } from '@domain/shared/ids';
import { DomainError } from '@domain/shared/DomainError';

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
 */
export type Absence =
  | (AbsenceBase & { type: 'Vacation'; halfDay?: { atStart: boolean; atEnd: boolean }; note?: string })
  | (AbsenceBase & { type: 'Illness' })
  | (AbsenceBase & { type: 'Other'; label: string; note?: string });

/** Plain Omit<Union, K> loses the discriminated-union structure (keyof a union forms the
 * intersection of keys); this distributive variant applies Omit to each union member individually,
 * so e.g. 'label' on type: 'Other' stays required/type-safe. */
export type AbsenceInput = Absence extends infer U
  ? U extends Absence
    ? Omit<U, 'id' | 'createdAt'>
    : never
  : never;

/** Enforces the "to is not before from" invariant at the aggregate boundary, not only in UI forms -
 * a service-level or import-driven caller could otherwise construct an invalid date range. */
export function createAbsence(input: AbsenceInput): Absence {
  if (input.to < input.from) {
    throw new DomainError('"Bis" darf nicht vor "Von" liegen.');
  }
  return { ...input, id: createId<AbsenceId>(), createdAt: new Date().toISOString() } as Absence;
}
