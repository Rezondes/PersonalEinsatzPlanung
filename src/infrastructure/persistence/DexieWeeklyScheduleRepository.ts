import type { BranchId, WeeklyScheduleId } from '@domain/shared/ids';
import type { CalendarWeek } from '@domain/shared/CalendarWeek';
import type { WeeklySchedule } from '@domain/schedule/WeeklySchedule';
import type { WeeklyScheduleRepository } from '@application/ports/WeeklyScheduleRepository';
import { db } from './db';

export class DexieWeeklyScheduleRepository implements WeeklyScheduleRepository {
  async findAll(): Promise<WeeklySchedule[]> {
    return db.weeklySchedules.toArray();
  }

  async findByBranchAndWeek(branchId: BranchId, cw: CalendarWeek): Promise<WeeklySchedule | null> {
    const hit = await db.weeklySchedules
      .where('[branchId+calendarWeek.year+calendarWeek.week]')
      .equals([branchId, cw.year, cw.week])
      .first();
    return hit ?? null;
  }

  async findByBranch(branchId: BranchId): Promise<WeeklySchedule[]> {
    return db.weeklySchedules.where('branchId').equals(branchId).toArray();
  }

  async findById(id: WeeklyScheduleId): Promise<WeeklySchedule | null> {
    return (await db.weeklySchedules.get(id)) ?? null;
  }

  async save(schedule: WeeklySchedule): Promise<void> {
    await db.weeklySchedules.put(schedule);
  }

  async delete(id: WeeklyScheduleId): Promise<void> {
    await db.weeklySchedules.delete(id);
  }

  async deleteAll(): Promise<void> {
    await db.weeklySchedules.clear();
  }

  transaction<T>(fn: () => Promise<T>): Promise<T> {
    return db.transaction('rw', db.weeklySchedules, fn);
  }
}
