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

// Generic findAll/findById/save/delete/deleteAll behavior is covered once, against a real table,
// in DexieCrudRepository.test.ts - this file only needs findByBranch plus a shape round-trip.
describe('DexieEmployeeRepository', () => {
  beforeEach(async () => {
    await db.employees.clear();
  });

  it('round-trips a full Employee through the real employees table', async () => {
    const repo = new DexieEmployeeRepository();
    const created = employee({ id: 'm1' as EmployeeId });

    await repo.save(created);

    await expect(repo.findById('m1' as EmployeeId)).resolves.toEqual(created);
  });

  describe('findByBranch', () => {
    it('returns only employees of the given branch', async () => {
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

    it('returns an empty array when no employee matches', async () => {
      const repo = new DexieEmployeeRepository();
      await db.employees.add(employee({ id: 'm1' as EmployeeId, branchId: branchA }));

      const result = await repo.findByBranch(branchB);

      expect(result).toEqual([]);
    });
  });
});
