import { describe, it, expect, vi } from 'vitest';
import type { EmployeeId } from '@domain/shared/ids';
import type { Employee } from '@domain/employee/Employee';
import { createAbsence } from '@domain/absence/Absence';
import type { AbsenceRepository } from '@application/ports/AbsenceRepository';
import { holidaysForYearAndFederalState } from '@infrastructure/holidays/germanHolidays';
import { createHolidayBulkCreationService } from './holidayBulkCreation';

const e1 = 'e1' as EmployeeId;

function fakeRepo(): AbsenceRepository {
  return {
    findAll: vi.fn(),
    findById: vi.fn(async () => null),
    findByEmployee: vi.fn(async () => []),
    findByEmployeeIds: vi.fn(async () => []),
    save: vi.fn(async () => {}),
    delete: vi.fn(async () => {}),
    deleteAll: vi.fn(),
  };
}

function employee(overrides: Partial<Employee> = {}): Employee {
  return {
    id: e1,
    branchId: 'b1' as Employee['branchId'],
    lastName: 'Muster',
    firstName: 'Anna',
    jobTitle: 'Verkäuferin',
    employmentType: { type: 'FullTime', weeklyHours: 38 },
    vacationEntitlementPerYear: 28,
    holidayVacationHours: 7.6,
    active: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

const bayern2026 = holidaysForYearAndFederalState(2026, 'Bayern');

describe('createHolidaysForYear', () => {
  it('saves one PublicHoliday absence per holiday date for each given employee', async () => {
    const repo = fakeRepo();
    const activeEmp = employee();

    const result = await createHolidayBulkCreationService(repo).createHolidaysForYear(bayern2026, [activeEmp], []);

    expect(repo.save).toHaveBeenCalledTimes(bayern2026.size);
    expect(repo.save).toHaveBeenCalledWith(
      expect.objectContaining({ employeeId: e1, type: 'PublicHoliday', from: '2026-01-01', to: '2026-01-01' }),
    );
    // Bayern-specific: Fronleichnam (Corpus Christi) is in the table, Mariä Himmelfahrt is not
    // (only Saarland has it in germanHolidays.ts's simplified table).
    expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ from: '2026-06-04', to: '2026-06-04' }));
    expect([...bayern2026]).not.toContain('2026-08-15');
    expect(result).toEqual({ created: bayern2026.size, skipped: 0 });
  });

  it('skips a date where the employee already has a PublicHoliday absence, without creating a duplicate', async () => {
    const repo = fakeRepo();
    const activeEmp = employee();
    const existing = createAbsence({ employeeId: e1, type: 'PublicHoliday', from: '2026-01-01', to: '2026-01-01' });

    const result = await createHolidayBulkCreationService(repo).createHolidaysForYear(bayern2026, [activeEmp], [existing]);

    expect(repo.save).not.toHaveBeenCalledWith(expect.objectContaining({ from: '2026-01-01', to: '2026-01-01' }));
    expect(result).toEqual({ created: bayern2026.size - 1, skipped: 1 });
  });

  it('skips a date already covered by an unrelated existing absence (e.g. Vacation), using the raw overlap check', async () => {
    const repo = fakeRepo();
    const activeEmp = employee();
    const vacation = createAbsence({ employeeId: e1, type: 'Vacation', from: '2026-04-27', to: '2026-05-04' });

    const result = await createHolidayBulkCreationService(repo).createHolidaysForYear(bayern2026, [activeEmp], [vacation]);

    // Labor Day (2026-05-01) falls inside the vacation range and must be skipped.
    expect(repo.save).not.toHaveBeenCalledWith(expect.objectContaining({ from: '2026-05-01', to: '2026-05-01' }));
    expect(result).toEqual({ created: bayern2026.size - 1, skipped: 1 });
  });

  it('does not know what "active" means: it trusts the given employees list as-is', async () => {
    const repo = fakeRepo();
    const inactiveEmp = employee({ active: false });

    await createHolidayBulkCreationService(repo).createHolidaysForYear(bayern2026, [inactiveEmp], []);

    expect(repo.save).toHaveBeenCalledTimes(bayern2026.size);
  });

  it('skips holidays before the employee\'s entryDate, creates from entryDate onward', async () => {
    const repo = fakeRepo();
    // Hired the day after New Year - the 2026-01-01 holiday predates the employment, every later
    // holiday in the set does not.
    const lateHire = employee({ entryDate: '2026-01-02' });

    const result = await createHolidayBulkCreationService(repo).createHolidaysForYear(bayern2026, [lateHire], []);

    expect(repo.save).not.toHaveBeenCalledWith(expect.objectContaining({ from: '2026-01-01', to: '2026-01-01' }));
    expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ from: '2026-06-04', to: '2026-06-04' }));
    expect(result).toEqual({ created: bayern2026.size - 1, skipped: 1 });
  });

  it('creates absences for every employee in the list independently', async () => {
    const repo = fakeRepo();
    const e2 = 'e2' as EmployeeId;
    const empA = employee({ id: e1 });
    const empB = employee({ id: e2 });

    const result = await createHolidayBulkCreationService(repo).createHolidaysForYear(bayern2026, [empA, empB], []);

    expect(repo.save).toHaveBeenCalledTimes(bayern2026.size * 2);
    expect(result).toEqual({ created: bayern2026.size * 2, skipped: 0 });
  });
});
