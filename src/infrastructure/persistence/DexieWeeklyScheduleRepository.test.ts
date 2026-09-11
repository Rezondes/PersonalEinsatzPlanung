import { describe, it, expect, beforeEach } from 'vitest';
import type { BranchId, WeeklyScheduleId, EmployeeId } from '@domain/shared/ids';
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

describe('DexieWeeklyScheduleRepository', () => {
  it('findAll returns every saved schedule', async () => {
    const repo = new DexieWeeklyScheduleRepository();
    const s1 = createWeeklySchedule(branchA, week37, [e1]);
    const s2 = createWeeklySchedule(branchB, week38, [e1]);
    await repo.save(s1);
    await repo.save(s2);

    const all = await repo.findAll();

    expect(all.map((s) => s.id).sort()).toEqual([s1.id, s2.id].sort());
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

  it('findById returns the matching schedule', async () => {
    const repo = new DexieWeeklyScheduleRepository();
    const schedule = createWeeklySchedule(branchA, week37, [e1]);
    await repo.save(schedule);

    await expect(repo.findById(schedule.id)).resolves.toEqual(schedule);
  });

  it('findById returns null when nothing matches', async () => {
    const repo = new DexieWeeklyScheduleRepository();

    await expect(repo.findById('missing' as WeeklyScheduleId)).resolves.toBeNull();
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

  it('save upserts an existing schedule', async () => {
    const repo = new DexieWeeklyScheduleRepository();
    const schedule = createWeeklySchedule(branchA, week37, [e1]);
    await repo.save(schedule);

    const updated = { ...schedule, plannedWeeklyRevenue: 12345 };
    await repo.save(updated);

    await expect(repo.findById(schedule.id)).resolves.toEqual(updated);
    await expect(repo.findAll()).resolves.toHaveLength(1);
  });

  it('delete removes only the targeted schedule', async () => {
    const repo = new DexieWeeklyScheduleRepository();
    const s1 = createWeeklySchedule(branchA, week37, [e1]);
    const s2 = createWeeklySchedule(branchA, week38, [e1]);
    await repo.save(s1);
    await repo.save(s2);

    await repo.delete(s1.id);

    await expect(repo.findById(s1.id)).resolves.toBeNull();
    await expect(repo.findById(s2.id)).resolves.toEqual(s2);
  });

  it('deleteAll clears every schedule', async () => {
    const repo = new DexieWeeklyScheduleRepository();
    await repo.save(createWeeklySchedule(branchA, week37, [e1]));
    await repo.save(createWeeklySchedule(branchB, week38, [e1]));

    await repo.deleteAll();

    await expect(repo.findAll()).resolves.toEqual([]);
  });

  it('transaction persists a write made inside it', async () => {
    const repo = new DexieWeeklyScheduleRepository();
    const schedule = createWeeklySchedule(branchA, week37, [e1]);

    await repo.transaction(() => repo.save(schedule));

    await expect(repo.findById(schedule.id)).resolves.toEqual(schedule);
  });
});
