import { describe, it, expect, vi } from 'vitest';
import type { BranchId, EmployeeId, WeeklyScheduleId } from '@domain/shared/ids';
import type { CalendarWeek } from '@domain/shared/CalendarWeek';
import { clockTime } from '@domain/shared/ClockTime';
import { createShift } from '@domain/schedule/Shift';
import type { Employee } from '@domain/employee/Employee';
import { createWeeklySchedule, withDayEntry, withTargetAdjustment } from '@domain/schedule/WeeklySchedule';
import type { WeeklyScheduleRepository } from '@application/ports/WeeklyScheduleRepository';
import type { EmployeeRepository } from '@application/ports/EmployeeRepository';
import { createScheduleService } from './scheduleService';

const branchId = 'b1' as BranchId;
const e1 = 'e1' as EmployeeId;
const e2 = 'e2' as EmployeeId;

/** KW 37/2026: Monday 2026-09-07 - Sunday 2026-09-13. */
const currentWeek: CalendarWeek = { year: 2026, week: 37 };
const previousWeek: CalendarWeek = { year: 2026, week: 36 };

function fakeScheduleRepo(overrides: Partial<WeeklyScheduleRepository> = {}): WeeklyScheduleRepository {
  return {
    findAll: vi.fn(),
    findByBranchAndWeek: vi.fn(async () => null),
    findByBranch: vi.fn(async () => []),
    findById: vi.fn(async () => null),
    save: vi.fn(async () => {}),
    delete: vi.fn(),
    deleteAll: vi.fn(),
    transaction: vi.fn((fn: () => Promise<unknown>) => fn()) as WeeklyScheduleRepository['transaction'],
    ...overrides,
  };
}

function employee(id: EmployeeId, overrides: Partial<Employee> = {}): Employee {
  return {
    id,
    branchId,
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

function fakeEmployeeRepo(employees: Employee[]): EmployeeRepository {
  return {
    findAll: vi.fn(),
    findByBranch: vi.fn(async () => employees),
    findById: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(),
    deleteAll: vi.fn(),
  };
}

describe('scheduleService.getOrCreate', () => {
  it('creates a new schedule containing only active, currently-employed employees', async () => {
    const scheduleRepo = fakeScheduleRepo();
    const employeeRepo = fakeEmployeeRepo([
      employee(e1),
      employee(e2, { active: false }),
      employee('e3' as EmployeeId, { exitDate: '2026-08-01' }),
    ]);

    const schedule = await createScheduleService(scheduleRepo, employeeRepo).getOrCreate(branchId, currentWeek);

    expect(schedule.employeeAssignments.map((a) => a.employeeId)).toEqual([e1]);
    expect(scheduleRepo.save).toHaveBeenCalledWith(schedule);
    expect(scheduleRepo.transaction).toHaveBeenCalled();
  });

  it('self-heals: appends empty assignments for employees hired after the schedule was created', async () => {
    const existing = createWeeklySchedule(branchId, currentWeek, [e1]);
    const scheduleRepo = fakeScheduleRepo({ findByBranchAndWeek: vi.fn(async () => existing) });
    const employeeRepo = fakeEmployeeRepo([employee(e1), employee(e2)]);

    const result = await createScheduleService(scheduleRepo, employeeRepo).getOrCreate(branchId, currentWeek);

    expect(result.employeeAssignments.map((a) => a.employeeId).sort()).toEqual([e1, e2].sort());
    expect(scheduleRepo.save).toHaveBeenCalledWith(result);
  });

  it('does not save again when every active employee already has an assignment', async () => {
    const existing = createWeeklySchedule(branchId, currentWeek, [e1]);
    const scheduleRepo = fakeScheduleRepo({ findByBranchAndWeek: vi.fn(async () => existing) });
    const employeeRepo = fakeEmployeeRepo([employee(e1)]);

    const result = await createScheduleService(scheduleRepo, employeeRepo).getOrCreate(branchId, currentWeek);

    expect(result).toBe(existing);
    expect(scheduleRepo.save).not.toHaveBeenCalled();
  });
});

describe('scheduleService.copyFromPreviousWeek', () => {
  it('returns the existing schedule unchanged if one already exists for that week', async () => {
    const existing = createWeeklySchedule(branchId, currentWeek, [e1]);
    const scheduleRepo = fakeScheduleRepo({ findByBranchAndWeek: vi.fn(async () => existing) });
    const employeeRepo = fakeEmployeeRepo([employee(e1)]);

    const result = await createScheduleService(scheduleRepo, employeeRepo).copyFromPreviousWeek(branchId, currentWeek);

    expect(result).toBe(existing);
    expect(scheduleRepo.save).not.toHaveBeenCalled();
  });

  it('carries over the previous week assignment for each active employee', async () => {
    const prevShift = withDayEntry(
      createWeeklySchedule(branchId, previousWeek, [e1]),
      e1,
      'Montag',
      { type: 'Shift', shifts: [createShift(clockTime('08:00'), clockTime('16:00'))] },
    );
    const scheduleRepo = fakeScheduleRepo({
      findByBranchAndWeek: vi.fn(async (_branchId: BranchId, cw: CalendarWeek) =>
        cw.week === previousWeek.week ? prevShift : null,
      ),
    });
    const employeeRepo = fakeEmployeeRepo([employee(e1), employee(e2)]);

    const result = await createScheduleService(scheduleRepo, employeeRepo).copyFromPreviousWeek(branchId, currentWeek);

    const e1Assignment = result.employeeAssignments.find((a) => a.employeeId === e1);
    const e2Assignment = result.employeeAssignments.find((a) => a.employeeId === e2);
    expect(e1Assignment?.days.Montag).toEqual(prevShift.employeeAssignments[0].days.Montag);
    expect(e2Assignment?.days.Montag).toEqual({ type: 'Off' });
    expect(scheduleRepo.save).toHaveBeenCalledWith(result);
  });

  it('does not carry over the previous week\'s targetAdjustmentMinutes (it was computed for THAT week, not this one)', async () => {
    const prevWithAdjustment = withTargetAdjustment(createWeeklySchedule(branchId, previousWeek, [e1]), e1, 90);
    const scheduleRepo = fakeScheduleRepo({
      findByBranchAndWeek: vi.fn(async (_branchId: BranchId, cw: CalendarWeek) =>
        cw.week === previousWeek.week ? prevWithAdjustment : null,
      ),
    });
    const employeeRepo = fakeEmployeeRepo([employee(e1)]);

    const result = await createScheduleService(scheduleRepo, employeeRepo).copyFromPreviousWeek(branchId, currentWeek);

    const e1Assignment = result.employeeAssignments.find((a) => a.employeeId === e1);
    expect(e1Assignment?.targetAdjustmentMinutes).toBeUndefined();
  });
});

describe('scheduleService other operations', () => {
  it('save bumps updatedAt and persists via the repository', async () => {
    const schedule = { ...createWeeklySchedule(branchId, currentWeek, [e1]), updatedAt: '2020-01-01T00:00:00.000Z' };
    const scheduleRepo = fakeScheduleRepo();
    const employeeRepo = fakeEmployeeRepo([]);

    const updated = await createScheduleService(scheduleRepo, employeeRepo).save(schedule);

    expect(updated.updatedAt).not.toBe(schedule.updatedAt);
    expect(scheduleRepo.save).toHaveBeenCalledWith(updated);
  });

  it('setDayEntryAndSave updates the day entry and saves the result', async () => {
    const schedule = createWeeklySchedule(branchId, currentWeek, [e1]);
    const scheduleRepo = fakeScheduleRepo();
    const employeeRepo = fakeEmployeeRepo([]);
    const entry = { type: 'Shift' as const, shifts: [createShift(clockTime('08:00'), clockTime('16:00'))] };

    const updated = await createScheduleService(scheduleRepo, employeeRepo).setDayEntryAndSave(
      schedule,
      e1,
      'Montag',
      entry,
    );

    expect(updated.employeeAssignments[0].days.Montag).toEqual(entry);
    expect(scheduleRepo.save).toHaveBeenCalledWith(updated);
  });

  it('forBranch, find and findForWeek delegate to the repository', async () => {
    const scheduleRepo = fakeScheduleRepo();
    const employeeRepo = fakeEmployeeRepo([]);
    const service = createScheduleService(scheduleRepo, employeeRepo);

    await service.forBranch(branchId);
    await service.find('w1' as WeeklyScheduleId);
    await service.findForWeek(branchId, previousWeek);

    expect(scheduleRepo.findByBranch).toHaveBeenCalledWith(branchId);
    expect(scheduleRepo.findById).toHaveBeenCalledWith('w1');
    expect(scheduleRepo.findByBranchAndWeek).toHaveBeenCalledWith(branchId, previousWeek);
  });

  it('applyTargetAdjustments applies every adjustment and saves once', async () => {
    const schedule = createWeeklySchedule(branchId, currentWeek, [e1, e2]);
    const scheduleRepo = fakeScheduleRepo();
    const employeeRepo = fakeEmployeeRepo([]);

    const updated = await createScheduleService(scheduleRepo, employeeRepo).applyTargetAdjustments(schedule, [
      { employeeId: e1, minutes: 30 },
      { employeeId: e2, minutes: -15 },
    ]);

    expect(updated.employeeAssignments.find((a) => a.employeeId === e1)?.targetAdjustmentMinutes).toBe(30);
    expect(updated.employeeAssignments.find((a) => a.employeeId === e2)?.targetAdjustmentMinutes).toBe(-15);
    expect(scheduleRepo.save).toHaveBeenCalledTimes(1);
    expect(scheduleRepo.save).toHaveBeenCalledWith(updated);
  });
});
