import { describe, it, expect } from 'vitest';
import type { BranchId, EmployeeId, AbsenceId } from '@domain/shared/ids';
import { clockTime } from '@domain/shared/ClockTime';
import { createShift } from '@domain/schedule/Shift';
import { createWeeklySchedule, withDayEntry } from '@domain/schedule/WeeklySchedule';
import type { Employee } from '@domain/employee/Employee';
import type { Absence } from '@domain/absence/Absence';
import { preparePrintData } from './printDataPreparation';

const branchId = 'b1' as BranchId;
const m1 = 'm1' as EmployeeId;
const m2 = 'm2' as EmployeeId;

/** KW 37/2026: Monday 2026-09-07 to Sunday 2026-09-13. */
const cw = { year: 2026, week: 37 };

function employee(id: EmployeeId, lastName: string, overrides: Partial<Employee> = {}): Employee {
  return {
    id,
    branchId,
    lastName,
    firstName: 'Anna',
    jobTitle: 'Verkauf',
    employmentType: { type: 'PartTime', weeklyHours: 30 },
    vacationEntitlementPerYear: 30,
    holidayVacationHours: 5,
    active: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

const mondayShift = {
  type: 'Shift' as const,
  shifts: [createShift(clockTime('06:00'), clockTime('14:00'))],
};

function vacationOn(employeeId: EmployeeId, date: string): Absence {
  return {
    id: 'a1' as AbsenceId,
    employeeId,
    type: 'Vacation',
    from: date,
    to: date,
    createdAt: '2026-01-01T00:00:00.000Z',
  };
}

/** m1 works Monday; m2 has nothing entered. */
const scheduleWithMondayForM1 = withDayEntry(
  createWeeklySchedule(branchId, cw, [m1, m2]),
  m1,
  'Montag',
  mondayShift,
);

describe('preparePrintData - who gets a column', () => {
  it('prints every employee who may still be scheduled', () => {
    const data = preparePrintData(scheduleWithMondayForM1, [employee(m1, 'Müller'), employee(m2, 'Schulz')], []);
    expect(data.fullPartTimeRows.map((r) => r.employee.lastName)).toEqual(['Müller', 'Schulz']);
  });

  it('skips an inactive employee with nothing recorded, so no column is wasted', () => {
    const data = preparePrintData(
      scheduleWithMondayForM1,
      [employee(m1, 'Müller'), employee(m2, 'Schulz', { active: false })],
      [],
    );
    expect(data.fullPartTimeRows.map((r) => r.employee.lastName)).toEqual(['Müller']);
  });

  it('keeps an inactive employee who still has entries', () => {
    const data = preparePrintData(
      scheduleWithMondayForM1,
      [employee(m1, 'Müller', { active: false }), employee(m2, 'Schulz')],
      [],
    );
    expect(data.fullPartTimeRows.map((r) => r.employee.lastName)).toEqual(['Müller', 'Schulz']);
  });

  it('keeps someone outside their employment period while an absence is recorded for them', () => {
    const data = preparePrintData(
      scheduleWithMondayForM1,
      [employee(m1, 'Müller'), employee(m2, 'Schulz', { exitDate: '2026-08-31' })],
      [vacationOn(m2, '2026-09-08')],
    );
    expect(data.fullPartTimeRows.map((r) => r.employee.lastName)).toEqual(['Müller', 'Schulz']);
  });

  it('skips someone whose employment does not cover the week and has nothing recorded', () => {
    const data = preparePrintData(
      scheduleWithMondayForM1,
      [employee(m1, 'Müller'), employee(m2, 'Schulz', { entryDate: '2026-10-01' })],
      [],
    );
    expect(data.fullPartTimeRows.map((r) => r.employee.lastName)).toEqual(['Müller']);
  });
});

describe('preparePrintData - hours on paper are worked hours', () => {
  const employees = [employee(m1, 'Müller'), employee(m2, 'Schulz')];

  it('sums only worked hours per weekday and per employee', () => {
    const data = preparePrintData(scheduleWithMondayForM1, employees, []);
    expect(data.dayTotals.Montag).toBe(8);
    expect(data.dayTotals.Dienstag).toBe(0);
    expect(data.fullPartTimeRows[0].totalHoursWeek).toBe('8,00');
  });

  it('leaves credited vacation hours out of both, so the sheet still adds up', () => {
    // Tuesday is a vacation day worth 5 credited hours; on screen the employee has 13.
    const data = preparePrintData(scheduleWithMondayForM1, employees, [vacationOn(m1, '2026-09-08')]);
    expect(data.dayTotals.Dienstag).toBe(0);
    expect(data.fullPartTimeRows[0].totalHoursWeek).toBe('8,00');
    expect(data.fullPartTimeRows[0].days.Dienstag.absenceAbbreviation).toBe('U');
  });

  it('uses the manual day override for the printed hours', () => {
    const overridden = withDayEntry(scheduleWithMondayForM1, m1, 'Montag', {
      ...mondayShift,
      netMinutesOverride: 6 * 60,
    });
    const data = preparePrintData(overridden, employees, []);
    expect(data.dayTotals.Montag).toBe(6);
    expect(data.fullPartTimeRows[0].days.Montag.hoursText).toBe('6,00');
    expect(data.fullPartTimeRows[0].totalHoursWeek).toBe('6,00');
  });
});
