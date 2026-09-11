import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { BranchId } from '@domain/shared/ids';
import type { CalendarWeek } from '@domain/shared/CalendarWeek';
import { createWeeklySchedule } from '@domain/schedule/WeeklySchedule';
import type { WeeklySchedule } from '@domain/schedule/WeeklySchedule';
import { services } from '@infrastructure/services';
import { useSchedule } from './useSchedule';

vi.mock('@infrastructure/services', () => ({
  services: { schedule: { getOrCreate: vi.fn() } },
}));

const getOrCreateMock = vi.mocked(services.schedule.getOrCreate);
const branchId = 'b1' as BranchId;
const cw: CalendarWeek = { year: 2026, week: 37 };

function schedule(): WeeklySchedule {
  return createWeeklySchedule(branchId, cw, []);
}

describe('useSchedule', () => {
  beforeEach(() => {
    getOrCreateMock.mockReset();
  });

  it('calls services.schedule.getOrCreate with the branch and calendar week, and resolves to its result', async () => {
    const loaded = schedule();
    getOrCreateMock.mockResolvedValue(loaded);

    const { result } = renderHook(() => useSchedule(branchId, cw));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(getOrCreateMock).toHaveBeenCalledWith(branchId, cw);
    expect(result.current.schedule).toBe(loaded);
  });

  it('does not call getOrCreate and resolves to null when branchId is null', async () => {
    const { result } = renderHook(() => useSchedule(null, cw));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(getOrCreateMock).not.toHaveBeenCalled();
    expect(result.current.schedule).toBeNull();
  });

  it('does not reload when rerendered with a different cw object of the same year/week', async () => {
    const loaded = schedule();
    getOrCreateMock.mockResolvedValue(loaded);

    const { result, rerender } = renderHook(({ cw }) => useSchedule(branchId, cw), {
      initialProps: { cw },
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(getOrCreateMock).toHaveBeenCalledTimes(1);

    rerender({ cw: { year: cw.year, week: cw.week } });

    expect(getOrCreateMock).toHaveBeenCalledTimes(1);
  });

  it('reloads when rerendered with a different week value', async () => {
    const firstLoaded = schedule();
    const secondLoaded = schedule();
    getOrCreateMock.mockResolvedValueOnce(firstLoaded).mockResolvedValueOnce(secondLoaded);

    const { result, rerender } = renderHook(({ cw }) => useSchedule(branchId, cw), {
      initialProps: { cw },
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(getOrCreateMock).toHaveBeenCalledTimes(1);

    const nextCw: CalendarWeek = { year: cw.year, week: cw.week + 1 };
    rerender({ cw: nextCw });

    await waitFor(() => expect(getOrCreateMock).toHaveBeenCalledTimes(2));
    expect(getOrCreateMock).toHaveBeenLastCalledWith(branchId, nextCw);
    await waitFor(() => expect(result.current.schedule).toBe(secondLoaded));
  });

  it('reloads when rerendered with a different year value', async () => {
    const firstLoaded = schedule();
    const secondLoaded = schedule();
    getOrCreateMock.mockResolvedValueOnce(firstLoaded).mockResolvedValueOnce(secondLoaded);

    const { result, rerender } = renderHook(({ cw }) => useSchedule(branchId, cw), {
      initialProps: { cw },
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(getOrCreateMock).toHaveBeenCalledTimes(1);

    const nextCw: CalendarWeek = { year: cw.year + 1, week: cw.week };
    rerender({ cw: nextCw });

    await waitFor(() => expect(getOrCreateMock).toHaveBeenCalledTimes(2));
    expect(getOrCreateMock).toHaveBeenLastCalledWith(branchId, nextCw);
  });

  it('setSchedule sets the schedule value directly without calling getOrCreate again', async () => {
    const loaded = schedule();
    getOrCreateMock.mockResolvedValue(loaded);

    const { result } = renderHook(() => useSchedule(branchId, cw));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(getOrCreateMock).toHaveBeenCalledTimes(1);

    const optimistic: WeeklySchedule = { ...loaded, plannedWeeklyHours: 42 };
    act(() => {
      result.current.setSchedule(optimistic);
    });

    expect(result.current.schedule).toBe(optimistic);
    expect(getOrCreateMock).toHaveBeenCalledTimes(1);
  });
});
