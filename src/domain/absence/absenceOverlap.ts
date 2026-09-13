import type { AbsenceId, EmployeeId } from '@domain/shared/ids';
import type { Absence } from './Absence';

export interface AbsenceRange {
  employeeId: EmployeeId;
  from: string;
  to: string;
}

function rangesOverlap(a: AbsenceRange, b: AbsenceRange): boolean {
  return a.from <= b.to && b.from <= a.to;
}

function isSingleDay(range: AbsenceRange): boolean {
  return range.from === range.to;
}

function fullyContains(outer: AbsenceRange, inner: AbsenceRange): boolean {
  return outer.from <= inner.from && inner.to <= outer.to;
}

/** True when one side is a single day fully inside the other, strictly longer, range - the
 * documented, intentional nesting (a public holiday inside a vacation week is the typical case,
 * see application/schedule/scheduleAssessment.ts's findAbsenceForDay), which must never be flagged
 * as a conflict. Symmetric: it does not matter which side is "new" and which is "existing", and it
 * never looks at either side's absence type - only the two date ranges. */
function isIntentionalNesting(a: AbsenceRange, b: AbsenceRange): boolean {
  if (isSingleDay(a) && !isSingleDay(b) && fullyContains(b, a)) return true;
  if (isSingleDay(b) && !isSingleDay(a) && fullyContains(a, b)) return true;
  return false;
}

/** Every absence of the same employee (other than excludeId) whose range overlaps target, with no
 * judgment about whether that overlap is a plausible mistake - callers that write without asking
 * per element (P4's holiday bulk creation, P11's bulk cell edits) use this raw result so they never
 * silently double-book a day, even one that findConflictingAbsences below would treat as fine. */
export function findOverlappingAbsences(target: AbsenceRange, existing: Absence[], excludeId?: AbsenceId): Absence[] {
  return existing.filter((a) => a.employeeId === target.employeeId && a.id !== excludeId && rangesOverlap(target, a));
}

/** Like findOverlappingAbsences, minus the documented intentional nesting - the basis for the
 * interactive "did you mean to do this?" confirmation in AbsenceDialog. */
export function findConflictingAbsences(target: AbsenceRange, existing: Absence[], excludeId?: AbsenceId): Absence[] {
  return findOverlappingAbsences(target, existing, excludeId).filter((a) => !isIntentionalNesting(target, a));
}
