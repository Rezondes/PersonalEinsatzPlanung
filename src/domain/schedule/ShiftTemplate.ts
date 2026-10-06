import type { BranchId, ShiftTemplateId } from '@domain/shared/ids';
import { createId } from '@domain/shared/ids';
import { assertNoFieldErrors } from '@domain/shared/DomainError';
import type { Shift } from './Shift';
import { validateShiftTemplate } from './shiftTemplateValidation';

interface ShiftTemplateBase {
  id: ShiftTemplateId;
  branchId: BranchId;
  name: string;
  createdAt: string;
  updatedAt: string;
}

/** Which half of a one-day vacation is taken off. Converted to Absence.halfDay's
 * `{ atStart, atEnd }` only when the template is applied: 'morning' is `atStart`, 'afternoon' is
 * `atEnd`, the same mapping as the Abwesenheiten dialog. */
export type VacationHalfDay = 'morning' | 'afternoon';

/**
 * A named, reusable entry the user builds once and then applies to days in the weekly grid (toolbar
 * tile, or the clipboard plus "Einfügen"): working time, or a one-day absence of any type - a
 * "Sonstiges" absence (Bezeichnung + optional Stunden), Urlaub (optionally a half day), Krankheit or
 * Feiertag. The last three may carry a `creditedMinutesOverride` like the Absence they produce. A
 * template always describes exactly one day; multi-day ranges stay in the Abwesenheiten tab.
 *
 * Belongs to a Branch, like employees and weekly schedules: opening hours differ per store, so a
 * template from another branch would only be noise in the toolbar.
 *
 * Applying a Shift-kind template COPIES its shifts (with fresh ids, see
 * ui/views/schedule/scheduleTools.ts); applying any other kind creates a new one-day Absence of
 * that type the same way DayEditor does (see ui/views/schedule/ScheduleView.tsx's
 * writeAbsenceToCell). Either way nothing in a weekly schedule or an absence ever references the
 * template itself, so renaming or deleting one later can never change hours that were already
 * planned.
 *
 * The three absence kinds only extend the union: records and backups written before they existed
 * are still valid as they are, so neither a Dexie upgrade nor a new export formatVersion is needed.
 */
export type ShiftTemplate =
  | (ShiftTemplateBase & { kind: 'Shift'; shifts: Shift[] })
  | (ShiftTemplateBase & { kind: 'Other'; label: string; hoursPerDay?: number })
  | (ShiftTemplateBase & { kind: 'Vacation'; halfDay?: VacationHalfDay; creditedMinutesOverride?: number })
  | (ShiftTemplateBase & { kind: 'Illness'; creditedMinutesOverride?: number })
  | (ShiftTemplateBase & { kind: 'PublicHoliday'; creditedMinutesOverride?: number });

/** Distributive Omit, same reason as AbsenceInput in domain/absence/Absence.ts: a plain Omit over
 * the union would collapse it to the shared keys and lose every kind's own fields. */
export type CreateShiftTemplateInput = ShiftTemplate extends infer U
  ? U extends ShiftTemplate
    ? Omit<U, 'id' | 'createdAt' | 'updatedAt'>
    : never
  : never;

// Overloads so a caller passing a literal `kind` gets a narrowed return type back (no manual
// `template.kind === 'Shift' &&` guard needed just to reach `.shifts`). The third, union-shaped
// overload is for callers that already hold a plain CreateShiftTemplateInput value (its kind not a
// literal at that point, e.g. shiftTemplateService.create) - TS overload resolution can't otherwise
// match a union argument against either narrow overload above. All three share one implementation.
export function createShiftTemplate(details: { branchId: BranchId; name: string; kind: 'Shift'; shifts: Shift[] }): Extract<ShiftTemplate, { kind: 'Shift' }>;
export function createShiftTemplate(details: { branchId: BranchId; name: string; kind: 'Other'; label: string; hoursPerDay?: number }): Extract<ShiftTemplate, { kind: 'Other' }>;
export function createShiftTemplate(details: CreateShiftTemplateInput): ShiftTemplate;
export function createShiftTemplate(details: CreateShiftTemplateInput): ShiftTemplate {
  // Field rules live in shiftTemplateValidation.ts; enforced here too so no service or import path
  // can create a template the dialog would refuse. Updates are deliberately not re-validated.
  assertNoFieldErrors(
    validateShiftTemplate(
      details.kind === 'Shift' ? { kind: 'Shift', name: details.name, shiftCount: details.shifts.length } : details,
    ),
  );
  const now = new Date().toISOString();
  return { ...details, id: createId<ShiftTemplateId>(), createdAt: now, updatedAt: now };
}

/** Sorts templates by name, German collation, so the toolbar order is stable and predictable. */
export function compareShiftTemplatesByName(a: ShiftTemplate, b: ShiftTemplate): number {
  return a.name.localeCompare(b.name, 'de');
}
