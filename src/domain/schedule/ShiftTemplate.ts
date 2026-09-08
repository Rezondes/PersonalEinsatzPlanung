import type { BranchId, ShiftTemplateId } from '@domain/shared/ids';
import { createId } from '@domain/shared/ids';
import { assertNoFieldErrors } from '@domain/shared/DomainError';
import type { Shift } from './Shift';
import { validateShiftTemplate } from './shiftTemplateValidation';

/**
 * A named, reusable working time the user builds once and then applies to days in the weekly grid
 * (toolbar tile, drag and drop, or the clipboard plus "Einfügen").
 *
 * Belongs to a Branch, like employees and weekly schedules: opening hours differ per store, so a
 * template from another branch would only be noise in the toolbar.
 *
 * Deliberately holds Shift[] rather than a whole DayEntry: a template is always working time. An
 * empty day is the fixed "Frei" tool in the toolbar, not something the user has to create, which
 * keeps `shifts` guaranteed non-empty.
 *
 * Applying a template COPIES its shifts (with fresh ids, see ui/views/schedule/scheduleTools.ts) -
 * a weekly schedule never references a template, so renaming or deleting one later can never
 * change hours that were already planned.
 */
export interface ShiftTemplate {
  id: ShiftTemplateId;
  branchId: BranchId;
  name: string;
  shifts: Shift[];
  createdAt: string;
  updatedAt: string;
}

export function createShiftTemplate(details: {
  branchId: BranchId;
  name: string;
  shifts: Shift[];
}): ShiftTemplate {
  // Field rules live in shiftTemplateValidation.ts; enforced here too so no service or import path
  // can create a template the dialog would refuse. Updates are deliberately not re-validated.
  assertNoFieldErrors(validateShiftTemplate({ name: details.name, shiftCount: details.shifts.length }));
  const now = new Date().toISOString();
  return {
    id: createId<ShiftTemplateId>(),
    branchId: details.branchId,
    name: details.name,
    shifts: details.shifts,
    createdAt: now,
    updatedAt: now,
  };
}

/** Sorts templates by name, German collation, so the toolbar order is stable and predictable. */
export function compareShiftTemplatesByName(a: ShiftTemplate, b: ShiftTemplate): number {
  return a.name.localeCompare(b.name, 'de');
}
