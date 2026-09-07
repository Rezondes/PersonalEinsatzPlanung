import type { AbwesenheitId, MitarbeiterId } from '@domain/shared/ids';
import { neueId } from '@domain/shared/ids';
import { DomainError } from '@domain/shared/DomainError';

interface AbwesenheitBasis {
  id: AbwesenheitId;
  mitarbeiterId: MitarbeiterId;
  von: string;
  bis: string;
  erstelltAm: string;
}

/**
 * "Krankheit" deliberately has NO free-text/diagnosis field (Privacy by Design in the type system):
 * a medical note can structurally never be stored by accident.
 */
export type Abwesenheit =
  | (AbwesenheitBasis & { art: 'Urlaub'; halbtags?: { amBeginn: boolean; amEnde: boolean }; notiz?: string })
  | (AbwesenheitBasis & { art: 'Krankheit' })
  | (AbwesenheitBasis & { art: 'Sonstige'; bezeichnung: string; notiz?: string });

/** Plain Omit<Union, K> loses the discriminated-union structure (keyof a union forms the
 * intersection of keys); this distributive variant applies Omit to each union member individually,
 * so e.g. 'bezeichnung' on art: 'Sonstige' stays required/type-safe. */
export type AbwesenheitEingabe = Abwesenheit extends infer U
  ? U extends Abwesenheit
    ? Omit<U, 'id' | 'erstelltAm'>
    : never
  : never;

/** Enforces the "bis is not before von" invariant at the aggregate boundary, not only in UI forms -
 * a service-level or import-driven caller could otherwise construct an invalid date range. */
export function neueAbwesenheit(angaben: AbwesenheitEingabe): Abwesenheit {
  if (angaben.bis < angaben.von) {
    throw new DomainError('"Bis" darf nicht vor "Von" liegen.');
  }
  return { ...angaben, id: neueId<AbwesenheitId>(), erstelltAm: new Date().toISOString() } as Abwesenheit;
}
