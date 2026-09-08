import type { Weekday } from '@domain/shared/CalendarWeek';
import type { Employee } from '@domain/employee/Employee';
import { compareByLastName, isEmployedDuring, isEmployedOn } from '@domain/employee/Employee';
import type { EmployeeWeekView } from '@application/schedule/scheduleAssessment';

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

function hasAnyEntry(view: EmployeeWeekView): boolean {
  return view.days.some(
    (day) => day.absence !== undefined || (day.entry.type === 'Shift' && day.entry.shifts.length > 0),
  );
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

    const employedThisWeek = isEmployedDuring(employee, weekStartISO, weekEndISO);
    const editable = employee.active && employedThisWeek;
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

/** True when this specific cell must not be edited: either the whole row is locked, or the day
 * falls outside the employee's Eintritt/Austritt. */
export function isCellLocked(row: ScheduleRow, day: Weekday): boolean {
  return !row.editable || row.lockedDays.includes(day);
}
