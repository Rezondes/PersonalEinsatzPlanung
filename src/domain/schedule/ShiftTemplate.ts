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

/**
 * A named, reusable working time OR a reusable "Sonstiges" absence (Bezeichnung + optional
 * Stunden) the user builds once and then applies to days in the weekly grid (toolbar tile, drag
 * and drop, or the clipboard plus "Einfügen"). Urlaub, Feiertag and Krankheit deliberately have no
 * template support - they are not the kind of recurring, reusable configuration a template exists
 * for.
 *
 * Belongs to a Branch, like employees and weekly schedules: opening hours differ per store, so a
 * template from another branch would only be noise in the toolbar.
 *
 * Applying a Shift-kind template COPIES its shifts (with fresh ids, see
 * ui/views/schedule/scheduleTools.ts); applying an Other-kind template creates a new one-day
 * Absence the same way DayEditor's "Sonstige" tab does (see
 * ui/views/schedule/ScheduleView.tsx's writeAbsenceToCell). Either way nothing in a weekly schedule
 * or an absence ever references the template itself, so renaming or deleting one later can never
 * change hours that were already planned.
 */
export type ShiftTemplate =
  | (ShiftTemplateBase & { kind: 'Shift'; shifts: Shift[] })
  | (ShiftTemplateBase & { kind: 'Other'; label: string; hoursPerDay?: number });

export type CreateShiftTemplateInput =
  | { branchId: BranchId; name: string; kind: 'Shift'; shifts: Shift[] }
  | { branchId: BranchId; name: string; kind: 'Other'; label: string; hoursPerDay?: number };

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
    details.kind === 'Shift'
      ? validateShiftTemplate({ kind: 'Shift', name: details.name, shiftCount: details.shifts.length })
      : validateShiftTemplate({ kind: 'Other', name: details.name, label: details.label, hoursPerDay: details.hoursPerDay }),
  );
  const now = new Date().toISOString();
  const base: ShiftTemplateBase = {
    id: createId<ShiftTemplateId>(),
    branchId: details.branchId,
    name: details.name,
    createdAt: now,
    updatedAt: now,
  };
  return details.kind === 'Shift'
    ? { ...base, kind: 'Shift', shifts: details.shifts }
    : { ...base, kind: 'Other', label: details.label, hoursPerDay: details.hoursPerDay };
}

/** Sorts templates by name, German collation, so the toolbar order is stable and predictable. */
export function compareShiftTemplatesByName(a: ShiftTemplate, b: ShiftTemplate): number {
  return a.name.localeCompare(b.name, 'de');
}
