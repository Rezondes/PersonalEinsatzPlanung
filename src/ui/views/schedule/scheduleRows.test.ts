import { describe, it, expect } from 'vitest';
import type { BranchId, EmployeeId } from '@domain/shared/ids';
import { clockTime } from '@domain/shared/ClockTime';
import { createShift } from '@domain/schedule/Shift';
import { createWeeklySchedule, withDayEntry } from '@domain/schedule/WeeklySchedule';
import type { Employee } from '@domain/employee/Employee';
import { createWeekView } from '@application/schedule/scheduleAssessment';
import type { AbsenceId } from '@domain/shared/ids';
import type { Absence } from '@domain/absence/Absence';
import { buildScheduleRows, canReceiveEntry, isCellLocked } from './scheduleRows';

const branchId = 'b1' as BranchId;
const m1 = 'm1' as EmployeeId;
const m2 = 'm2' as EmployeeId;

/** KW 37/2026: Monday 2026-09-07 to Sunday 2026-09-13. */
const cw = { year: 2026, week: 37 };
const WEEK_START = '2026-09-07';
const WEEK_END = '2026-09-13';

function employee(id: EmployeeId, overrides: Partial<Employee> = {}): Employee {
  return {
    id,
    branchId,
    lastName: id === m1 ? 'Müller' : 'Schulz',
    firstName: 'Anna',
    jobTitle: 'Verkauf',
    employmentType: { type: 'FullTime', weeklyHours: 40 },
    vacationEntitlementPerYear: 30,
    holidayVacationHours: 5,
    active: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

const monday = {
  type: 'Shift' as const,
  shifts: [createShift(clockTime('06:00'), clockTime('14:00'))],
};

/** m1 works Monday, m2 has nothing entered. */
function rowsFor(employees: Employee[], withShiftFor: EmployeeId | null = m1) {
  let schedule = createWeeklySchedule(branchId, cw, [m1, m2]);
  if (withShiftFor) {
    schedule = withDayEntry(schedule, withShiftFor, 'Montag', monday);
  }
  const weekView = createWeekView(schedule, [], { employees });
  return buildScheduleRows(weekView, employees, WEEK_START, WEEK_END);
}

describe('buildScheduleRows', () => {
  it('shows every employee who may be scheduled, sorted by last name', () => {
    const rows = rowsFor([employee(m2), employee(m1)]);
    expect(rows.map((r) => r.employee.lastName)).toEqual(['Müller', 'Schulz']);
    expect(rows.every((r) => r.editable)).toBe(true);
  });

  it('drops assignments whose employee no longer exists', () => {
    const rows = rowsFor([employee(m1)]);
    expect(rows).toHaveLength(1);
    expect(rows[0].employee.id).toBe(m1);
  });

  it('hides an inactive employee without entries', () => {
    const rows = rowsFor([employee(m1), employee(m2, { active: false })]);
    expect(rows.map((r) => r.employee.id)).toEqual([m1]);
  });

  it('keeps an inactive employee with entries, but read-only', () => {
    const rows = rowsFor([employee(m1, { active: false }), employee(m2)]);
    const row = rows.find((r) => r.employee.id === m1);
    expect(row).toBeDefined();
    expect(row!.editable).toBe(false);
    expect(row!.lockReason).toBe('inactive');
  });

  it('hides someone whose employment does not cover the week and has no entries', () => {
    const rows = rowsFor([employee(m1), employee(m2, { entryDate: '2026-10-01' })]);
    expect(rows.map((r) => r.employee.id)).toEqual([m1]);
  });

  it('keeps someone who left mid-week visible and read-only once they have entries', () => {
    const rows = rowsFor([employee(m1, { exitDate: '2026-08-31' }), employee(m2)]);
    const row = rows.find((r) => r.employee.id === m1);
    expect(row!.editable).toBe(false);
    expect(row!.lockReason).toBe('notEmployed');
  });

  it('locks only the days outside the employment period inside an otherwise editable row', () => {
    // Starts on the Wednesday of this week.
    const rows = rowsFor([employee(m1, { entryDate: '2026-09-09' }), employee(m2)]);
    const row = rows.find((r) => r.employee.id === m1)!;
    expect(row.editable).toBe(true);
    expect(row.lockedDays).toEqual(['Montag', 'Dienstag']);
  });

  it('locks nothing when no dates are set', () => {
    const rows = rowsFor([employee(m1), employee(m2)]);
    expect(rows.every((r) => r.lockedDays.length === 0)).toBe(true);
  });
});

describe('isCellLocked', () => {
  it('locks every day of a read-only row', () => {
    const rows = rowsFor([employee(m1, { active: false }), employee(m2)]);
    const row = rows.find((r) => r.employee.id === m1)!;
    expect(isCellLocked(row, 'Montag')).toBe(true);
    expect(isCellLocked(row, 'Freitag')).toBe(true);
  });

  it('locks only the listed days of an editable row', () => {
    const rows = rowsFor([employee(m1, { entryDate: '2026-09-09' }), employee(m2)]);
    const row = rows.find((r) => r.employee.id === m1)!;
    expect(isCellLocked(row, 'Dienstag')).toBe(true);
    expect(isCellLocked(row, 'Mittwoch')).toBe(false);
  });
});

describe('canReceiveEntry', () => {
  const employees = [employee(m1), employee(m2)];

  function rowsWithAbsences(absences: Absence[]) {
    const schedule = withDayEntry(createWeeklySchedule(branchId, cw, [m1, m2]), m1, 'Montag', monday);
    return buildScheduleRows(createWeekView(schedule, absences, { employees }), employees, WEEK_START, WEEK_END);
  }

  function absence(from: string, to: string): Absence {
    return {
      id: 'a1' as AbsenceId,
      employeeId: m1,
      type: 'Vacation',
      from,
      to,
      createdAt: '2026-01-01T00:00:00.000Z',
    };
  }

  it('accepts a plain editable cell', () => {
    const row = rowsWithAbsences([]).find((r) => r.employee.id === m1)!;
    expect(canReceiveEntry(row, row.view.days[0])).toBe(true);
  });

  it('accepts a cell carrying a single-day absence, which gets replaced', () => {
    const row = rowsWithAbsences([absence('2026-09-07', '2026-09-07')]).find((r) => r.employee.id === m1)!;
    expect(canReceiveEntry(row, row.view.days[0])).toBe(true);
  });

  it('refuses a cell inside a multi-day absence - those are only editable in the Abwesenheiten tab', () => {
    const row = rowsWithAbsences([absence('2026-09-07', '2026-09-09')]).find((r) => r.employee.id === m1)!;
    expect(canReceiveEntry(row, row.view.days[0])).toBe(false);
    expect(canReceiveEntry(row, row.view.days[2])).toBe(false);
    // Thursday is outside the range again.
    expect(canReceiveEntry(row, row.view.days[3])).toBe(true);
  });

  it('refuses every cell of a locked row', () => {
    const inactive = [employee(m1, { active: false }), employee(m2)];
    const schedule = withDayEntry(createWeeklySchedule(branchId, cw, [m1, m2]), m1, 'Montag', monday);
    const rows = buildScheduleRows(
      createWeekView(schedule, [], { employees: inactive }),
      inactive,
      WEEK_START,
      WEEK_END,
    );
    const row = rows.find((r) => r.employee.id === m1)!;
    expect(row.view.days.every((day) => !canReceiveEntry(row, day))).toBe(true);
  });
});
