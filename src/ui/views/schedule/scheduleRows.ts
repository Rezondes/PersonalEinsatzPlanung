import type { Weekday } from '@domain/shared/CalendarWeek';
import type { Employee } from '@domain/employee/Employee';
import { compareByLastName, isEmployedOn, isPlannable } from '@domain/employee/Employee';
import type { DayView, EmployeeWeekView } from '@application/schedule/scheduleAssessment';
import { hasAnyEntry } from '@application/schedule/scheduleAssessment';

/** Why a row cannot be edited. Drives the chip next to the name; `undefined` means editable. */
export type RowLockReason = 'inactive' | 'notEmployed';

export interface ScheduleRow {
  view: EmployeeWeekView;
  employee: Employee;
  /** false = the whole row is read-only (inactive employee, or their employment does not cover
   * this week at all). It is still shown, because it still carries entries. */
  editable: boolean;
  lockReason?: RowLockReason;
  /** Individual days outside the Eintritts-/Austrittsdatum, locked even inside an editable row
   * (e.g. someone who starts on Wednesday). */
  lockedDays: Weekday[];
}

/**
 * Turns the week view into the rows the table renders.
 *
 * Visibility: an employee who may be scheduled this week is always shown. One who may not (inactive,
 * or employed outside this week) is only shown while they still carry entries for it - and then
 * read-only, so already recorded hours never silently disappear from the screen but cannot be
 * changed either.
 *
 * Assignments whose employeeId no longer resolves to a known Employee are dropped BEFORE sorting,
 * not after: `schedule.employeeAssignments` can still contain orphans from a hard-deleted employee
 * (from before "deactivate instead of delete" existed), and a comparator falling back to "treat as
 * equal" for them would scramble the real rows around them during the sort.
 */
export function buildScheduleRows(
  weekView: EmployeeWeekView[],
  employeeList: Employee[],
  weekStartISO: string,
  weekEndISO: string,
): ScheduleRow[] {
  const employeeById = new Map(employeeList.map((emp) => [emp.id, emp]));

  const rows: ScheduleRow[] = [];
  for (const view of weekView) {
    const employee = employeeById.get(view.employeeId);
    if (!employee) {
      continue;
    }

    const editable = isPlannable(employee, weekStartISO, weekEndISO);
    if (!editable && !hasAnyEntry(view)) {
      continue;
    }

    rows.push({
      view,
      employee,
      editable,
      lockReason: editable ? undefined : !employee.active ? 'inactive' : 'notEmployed',
      lockedDays: view.days.filter((day) => !isEmployedOn(employee, day.date)).map((day) => day.day),
    });
  }

  return rows.sort((a, b) => compareByLastName(a.employee, b.employee));
}

/**
 * Whether this employee still has to be given hours this week - the "Noch nicht eingeplant" tile.
 *
 * Deliberately NOT `!hasAnyEntry(row.view)`, which is a `.some()` over ONE day and exists to decide
 * row VISIBILITY (the print export depends on it too). Reusing it would count a whole week as
 * planned off the back of a single absence day - and a single "Sonstige" day is how this app books
 * a public holiday, so a holiday week would read "0 Mitarbeiter" before a single shift existed.
 *
 * The three parts, in order:
 *  - editable: they may be scheduled this week at all. An inactive or no-longer-employed row is by
 *    construction one that already carries entries, so it is nothing to plan.
 *  - no shift on any day that could take one. Shifts stranded on a locked day (someone whose
 *    Eintrittsdatum was moved later after they were planned) do not count as planned.
 *  - at least one schedulable day left that an absence does not already cover for the whole day.
 *    Away all week is nothing to do; away Monday to Friday still leaves Saturday, so that row does
 *    still count.
 *
 * Known limitation: an explicit "Frei" cannot be told apart from an untouched day. Both are
 * `{ type: 'Off' }`, and a freshly created week starts with seven of them, so someone deliberately
 * given the whole week off keeps counting here. Distinguishing them would need a new field on
 * DayEntry - not worth it for one tile.
 */
export function isNotYetScheduled(row: ScheduleRow): boolean {
  if (!row.editable) {
    return false;
  }
  const schedulable = row.view.days.filter((day) => !row.lockedDays.includes(day.day));
  const hasShift = schedulable.some((day) => day.entry.type === 'Shift' && day.entry.shifts.length > 0);
  const hasFreeDay = schedulable.some((day) => !day.absenceCoversWholeDay);
  return !hasShift && hasFreeDay;
}

/** True when this specific cell must not be edited: either the whole row is locked, or the day
 * falls outside the employee's Eintritt/Austritt. */
export function isCellLocked(row: ScheduleRow, day: Weekday): boolean {
  return !row.editable || row.lockedDays.includes(day);
}

/**
 * Whether a cell may receive a new entry at all - the single rule behind "Einfügen", the "Frei"
 * menu item and a drag-and-drop drop.
 *
 * Beyond the row/day lock it also rules out cells covered by a MULTI-day absence: those can only be
 * edited in the Abwesenheiten tab (see the read-only branch in DayEditor), and drag and drop must
 * not become the one path that writes a shift onto a vacation week.
 */
export function canReceiveEntry(row: ScheduleRow, dayView: DayView): boolean {
  if (isCellLocked(row, dayView.day)) {
    return false;
  }
  const absence = dayView.absence;
  return !absence || (absence.from === dayView.date && absence.to === dayView.date);
}
