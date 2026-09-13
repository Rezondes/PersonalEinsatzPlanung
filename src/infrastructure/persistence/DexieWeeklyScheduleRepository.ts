import type { BranchId, WeeklyScheduleId } from '@domain/shared/ids';
import type { CalendarWeek } from '@domain/shared/CalendarWeek';
import type { WeeklySchedule } from '@domain/schedule/WeeklySchedule';
import type { WeeklyScheduleRepository } from '@application/ports/WeeklyScheduleRepository';
import { DexieCrudRepository } from './DexieCrudRepository';
import { db } from './db';

export class DexieWeeklyScheduleRepository
  extends DexieCrudRepository<WeeklySchedule, WeeklyScheduleId>
  implements WeeklyScheduleRepository
{
  constructor() {
    super(db.weeklySchedules);
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

  /** Narrower than db.ts's module-wide `transaction()` (which spans every store, for the JSON
   * import-replace use case): this one only ever needs to atomically group writes to this single
   * store (the undo/redo write queue in useScheduleHistory.ts). Dexie transactions nest via zone
   * tracking, so a caller already inside the wide transaction could still call this safely - but
   * this method itself can never be used to widen scope beyond weeklySchedules, which is exactly
   * what its two callers need and nothing more. */
  transaction<T>(fn: () => Promise<T>): Promise<T> {
    return db.transaction('rw', db.weeklySchedules, fn);
  }
}
