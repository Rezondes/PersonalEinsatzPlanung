import type { BranchId, WeeklyScheduleId } from '@domain/shared/ids';
import type { CalendarWeek } from '@domain/shared/CalendarWeek';
import type { WeeklySchedule } from '@domain/schedule/WeeklySchedule';

export interface WeeklyScheduleRepository {
  findAll(): Promise<WeeklySchedule[]>;
  findByBranchAndWeek(branchId: BranchId, cw: CalendarWeek): Promise<WeeklySchedule | null>;
  findByBranch(branchId: BranchId): Promise<WeeklySchedule[]>;
  findById(id: WeeklyScheduleId): Promise<WeeklySchedule | null>;
  save(schedule: WeeklySchedule): Promise<void>;
  delete(id: WeeklyScheduleId): Promise<void>;
  deleteAll(): Promise<void>;
  /** Runs `fn` inside a single atomic transaction over the WeeklySchedule store. Needed for
   * find-or-create logic (getOrCreate): without it, two concurrent calls for the same
   * (branchId, CalendarWeek) could both see "not found" and each create a duplicate schedule. */
  transaction<T>(fn: () => Promise<T>): Promise<T>;
}
