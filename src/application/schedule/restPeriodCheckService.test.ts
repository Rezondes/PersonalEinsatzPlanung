import { describe, it, expect, vi } from 'vitest';
import type { BranchId, EmployeeId, AbsenceId } from '@domain/shared/ids';
import type { CalendarWeek } from '@domain/shared/CalendarWeek';
import { clockTime } from '@domain/shared/ClockTime';
import { createShift } from '@domain/schedule/Shift';
import type { DayEntry } from '@domain/schedule/EmployeeWeekAssignment';
import { createWeeklySchedule, withDayEntry } from '@domain/schedule/WeeklySchedule';
import type { WeeklySchedule } from '@domain/schedule/WeeklySchedule';
import type { Absence } from '@domain/absence/Absence';
import type { WeeklyScheduleRepository } from '@application/ports/WeeklyScheduleRepository';
import { createRestPeriodCheckService } from './restPeriodCheckService';

const branchId = 'b1' as BranchId;
const m1 = 'm1' as EmployeeId;
const m2 = 'm2' as EmployeeId;
const m3 = 'm3' as EmployeeId;

/** KW 37/2026 starts Monday 2026-09-07; KW 36 ends Sunday 2026-09-06. */
const currentWeek: CalendarWeek = { year: 2026, week: 37 };
const previousWeek: CalendarWeek = { year: 2026, week: 36 };
const nextWeek: CalendarWeek = { year: 2026, week: 38 };

function shift(start: string, end: string): DayEntry {
  return { type: 'Shift', shifts: [createShift(clockTime(start), clockTime(end))] };
}

function fakeRepo(byWeek: Partial<Record<number, WeeklySchedule>>): WeeklyScheduleRepository {
  return {
    findByBranchAndWeek: vi.fn(async (_branchId: BranchId, cw: CalendarWeek) => byWeek[cw.week] ?? null),
    findAll: vi.fn(),
    findByBranch: vi.fn(),
    findById: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(),
    deleteAll: vi.fn(),
    transaction: vi.fn(),
  };
}

/** Sunday shift in the previous week followed by an early Monday shift: 10h59 of rest. */
function tightWeekBoundary() {
  const previous = withDayEntry(createWeeklySchedule(branchId, previousWeek, [m1, m2]), m1, 'Sonntag', shift('06:00', '14:00'));
  let current = createWeeklySchedule(branchId, currentWeek, [m1, m2]);
  current = withDayEntry(current, m1, 'Montag', shift('00:59', '09:00'));
  current = withDayEntry(current, m2, 'Montag', shift('00:59', '09:00'));
  return { previous, current };
}

describe('restPeriodCheckService.checkWeek', () => {
  it('loads the previous and next week once for the whole schedule, never per employee', async () => {
    const repo = fakeRepo({});
    const schedule = createWeeklySchedule(branchId, currentWeek, [m1, m2, m3]);

    await createRestPeriodCheckService(repo).checkWeek(schedule);

    expect(repo.findByBranchAndWeek).toHaveBeenCalledTimes(2);
    expect(repo.findByBranchAndWeek).toHaveBeenCalledWith(branchId, previousWeek);
    expect(repo.findByBranchAndWeek).toHaveBeenCalledWith(branchId, nextWeek);
    expect(repo.findByBranchAndWeek).not.toHaveBeenCalledWith(branchId, currentWeek);
  });

  it('reports a rest-period violation across the week boundary for the affected employee only', async () => {
    const { previous, current } = tightWeekBoundary();
    const repo = fakeRepo({ [previousWeek.week]: previous });

    const results = await createRestPeriodCheckService(repo).checkWeek(current);

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ rule: 'ArbZG_5_Ruhezeit', severity: 'error', employeeId: m1, date: '2026-09-07' });
  });

  it('validates the caller-supplied current week, even if the repository holds a stale copy', async () => {
    const { previous, current } = tightWeekBoundary();
    const staleCurrent = createWeeklySchedule(branchId, currentWeek, [m1, m2]);
    const repo = fakeRepo({ [previousWeek.week]: previous, [currentWeek.week]: staleCurrent });

    const results = await createRestPeriodCheckService(repo).checkWeek(current);

    expect(results).toHaveLength(1);
    expect(results[0].employeeId).toBe(m1);
  });

  it('ignores shifts on days covered by an absence', async () => {
    const { previous, current } = tightWeekBoundary();
    const repo = fakeRepo({ [previousWeek.week]: previous });
    const sickOnSunday: Absence = {
      id: 'a1' as AbsenceId,
      employeeId: m1,
      type: 'Illness',
      from: '2026-09-06',
      to: '2026-09-06',
      createdAt: '2026-09-01T00:00:00.000Z',
    };

    const results = await createRestPeriodCheckService(repo).checkWeek(current, [sickOnSunday]);

    expect(results).toHaveLength(0);
  });

  it('returns no results when the neighbouring weeks do not exist yet', async () => {
    const repo = fakeRepo({});
    const schedule = withDayEntry(createWeeklySchedule(branchId, currentWeek, [m1]), m1, 'Montag', shift('06:00', '14:00'));

    const results = await createRestPeriodCheckService(repo).checkWeek(schedule);

    expect(results).toEqual([]);
  });
});
