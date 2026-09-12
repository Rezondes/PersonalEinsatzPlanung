import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { BranchId, EmployeeId, AbsenceId } from '@domain/shared/ids';
import type { CalendarWeek } from '@domain/shared/CalendarWeek';
import { clockTime } from '@domain/shared/ClockTime';
import { createShift } from '@domain/schedule/Shift';
import type { DayEntry } from '@domain/schedule/EmployeeWeekAssignment';
import { createWeeklySchedule, withDayEntry } from '@domain/schedule/WeeklySchedule';
import type { WeeklySchedule } from '@domain/schedule/WeeklySchedule';
import type { Absence } from '@domain/absence/Absence';
import type { Branch } from '@domain/branch/Branch';
import { emptyAddress } from '@domain/branch/Address';
import type { ValidationResult } from '@domain/validation/ValidationResult';
import { services } from '@infrastructure/services';
import { useScheduleValidation } from './useScheduleValidation';

vi.mock('@infrastructure/services', () => ({
  services: { restPeriodCheck: { checkWeek: vi.fn() }, employee: { forBranch: vi.fn() } },
}));

const checkWeekMock = vi.mocked(services.restPeriodCheck.checkWeek);
const employeeForBranchMock = vi.mocked(services.employee.forBranch);

const branchId = 'b1' as BranchId;
const m1 = 'm1' as EmployeeId;
const m2 = 'm2' as EmployeeId;

/** KW 37/2026 starts Monday 2026-09-07 (same fixture week as restPeriodCheckService.test.ts) -
 * no German public holiday and not a Sunday, so it triggers neither of those unrelated warnings. */
const week: CalendarWeek = { year: 2026, week: 37 };

function shiftEntry(start: string, end: string): DayEntry {
  return { type: 'Shift', shifts: [createShift(clockTime(start), clockTime(end))] };
}

function makeBranch(overrides: Partial<Branch> = {}): Branch {
  return {
    id: branchId,
    name: 'Filiale Nord',
    branchNumber: '001',
    address: emptyAddress(),
    logoBase64: null,
    federalState: 'Bayern',
    allowedOpenSundays: [],
    active: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

// Shared, never-mutated fixtures. The hook's effect depends on [schedule, branch, absences] BY
// REFERENCE, and its own setResults(...) call re-renders the renderHook wrapper on every check -
// so a callback that builds a fresh branch/[] object on every invocation (e.g. `() =>
// useScheduleValidation(schedule, makeBranch(), [])`) never produces a stable dependency array and
// spins forever. Every render callback below closes over these same references instead.
const defaultBranch = makeBranch();
const EMPTY_ABSENCES: Absence[] = [];

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

describe('useScheduleValidation', () => {
  beforeEach(() => {
    checkWeekMock.mockReset();
    employeeForBranchMock.mockReset();
    employeeForBranchMock.mockResolvedValue([]);
  });

  it('resolves to an empty array without calling checkWeek when schedule or branch is null', async () => {
    const schedule = createWeeklySchedule(branchId, week, [m1]);

    const { result, rerender } = renderHook(
      (props: { schedule: WeeklySchedule | null; branch: Branch | null }) =>
        useScheduleValidation(props.schedule, props.branch, EMPTY_ABSENCES),
      { initialProps: { schedule: null as WeeklySchedule | null, branch: defaultBranch as Branch | null } },
    );

    await waitFor(() => expect(result.current).toEqual([]));
    expect(checkWeekMock).not.toHaveBeenCalled();

    rerender({ schedule, branch: null });

    await waitFor(() => expect(result.current).toEqual([]));
    expect(checkWeekMock).not.toHaveBeenCalled();
  });

  it('merges a sync ArbZG violation with the async rest-period result', async () => {
    const schedule = withDayEntry(
      createWeeklySchedule(branchId, week, [m1]),
      m1,
      'Montag',
      shiftEntry('06:00', '18:00'), // 12h, no breaks -> daily-time error (>10h)
    );
    const asyncMarker: ValidationResult = {
      rule: 'ArbZG_5_Ruhezeit',
      severity: 'error',
      message: 'Async-Markierung',
      employeeId: m1,
      date: '2026-09-07',
    };
    checkWeekMock.mockResolvedValue([asyncMarker]);

    const { result } = renderHook(() => useScheduleValidation(schedule, defaultBranch, EMPTY_ABSENCES));

    await waitFor(() => expect(result.current).toContainEqual(asyncMarker));
    expect(result.current).toContainEqual(
      expect.objectContaining({
        rule: 'ArbZG_3_Hoechstarbeitszeit',
        severity: 'error',
        employeeId: m1,
        date: '2026-09-07',
      }),
    );
  });

  it('clears a day covered by an Absence before validating, so its leftover shift raises no sync violation', async () => {
    const schedule = withDayEntry(
      createWeeklySchedule(branchId, week, [m1]),
      m1,
      'Montag',
      shiftEntry('06:00', '18:00'),
    );
    const vacationOnMonday: Absence = {
      id: 'a1' as AbsenceId,
      employeeId: m1,
      type: 'Vacation',
      from: '2026-09-07',
      to: '2026-09-07',
      createdAt: '2026-01-01T00:00:00.000Z',
    };
    const sentinel: ValidationResult = { rule: 'Sentinel', severity: 'info', message: 'done' };
    const absencesWithVacation = [vacationOnMonday];
    checkWeekMock.mockResolvedValue([sentinel]);

    const { result } = renderHook(() => useScheduleValidation(schedule, defaultBranch, absencesWithVacation));

    await waitFor(() => expect(result.current).toEqual([sentinel]));
    // The async rest-period check does its own absence-clearing per neighbouring week (see the
    // hook's doc comment and restPeriodCheckService), so it deliberately gets the RAW schedule
    // (with the leftover Monday shift still present) plus the absences list, not a pre-cleaned copy.
    expect(checkWeekMock).toHaveBeenCalledWith(schedule, absencesWithVacation, []);
  });

  it('adds a JArbSchG youth violation for a minor employee, without affecting an adult in the same schedule', async () => {
    let schedule = withDayEntry(
      createWeeklySchedule(branchId, week, [m1, m2]),
      m1,
      'Montag',
      shiftEntry('06:00', '21:00'), // past 20:00 -> youth night-work violation, harmless for an adult
    );
    schedule = withDayEntry(schedule, m2, 'Montag', shiftEntry('06:00', '21:00'));
    employeeForBranchMock.mockResolvedValue([
      { id: m1, birthDate: '2010-05-01' } as never,
      { id: m2, birthDate: '1990-05-01' } as never,
    ]);
    checkWeekMock.mockResolvedValue([]);

    const { result } = renderHook(() => useScheduleValidation(schedule, defaultBranch, EMPTY_ABSENCES));

    await waitFor(() =>
      expect(result.current).toContainEqual(expect.objectContaining({ rule: 'JArbSchG_14_Nachtruhe', employeeId: m1 })),
    );
    expect(result.current).not.toContainEqual(expect.objectContaining({ rule: 'JArbSchG_14_Nachtruhe', employeeId: m2 }));
  });

  it("does not let a stale checkWeek response overwrite a newer render's results", async () => {
    const scheduleA = createWeeklySchedule(branchId, week, [m1]);
    const scheduleB = withDayEntry(scheduleA, m1, 'Montag', shiftEntry('06:00', '18:00'));

    const deferredA = createDeferred<ValidationResult[]>();
    const deferredB = createDeferred<ValidationResult[]>();
    checkWeekMock.mockReturnValueOnce(deferredA.promise).mockReturnValueOnce(deferredB.promise);

    const staleMarker: ValidationResult = { rule: 'Stale', severity: 'info', message: 'stale', employeeId: m2 };
    const freshMarker: ValidationResult = { rule: 'Fresh', severity: 'info', message: 'fresh', employeeId: m2 };

    const { result, rerender } = renderHook(
      (props: { schedule: WeeklySchedule }) => useScheduleValidation(props.schedule, defaultBranch, EMPTY_ABSENCES),
      { initialProps: { schedule: scheduleA } },
    );

    await waitFor(() => expect(checkWeekMock).toHaveBeenCalledTimes(1));

    rerender({ schedule: scheduleB });

    await waitFor(() => expect(checkWeekMock).toHaveBeenCalledTimes(2));

    await act(async () => {
      deferredB.resolve([freshMarker]);
      await deferredB.promise;
    });

    expect(result.current).toContainEqual(freshMarker);
    expect(result.current).toContainEqual(
      expect.objectContaining({ rule: 'ArbZG_3_Hoechstarbeitszeit', severity: 'error', employeeId: m1 }),
    );

    await act(async () => {
      deferredA.resolve([staleMarker]);
      await deferredA.promise;
    });

    expect(result.current).not.toContainEqual(staleMarker);
    expect(result.current).toContainEqual(freshMarker);
  });
});
