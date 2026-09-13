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
  /** Optional (unlike Employee/Branch/ShiftTemplate's required updatedAt) - deliberately: making it
   * required would force a Dexie + JSON-export-format migration to backfill every Absence stored
   * before editing existed, for a field nothing reads yet. Set from absenceService.update onward. */
  updatedAt?: string;
}

/**
 * "Illness" deliberately has NO free-text/diagnosis field (Privacy by Design in the type system):
 * a medical note can structurally never be stored by accident.
 *
 * "PublicHoliday" ("Feiertag") is a day credited without working, distinct from Vacation (which
 * draws down entitlement) - see application/schedule/scheduleAssessment.ts for how their
 * credited-minutes calculation differs.
 *
 * "Other" carries an optional `hoursPerDay`: hours credited to the employee for every day of the
 * range (e.g. a training day). They count towards the employee's own weekly actual hours but never
 * towards a branch total - see application/schedule/scheduleAssessment.ts.
 *
 * Vacation, Illness and PublicHoliday all support an optional `creditedMinutesOverride`: replaces
 * the automatically calculated credited minutes (based on Employee.holidayVacationHours) for every
 * day of the range - the manual escape hatch for an unusual day without giving up the auto
 * default. A plain number carries no health/diagnosis information, so this does not violate
 * Illness's Privacy-by-Design rule above.
 */
export type Absence =
  | (AbsenceBase & {
      type: 'Vacation';
      halfDay?: { atStart: boolean; atEnd: boolean };
      note?: string;
      creditedMinutesOverride?: number;
    })
  | (AbsenceBase & { type: 'Illness'; creditedMinutesOverride?: number })
  | (AbsenceBase & { type: 'PublicHoliday'; creditedMinutesOverride?: number })
  | (AbsenceBase & { type: 'Other'; label: string; hoursPerDay?: number; note?: string });

/** The single canonical source of the 4 discriminant values - every place that needs "just the
 * type" (form state, filters, switch parameters) imports this instead of retyping the literal
 * union, so a future 5th absence type only ever has to be added here. */
export type AbsenceType = Absence['type'];

/** The absence's own specific label: the fixed German name for Vacation/Illness/PublicHoliday, or
 * an "Other" absence's own free-text label. Single source of truth, replacing four copies that had
 * quietly drifted (one said "Krank" instead of "Krankheit") - see EmploymentType.ts's
 * employmentTypeLabel for the same pattern applied to EmploymentType. */
export function absenceTypeLabel(absence: Absence): string {
  switch (absence.type) {
    case 'Vacation':
      return 'Urlaub';
    case 'Illness':
      return 'Krankheit';
    case 'PublicHoliday':
      return 'Feiertag';
    case 'Other':
      return absence.label;
  }
}

/** The plain kind, independent of an "Other" absence's own free-text label - e.g. so sorting by
 * "Art" groups every Sonstige entry together instead of scattering them by their label, and so a
 * caller holding only the type (not a full Absence) can still show something. */
export function absenceKindLabel(type: AbsenceType): string {
  switch (type) {
    case 'Vacation':
      return 'Urlaub';
    case 'Illness':
      return 'Krankheit';
    case 'PublicHoliday':
      return 'Feiertag';
    case 'Other':
      return 'Sonstige';
  }
}

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
      creditedMinutesOverride: input.type !== 'Other' ? input.creditedMinutesOverride : undefined,
    }),
  );
  return { ...input, id: createId<AbsenceId>(), createdAt: new Date().toISOString() } as Absence;
}
