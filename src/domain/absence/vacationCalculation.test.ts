import { describe, it, expect } from 'vitest';
import type { EmployeeId } from '@domain/shared/ids';
import { createAbsence } from './Absence';
import type { AbsenceId } from '@domain/shared/ids';
import type { Absence } from './Absence';
import {
  countWorkDays,
  countVacationDaysInYear,
  calculateRemainingVacation,
  remainingVacationByEmployee,
} from './vacationCalculation';

const m1 = 'm1' as EmployeeId;

describe('countWorkDays', () => {
  it('counts Mon-Sat as work days and excludes Sunday', () => {
    // 2026-09-07 = Monday, 2026-09-13 = Sunday -> full week
    expect(countWorkDays('2026-09-07', '2026-09-13')).toBe(6);
  });

  it('counts a single work day as 1', () => {
    expect(countWorkDays('2026-09-07', '2026-09-07')).toBe(1);
  });

  it('accounts for half-days at start and end', () => {
    expect(countWorkDays('2026-09-07', '2026-09-09', { atStart: true, atEnd: false })).toBe(2.5);
    expect(countWorkDays('2026-09-07', '2026-09-09', { atStart: false, atEnd: true })).toBe(2.5);
  });

  it('counts a single half-day as 0.5, not 0, even if both flags are set', () => {
    expect(countWorkDays('2026-09-07', '2026-09-07', { atStart: true, atEnd: false })).toBe(0.5);
    expect(countWorkDays('2026-09-07', '2026-09-07', { atStart: false, atEnd: true })).toBe(0.5);
    expect(countWorkDays('2026-09-07', '2026-09-07', { atStart: true, atEnd: true })).toBe(0.5);
  });

  it('does not count a holiday as a vacation day when isHoliday is given', () => {
    // 2026-10-03 (Sat) = Tag der Deutschen Einheit, national holiday
    const isHoliday = (d: string) => d === '2026-10-03';
    expect(countWorkDays('2026-09-30', '2026-10-03', undefined, isHoliday)).toBe(3); // Wed,Thu,Fri work, Sat is a holiday
    expect(countWorkDays('2026-09-30', '2026-10-03')).toBe(4); // without isHoliday, Saturday counts normally
  });
});

describe('countVacationDaysInYear', () => {
  it('sums only absences of type Vacation within the given year', () => {
    const absences = [
      createAbsence({ employeeId: m1, type: 'Vacation', from: '2026-09-07', to: '2026-09-11' }), // 5 work days
      createAbsence({ employeeId: m1, type: 'Illness', from: '2026-03-01', to: '2026-03-03' }),
      createAbsence({ employeeId: m1, type: 'Vacation', from: '2025-12-01', to: '2025-12-05' }), // different year
    ];
    expect(countVacationDaysInYear(absences, 2026)).toBe(5);
  });

  it('splits an absence crossing a year boundary correctly across both years', () => {
    // 2026-12-29 (Tue) - 2027-01-02 (Sat): 3 work days in 2026 (Tue,Wed,Thu), 2 work days in 2027 (Fri,Sat)
    const absences = [createAbsence({ employeeId: m1, type: 'Vacation', from: '2026-12-29', to: '2027-01-02' })];
    expect(countVacationDaysInYear(absences, 2026)).toBe(3);
    expect(countVacationDaysInYear(absences, 2027)).toBe(2);
  });

  it('applies half-days at a year boundary only to the real start/end date, not the clip point', () => {
    const absences = [
      createAbsence({
        employeeId: m1,
        type: 'Vacation',
        from: '2026-12-30',
        to: '2027-01-04',
        halfDay: { atStart: true, atEnd: true },
      }),
    ];
    // 2026-12-30 (Wed, half-day) - 2026-12-31 (Thu) = 1.5 work days in 2026
    expect(countVacationDaysInYear(absences, 2026)).toBe(1.5);
    // 2027-01-01 (Fri) - 2027-01-04 (Mon, half-day), Sunday excluded = 3 work days - 0.5 = 2.5 in 2027
    expect(countVacationDaysInYear(absences, 2027)).toBe(2.5);
  });
});

describe('calculateRemainingVacation', () => {
  it('subtracts taken days from the yearly entitlement', () => {
    expect(calculateRemainingVacation({ vacationEntitlementPerYear: 28 }, 10)).toBe(18);
  });
});

describe('remainingVacationByEmployee', () => {
  const m1 = 'm1' as EmployeeId;
  const m2 = 'm2' as EmployeeId;

  function vacation(employeeId: EmployeeId, from: string, to: string): Absence {
    return { id: `${employeeId}-${from}` as AbsenceId, employeeId, type: 'Vacation', from, to, createdAt: '2026-01-01T00:00:00.000Z' };
  }

  it('attributes each absence to its own employee', () => {
    const result = remainingVacationByEmployee(
      [
        { id: m1, vacationEntitlementPerYear: 30 },
        { id: m2, vacationEntitlementPerYear: 28 },
      ],
      [
        vacation(m1, '2026-03-02', '2026-03-06'), // Mon-Fri: 5 work days
        vacation(m2, '2026-07-06', '2026-07-07'), // Mon-Tue: 2 work days
        { ...vacation(m2, '2026-08-03', '2026-08-03'), type: 'Illness' }, // not vacation
      ],
      2026,
    );

    expect(result.get(m1)).toBe(25);
    expect(result.get(m2)).toBe(26);
  });

  it('yields the full entitlement for an employee without absences', () => {
    const result = remainingVacationByEmployee([{ id: m1, vacationEntitlementPerYear: 30 }], [], 2026);
    expect(result.get(m1)).toBe(30);
  });

  it('ignores absences of employees that are not in the list', () => {
    const result = remainingVacationByEmployee(
      [{ id: m1, vacationEntitlementPerYear: 30 }],
      [vacation(m2, '2026-03-02', '2026-03-06')],
      2026,
    );
    expect(result.size).toBe(1);
    expect(result.get(m1)).toBe(30);
  });
});
