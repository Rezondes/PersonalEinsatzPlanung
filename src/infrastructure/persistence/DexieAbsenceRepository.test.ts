import { describe, it, expect, beforeEach } from 'vitest';
import type { AbsenceId, EmployeeId } from '@domain/shared/ids';
import type { Absence } from '@domain/absence/Absence';
import { db } from './db';
import { DexieAbsenceRepository } from './DexieAbsenceRepository';

const e1 = 'e1' as EmployeeId;
const e2 = 'e2' as EmployeeId;
const e3 = 'e3' as EmployeeId;

const vacation: Absence = {
  id: 'a1' as AbsenceId,
  employeeId: e1,
  type: 'Vacation',
  from: '2026-09-07',
  to: '2026-09-11',
  createdAt: '2026-01-01T00:00:00.000Z',
};

const illness: Absence = {
  id: 'a2' as AbsenceId,
  employeeId: e2,
  type: 'Illness',
  from: '2026-09-08',
  to: '2026-09-08',
  createdAt: '2026-01-01T00:00:00.000Z',
};

const other: Absence = {
  id: 'a3' as AbsenceId,
  employeeId: e3,
  type: 'Other',
  label: 'Schulung',
  from: '2026-09-09',
  to: '2026-09-09',
  createdAt: '2026-01-01T00:00:00.000Z',
};

const repo = new DexieAbsenceRepository();

beforeEach(async () => {
  await db.absences.clear();
});

describe('DexieAbsenceRepository', () => {
  describe('findAll', () => {
    it('returns an empty array when nothing is stored', async () => {
      await expect(repo.findAll()).resolves.toEqual([]);
    });

    it('returns every stored absence', async () => {
      await db.absences.bulkPut([vacation, illness, other]);

      const all = await repo.findAll();
      expect(all).toHaveLength(3);
      expect(all).toEqual(expect.arrayContaining([vacation, illness, other]));
    });
  });

  describe('findByEmployee', () => {
    it('filters by the employeeId index', async () => {
      await db.absences.bulkPut([vacation, illness]);

      await expect(repo.findByEmployee(e1)).resolves.toEqual([vacation]);
      await expect(repo.findByEmployee(e2)).resolves.toEqual([illness]);
    });

    it('returns an empty array when the employee has no absences', async () => {
      await db.absences.bulkPut([vacation]);

      await expect(repo.findByEmployee(e2)).resolves.toEqual([]);
    });
  });

  describe('findByBranch', () => {
    it('returns the union of absences across the given employees', async () => {
      await db.absences.bulkPut([vacation, illness, other]);

      const result = await repo.findByBranch([e1, e3]);
      expect(result).toHaveLength(2);
      expect(result).toEqual(expect.arrayContaining([vacation, other]));
    });

    it('resolves to an empty array for an empty employeeIds list, without needing seeded data', async () => {
      await expect(repo.findByBranch([])).resolves.toEqual([]);
    });
  });

  describe('save', () => {
    it('inserts a new absence', async () => {
      await repo.save(vacation);

      await expect(repo.findAll()).resolves.toEqual([vacation]);
    });

    it('upserts when saving an absence with an existing id', async () => {
      await repo.save(vacation);
      const updated: Absence = { ...vacation, to: '2026-09-12' };

      await repo.save(updated);

      const all = await repo.findAll();
      expect(all).toHaveLength(1);
      expect(all[0]).toEqual(updated);
    });
  });

  describe('delete', () => {
    it('removes only the absence with the given id', async () => {
      await db.absences.bulkPut([vacation, illness]);

      await repo.delete(vacation.id);

      await expect(repo.findAll()).resolves.toEqual([illness]);
    });
  });

  describe('deleteAll', () => {
    it('clears every stored absence', async () => {
      await db.absences.bulkPut([vacation, illness, other]);

      await repo.deleteAll();

      await expect(repo.findAll()).resolves.toEqual([]);
    });
  });
});
