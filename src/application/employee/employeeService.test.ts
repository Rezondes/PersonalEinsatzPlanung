import { describe, it, expect, vi } from 'vitest';
import type { BranchId, EmployeeId } from '@domain/shared/ids';
import type { Employee } from '@domain/employee/Employee';
import type { EmployeeRepository } from '@application/ports/EmployeeRepository';
import { createEmployeeService } from './employeeService';

const branchId = 'b1' as BranchId;

function fakeRepo(): EmployeeRepository {
  return {
    findAll: vi.fn(),
    findByBranch: vi.fn(async () => []),
    findById: vi.fn(async () => null),
    save: vi.fn(async () => {}),
    delete: vi.fn(async () => {}),
    deleteAll: vi.fn(),
  };
}

function employee(overrides: Partial<Employee> = {}): Employee {
  return {
    id: 'm1' as EmployeeId,
    branchId,
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

describe('employeeService', () => {
  it('forBranch sorts the repository results by last name', async () => {
    const repo = fakeRepo();
    repo.findByBranch = vi.fn(async () => [
      employee({ id: 'm2' as EmployeeId, lastName: 'Zimmer', firstName: 'Bea' }),
      employee({ id: 'm1' as EmployeeId, lastName: 'Anders', firstName: 'Uwe' }),
    ]);

    const result = await createEmployeeService(repo).forBranch(branchId);

    expect(result.map((e) => e.lastName)).toEqual(['Anders', 'Zimmer']);
    expect(repo.findByBranch).toHaveBeenCalledWith(branchId);
  });

  it('find delegates to the repository', async () => {
    const repo = fakeRepo();
    await createEmployeeService(repo).find('m1' as EmployeeId);
    expect(repo.findById).toHaveBeenCalledWith('m1');
  });

  it('create builds a new Employee and saves it', async () => {
    const repo = fakeRepo();
    const created = await createEmployeeService(repo).create({
      branchId,
      lastName: 'Muster',
      firstName: 'Anna',
      jobTitle: 'Verkäuferin',
      employmentType: { type: 'FullTime', weeklyHours: 38 },
      vacationEntitlementPerYear: 28,
      holidayVacationHours: 7.6,
    });

    expect(created.id).toBeTruthy();
    expect(created.active).toBe(true);
    expect(repo.save).toHaveBeenCalledWith(created);
  });

  it('update saves the employee with a refreshed updatedAt', async () => {
    const repo = fakeRepo();
    const existing = employee();

    const updated = await createEmployeeService(repo).update({ ...existing, jobTitle: 'Kassiererin' });

    expect(updated.jobTitle).toBe('Kassiererin');
    expect(updated.updatedAt).not.toBe(existing.updatedAt);
    expect(repo.save).toHaveBeenCalledWith(updated);
  });

  it('changeActiveStatus flips active without hard-deleting', async () => {
    const repo = fakeRepo();
    const existing = employee({ active: true });

    const deactivated = await createEmployeeService(repo).changeActiveStatus(existing, false);

    expect(deactivated.active).toBe(false);
    expect(deactivated.id).toBe(existing.id);
    expect(repo.save).toHaveBeenCalledWith(deactivated);
    expect(repo.delete).not.toHaveBeenCalled();
  });

  it('delete calls the repository with the given id', async () => {
    const repo = fakeRepo();
    await createEmployeeService(repo).delete('m1' as EmployeeId);
    expect(repo.delete).toHaveBeenCalledWith('m1');
  });
});
