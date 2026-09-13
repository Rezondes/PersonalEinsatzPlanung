import { describe, it, expect, beforeEach } from 'vitest';
import type { BranchId, EmployeeId } from '@domain/shared/ids';
import type { CalendarWeek } from '@domain/shared/CalendarWeek';
import { createWeeklySchedule } from '@domain/schedule/WeeklySchedule';
import { db } from './db';
import { DexieWeeklyScheduleRepository } from './DexieWeeklyScheduleRepository';

const branchA = 'branchA' as BranchId;
const branchB = 'branchB' as BranchId;
const e1 = 'e1' as EmployeeId;

const week37: CalendarWeek = { year: 2026, week: 37 };
const week38: CalendarWeek = { year: 2026, week: 38 };

beforeEach(async () => {
  await db.weeklySchedules.clear();
});

// Generic findAll/findById/save/delete/deleteAll behavior is covered once, against a real table,
// in DexieCrudRepository.test.ts - this file only needs findByBranch, findByBranchAndWeek and this
// repository's own transaction() method.
describe('DexieWeeklyScheduleRepository', () => {
  it('round-trips a full WeeklySchedule through the real weeklySchedules table', async () => {
    const repo = new DexieWeeklyScheduleRepository();
    const schedule = createWeeklySchedule(branchA, week37, [e1]);

    await repo.save(schedule);

    await expect(repo.findById(schedule.id)).resolves.toEqual(schedule);
  });

  it('findByBranch returns only schedules for that branch', async () => {
    const repo = new DexieWeeklyScheduleRepository();
    const s1 = createWeeklySchedule(branchA, week37, [e1]);
    const s2 = createWeeklySchedule(branchA, week38, [e1]);
    const s3 = createWeeklySchedule(branchB, week37, [e1]);
    await repo.save(s1);
    await repo.save(s2);
    await repo.save(s3);

    const forBranchA = await repo.findByBranch(branchA);

    expect(forBranchA.map((s) => s.id).sort()).toEqual([s1.id, s2.id].sort());
  });

  describe('findByBranchAndWeek', () => {
    it('uses the compound index to discriminate on branch and week together', async () => {
      const repo = new DexieWeeklyScheduleRepository();
      const branchAWeek37 = createWeeklySchedule(branchA, week37, [e1]);
      const branchAWeek38 = createWeeklySchedule(branchA, week38, [e1]);
      const branchBWeek37 = createWeeklySchedule(branchB, week37, [e1]);
      await repo.save(branchAWeek37);
      await repo.save(branchAWeek38);
      await repo.save(branchBWeek37);

      const hit = await repo.findByBranchAndWeek(branchA, week37);

      expect(hit).toEqual(branchAWeek37);
    });

    it('returns null for a (branch, week) combination that was never saved', async () => {
      const repo = new DexieWeeklyScheduleRepository();
      await repo.save(createWeeklySchedule(branchA, week37, [e1]));

      await expect(repo.findByBranchAndWeek(branchB, week38)).resolves.toBeNull();
    });

    it('returns null when the branch matches but the week does not', async () => {
      const repo = new DexieWeeklyScheduleRepository();
      await repo.save(createWeeklySchedule(branchA, week37, [e1]));

      await expect(repo.findByBranchAndWeek(branchA, week38)).resolves.toBeNull();
    });

    it('returns null when the week matches but the branch does not', async () => {
      const repo = new DexieWeeklyScheduleRepository();
      await repo.save(createWeeklySchedule(branchA, week37, [e1]));

      await expect(repo.findByBranchAndWeek(branchB, week37)).resolves.toBeNull();
    });
  });

  it('transaction persists a write made inside it', async () => {
    const repo = new DexieWeeklyScheduleRepository();
    const schedule = createWeeklySchedule(branchA, week37, [e1]);

    await repo.transaction(() => repo.save(schedule));

    await expect(repo.findById(schedule.id)).resolves.toEqual(schedule);
  });
});
