import type { BranchId, EmployeeId, WeeklyScheduleId } from '@domain/shared/ids';
import type { CalendarWeek, Weekday } from '@domain/shared/CalendarWeek';
import { dateForWeekday, mondayOfWeek, previousCalendarWeek } from '@domain/shared/CalendarWeek';
import { toISODate } from '@domain/shared/DateFormat';
import { isPlannable } from '@domain/employee/Employee';
import type { WeeklySchedule } from '@domain/schedule/WeeklySchedule';
import { createWeeklySchedule, withDayEntry, withTargetAdjustment } from '@domain/schedule/WeeklySchedule';
import type { DayEntry } from '@domain/schedule/EmployeeWeekAssignment';
import { emptyWeekAssignment } from '@domain/schedule/EmployeeWeekAssignment';
import type { WeeklyScheduleRepository } from '@application/ports/WeeklyScheduleRepository';
import type { EmployeeRepository } from '@application/ports/EmployeeRepository';

export function createScheduleService(repo: WeeklyScheduleRepository, employeeRepo: EmployeeRepository) {
  /** Who may be scheduled in that week: active, and their employment period actually overlaps it.
   * Someone who left last year is not silently added to next year's schedules, and a new hire is
   * not added to weeks before their first day. */
  async function plannableEmployeeIds(branchId: BranchId, cw: CalendarWeek): Promise<EmployeeId[]> {
    const employeeList = await employeeRepo.findByBranch(branchId);
    const from = toISODate(mondayOfWeek(cw));
    const to = toISODate(dateForWeekday(cw, 'Sonntag'));
    return employeeList.filter((e) => isPlannable(e, from, to)).map((e) => e.id);
  }

  return {
    /** Loads the weekly schedule for (branchId, cw), creating an empty schedule for all active
     * employees of the branch if needed and saving it immediately. Employees hired AFTER the
     * schedule was created are automatically appended with an empty assignment on load ("self
     * healing"), so newly hired employees don't have to be manually added to every existing
     * weekly schedule. */
    getOrCreate: async (branchId: BranchId, cw: CalendarWeek): Promise<WeeklySchedule> => {
      const activeIds = await plannableEmployeeIds(branchId, cw);

      // find + conditional create must be one atomic unit: without the transaction, two concurrent
      // calls for the same (branchId, cw) could both read "not found" and each save a new schedule,
      // creating a duplicate aggregate for the same week.
      return repo.transaction(async () => {
        const existing = await repo.findByBranchAndWeek(branchId, cw);

        if (existing) {
          const missingIds = activeIds.filter(
            (id) => !existing.employeeAssignments.some((a) => a.employeeId === id),
          );
          if (missingIds.length === 0) {
            return existing;
          }
          const completed: WeeklySchedule = {
            ...existing,
            employeeAssignments: [...existing.employeeAssignments, ...missingIds.map(emptyWeekAssignment)],
          };
          await repo.save(completed);
          return completed;
        }

        const schedule = createWeeklySchedule(branchId, cw, activeIds);
        await repo.save(schedule);
        return schedule;
      });
    },

    /** Creates a new weekly schedule and carries over the previous week's shifts as a starting point
     * (useful for recurring schedules). Existing schedules are never overwritten. */
    copyFromPreviousWeek: async (branchId: BranchId, cw: CalendarWeek): Promise<WeeklySchedule> => {
      const activeIds = await plannableEmployeeIds(branchId, cw);

      return repo.transaction(async () => {
        const existing = await repo.findByBranchAndWeek(branchId, cw);
        if (existing) {
          return existing;
        }

        const previousWeek = await repo.findByBranchAndWeek(branchId, previousCalendarWeek(cw));

        const employeeAssignments = activeIds.map((employeeId) => {
          const previousWeekAssignment = previousWeek?.employeeAssignments.find((a) => a.employeeId === employeeId);
          if (!previousWeekAssignment) {
            return emptyWeekAssignment(employeeId);
          }
          // targetAdjustmentMinutes was computed FOR the previous week from the week before that -
          // it is meaningless carried into a new week and must not come along with the copied days.
          return { ...previousWeekAssignment, targetAdjustmentMinutes: undefined };
        });

        const schedule: WeeklySchedule = { ...createWeeklySchedule(branchId, cw, []), employeeAssignments };
        await repo.save(schedule);
        return schedule;
      });
    },

    save: async (schedule: WeeklySchedule): Promise<WeeklySchedule> => {
      const updated: WeeklySchedule = { ...schedule, updatedAt: new Date().toISOString() };
      await repo.save(updated);
      return updated;
    },

    setDayEntryAndSave: async (
      schedule: WeeklySchedule,
      employeeId: EmployeeId,
      day: Weekday,
      entry: DayEntry,
    ): Promise<WeeklySchedule> => {
      const updated = withDayEntry(schedule, employeeId, day, entry);
      await repo.save(updated);
      return updated;
    },

    forBranch: (branchId: BranchId) => repo.findByBranch(branchId),

    find: (id: WeeklyScheduleId) => repo.findById(id),

    /** Reads the schedule for exactly (branchId, cw) without creating one if it's missing - unlike
     * getOrCreate, used e.g. to look at the previous week's schedule without side effects. */
    findForWeek: (branchId: BranchId, cw: CalendarWeek) => repo.findByBranchAndWeek(branchId, cw),

    /** Applies a batch of target-hours carry-over adjustments (see withTargetAdjustment) and saves the
     * schedule once. */
    applyTargetAdjustments: async (
      schedule: WeeklySchedule,
      adjustments: { employeeId: EmployeeId; minutes: number }[],
    ): Promise<WeeklySchedule> => {
      const updated = adjustments.reduce(
        (intermediate, { employeeId, minutes }) => withTargetAdjustment(intermediate, employeeId, minutes),
        schedule,
      );
      await repo.save(updated);
      return updated;
    },
  };
}

export type ScheduleService = ReturnType<typeof createScheduleService>;
