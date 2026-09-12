import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import type { EmployeeId } from '@domain/shared/ids';
import type { Absence } from '@domain/absence/Absence';
import { services } from '@infrastructure/services';
import { useAbsences } from './useAbsences';

vi.mock('@infrastructure/services', () => ({
  services: { absence: { forEmployees: vi.fn() } },
}));

const forEmployeesMock = vi.mocked(services.absence.forEmployees);

beforeEach(() => {
  forEmployeesMock.mockReset();
});

function absence(id: string, employeeId: EmployeeId): Absence {
  return {
    id: id as Absence['id'],
    employeeId,
    type: 'Vacation',
    from: '2026-09-14',
    to: '2026-09-14',
    createdAt: '2026-09-11T00:00:00.000Z',
  };
}

describe('useAbsences', () => {
  it('calls services.absence.forEmployees with a non-empty employeeIds array and resolves absences', async () => {
    const e1 = 'e1' as EmployeeId;
    const e2 = 'e2' as EmployeeId;
    const employeeIds = [e1, e2];
    const result = [absence('a1', e1), absence('a2', e2)];
    forEmployeesMock.mockResolvedValue(result);

    const { result: hookResult } = renderHook(() => useAbsences(employeeIds));

    await waitFor(() => expect(hookResult.current.absences).toEqual(result));

    expect(forEmployeesMock).toHaveBeenCalledTimes(1);
    expect(forEmployeesMock).toHaveBeenCalledWith(employeeIds);
  });

  it('does not call services.absence.forEmployees with an empty employeeIds array and resolves to []', async () => {
    const { result: hookResult } = renderHook(() => useAbsences([]));

    await waitFor(() => expect(hookResult.current.loading).toBe(false));

    expect(hookResult.current.absences).toEqual([]);
    expect(forEmployeesMock).not.toHaveBeenCalled();
  });

  it('does not reload when rerendered with a new array reference containing the same ids', async () => {
    const e1 = 'e1' as EmployeeId;
    const e2 = 'e2' as EmployeeId;
    const employeeIds = [e1, e2];
    const result = [absence('a1', e1)];
    forEmployeesMock.mockResolvedValue(result);

    const { result: hookResult, rerender } = renderHook(
      ({ employeeIds }) => useAbsences(employeeIds),
      { initialProps: { employeeIds } },
    );

    await waitFor(() => expect(hookResult.current.absences).toEqual(result));
    expect(forEmployeesMock).toHaveBeenCalledTimes(1);

    rerender({ employeeIds: [...employeeIds] });

    expect(forEmployeesMock).toHaveBeenCalledTimes(1);
  });

  it('reloads when rerendered with a genuinely different set of ids', async () => {
    const e1 = 'e1' as EmployeeId;
    const e2 = 'e2' as EmployeeId;
    const e3 = 'e3' as EmployeeId;
    const firstResult = [absence('a1', e1)];
    const secondResult = [absence('a2', e3)];
    forEmployeesMock.mockResolvedValueOnce(firstResult).mockResolvedValueOnce(secondResult);

    const { result: hookResult, rerender } = renderHook(
      ({ employeeIds }) => useAbsences(employeeIds),
      { initialProps: { employeeIds: [e1, e2] } },
    );

    await waitFor(() => expect(hookResult.current.absences).toEqual(firstResult));
    expect(forEmployeesMock).toHaveBeenCalledTimes(1);

    rerender({ employeeIds: [e1, e3] });

    await waitFor(() => expect(hookResult.current.absences).toEqual(secondResult));
    expect(forEmployeesMock).toHaveBeenCalledTimes(2);
    expect(forEmployeesMock).toHaveBeenLastCalledWith([e1, e3]);
  });
});
