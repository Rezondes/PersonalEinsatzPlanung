import { describe, it, expect } from 'vitest';
import type { BranchId, EmployeeId } from '@domain/shared/ids';
import type { Employee } from '@domain/employee/Employee';
import type { CalendarWeek } from '@domain/shared/CalendarWeek';
import type { MonthRow } from '@application/schedule/scheduleAssessment';
import { buildMonthCsv } from './monthCsvExport';

const branchId = 'b1' as BranchId;

function employee(id: string, lastName: string, firstName: string, overrides: Partial<Employee> = {}): Employee {
  return {
    id: id as EmployeeId,
    branchId,
    lastName,
    firstName,
    jobTitle: 'Verkauf',
    employmentType: { type: 'FullTime', weeklyHours: 37.5 },
    vacationEntitlementPerYear: 28,
    holidayVacationHours: 6.25,
    active: true,
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

const weeks: CalendarWeek[] = [
  { year: 2026, week: 10 },
  { year: 2026, week: 11 },
  { year: 2026, week: 12 },
];

function monthRow(employeeId: EmployeeId, weekHours: number[], totalHours: number): MonthRow {
  return {
    employeeId,
    weeks: weeks.map((cw, i) => ({ calendarWeek: cw, totalNetMinutes: weekHours[i] * 60 })),
    totalNetMinutes: totalHours * 60,
  };
}

const BOM = String.fromCharCode(0xfeff);

function bomless(result: string): string {
  return result.startsWith(BOM) ? result.slice(BOM.length) : result;
}

describe('buildMonthCsv', () => {
  it('builds a semicolon-separated header and one data row per employee, hours as German decimal-comma with two places', () => {
    const e1 = employee('e1', 'Müller', 'Anna');
    const e2 = employee('e2', 'Schulz', 'Bernd', { employmentType: { type: 'PartTime', weeklyHours: 20 } });
    const rows = [monthRow(e1.id, [37.5, 30, 40], 107.5), monthRow(e2.id, [20, 0, 10], 30)];

    const lines = bomless(buildMonthCsv(rows, [e1, e2], weeks)).split('\r\n');

    expect(lines[0]).toBe('Mitarbeiter;Soll-Woche;KW 10;KW 11;KW 12;Gesamt Monat');
    expect(lines[1]).toBe('Müller, Anna;37,5;37,50;30,00;40,00;107,50');
    expect(lines[2]).toBe('Schulz, Bernd;20;20,00;0,00;10,00;30,00');
  });

  it('still lists an active employee with no MonthRow at all, as 0,00 in every column instead of dropping the row', () => {
    const e1 = employee('e1', 'Müller', 'Anna');

    const lines = bomless(buildMonthCsv([], [e1], weeks)).split('\r\n');

    expect(lines[1]).toBe('Müller, Anna;37,5;0,00;0,00;0,00;0,00');
  });

  it('quotes an employee name containing a semicolon or a double quote, doubling internal quotes (RFC 4180)', () => {
    const e1 = employee('e1', 'Mu;ller', 'A"nna');

    const lines = bomless(buildMonthCsv([], [e1], weeks)).split('\r\n');

    expect(lines[1]).toBe('"Mu;ller, A""nna";37,5;0,00;0,00;0,00;0,00');
  });

  it('starts with a UTF-8 BOM, so Excel on Windows reads Umlaute correctly on double-click', () => {
    const result = buildMonthCsv([], [], weeks);
    expect(result.charCodeAt(0)).toBe(0xfeff);
  });

  it('shows the Minijob Soll-Woche band as a hyphenated range, not a single figure', () => {
    const e1 = employee('e1', 'Klein', 'Carla', { employmentType: { type: 'Minijob', minHours: 6, maxHours: 10 } });

    const lines = bomless(buildMonthCsv([], [e1], weeks)).split('\r\n');

    expect(lines[1]).toBe('Klein, Carla;6-10;0,00;0,00;0,00;0,00');
  });
});
