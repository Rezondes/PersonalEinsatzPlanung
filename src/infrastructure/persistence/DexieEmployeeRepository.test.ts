import { describe, it, expect, beforeEach } from 'vitest';
import type { BranchId, EmployeeId } from '@domain/shared/ids';
import type { Employee } from '@domain/employee/Employee';
import { db } from './db';
import { DexieEmployeeRepository } from './DexieEmployeeRepository';

const branchA = 'branch-a' as BranchId;
const branchB = 'branch-b' as BranchId;

function employee(overrides: Partial<Employee> = {}): Employee {
  return {
    id: 'm1' as EmployeeId,
    branchId: branchA,
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

describe('DexieEmployeeRepository', () => {
  beforeEach(async () => {
    await db.employees.clear();
  });

  it('findAll returns everything regardless of branch', async () => {
    const repo = new DexieEmployeeRepository();
    await db.employees.bulkAdd([
      employee({ id: 'm1' as EmployeeId, branchId: branchA }),
      employee({ id: 'm2' as EmployeeId, branchId: branchB }),
    ]);

    const result = await repo.findAll();

    expect(result.map((e) => e.id).sort()).toEqual(['m1', 'm2']);
  });

  it('findByBranch returns only employees of the given branch', async () => {
    const repo = new DexieEmployeeRepository();
    await db.employees.bulkAdd([
      employee({ id: 'm1' as EmployeeId, branchId: branchA, lastName: 'Anders' }),
      employee({ id: 'm2' as EmployeeId, branchId: branchA, lastName: 'Berger' }),
      employee({ id: 'm3' as EmployeeId, branchId: branchB, lastName: 'Winter' }),
    ]);

    const result = await repo.findByBranch(branchA);

    expect(result.map((e) => e.id).sort()).toEqual(['m1', 'm2']);
    expect(result.every((e) => e.branchId === branchA)).toBe(true);
  });

  it('findByBranch returns an empty array when no employee matches', async () => {
    const repo = new DexieEmployeeRepository();
    await db.employees.add(employee({ id: 'm1' as EmployeeId, branchId: branchA }));

    const result = await repo.findByBranch(branchB);

    expect(result).toEqual([]);
  });

  it('findById returns the matching employee', async () => {
    const repo = new DexieEmployeeRepository();
    const existing = employee({ id: 'm1' as EmployeeId });
    await db.employees.add(existing);

    const result = await repo.findById('m1' as EmployeeId);

    expect(result).toEqual(existing);
  });

  it('findById returns null when nothing matches', async () => {
    const repo = new DexieEmployeeRepository();

    const result = await repo.findById('missing' as EmployeeId);

    expect(result).toBeNull();
  });

  it('save inserts a new employee', async () => {
    const repo = new DexieEmployeeRepository();
    const created = employee({ id: 'm1' as EmployeeId });

    await repo.save(created);

    expect(await db.employees.get('m1')).toEqual(created);
  });

  it('save upserts an existing employee', async () => {
    const repo = new DexieEmployeeRepository();
    await db.employees.add(employee({ id: 'm1' as EmployeeId, jobTitle: 'Verkäuferin' }));

    await repo.save(employee({ id: 'm1' as EmployeeId, jobTitle: 'Kassiererin' }));

    const result = await db.employees.get('m1');
    expect(result?.jobTitle).toBe('Kassiererin');
    expect(await db.employees.count()).toBe(1);
  });

  it('delete removes the employee with the given id', async () => {
    const repo = new DexieEmployeeRepository();
    await db.employees.bulkAdd([
      employee({ id: 'm1' as EmployeeId }),
      employee({ id: 'm2' as EmployeeId }),
    ]);

    await repo.delete('m1' as EmployeeId);

    expect(await db.employees.get('m1')).toBeUndefined();
    expect(await db.employees.get('m2')).toBeDefined();
  });

  it('deleteAll clears every employee', async () => {
    const repo = new DexieEmployeeRepository();
    await db.employees.bulkAdd([
      employee({ id: 'm1' as EmployeeId, branchId: branchA }),
      employee({ id: 'm2' as EmployeeId, branchId: branchB }),
    ]);

    await repo.deleteAll();

    expect(await db.employees.count()).toBe(0);
  });
});
