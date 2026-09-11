import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import type { EmployeeId } from '@domain/shared/ids';
import type { Absence } from '@domain/absence/Absence';
import { services } from '@infrastructure/services';
import { useAbsences } from './useAbsences';

vi.mock('@infrastructure/services', () => ({
  services: { absence: { forBranch: vi.fn() } },
}));

const forBranchMock = vi.mocked(services.absence.forBranch);

beforeEach(() => {
  forBranchMock.mockReset();
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
  it('calls services.absence.forBranch with a non-empty employeeIds array and resolves absences', async () => {
    const e1 = 'e1' as EmployeeId;
    const e2 = 'e2' as EmployeeId;
    const employeeIds = [e1, e2];
    const result = [absence('a1', e1), absence('a2', e2)];
    forBranchMock.mockResolvedValue(result);

    const { result: hookResult } = renderHook(() => useAbsences(employeeIds));

    await waitFor(() => expect(hookResult.current.absences).toEqual(result));

    expect(forBranchMock).toHaveBeenCalledTimes(1);
    expect(forBranchMock).toHaveBeenCalledWith(employeeIds);
  });

  it('does not call services.absence.forBranch with an empty employeeIds array and resolves to []', async () => {
    const { result: hookResult } = renderHook(() => useAbsences([]));

    await waitFor(() => expect(hookResult.current.loading).toBe(false));

    expect(hookResult.current.absences).toEqual([]);
    expect(forBranchMock).not.toHaveBeenCalled();
  });

  it('does not reload when rerendered with a new array reference containing the same ids', async () => {
    const e1 = 'e1' as EmployeeId;
    const e2 = 'e2' as EmployeeId;
    const employeeIds = [e1, e2];
    const result = [absence('a1', e1)];
    forBranchMock.mockResolvedValue(result);

    const { result: hookResult, rerender } = renderHook(
      ({ employeeIds }) => useAbsences(employeeIds),
      { initialProps: { employeeIds } },
    );

    await waitFor(() => expect(hookResult.current.absences).toEqual(result));
    expect(forBranchMock).toHaveBeenCalledTimes(1);

    rerender({ employeeIds: [...employeeIds] });

    expect(forBranchMock).toHaveBeenCalledTimes(1);
  });

  it('reloads when rerendered with a genuinely different set of ids', async () => {
    const e1 = 'e1' as EmployeeId;
    const e2 = 'e2' as EmployeeId;
    const e3 = 'e3' as EmployeeId;
    const firstResult = [absence('a1', e1)];
    const secondResult = [absence('a2', e3)];
    forBranchMock.mockResolvedValueOnce(firstResult).mockResolvedValueOnce(secondResult);

    const { result: hookResult, rerender } = renderHook(
      ({ employeeIds }) => useAbsences(employeeIds),
      { initialProps: { employeeIds: [e1, e2] } },
    );

    await waitFor(() => expect(hookResult.current.absences).toEqual(firstResult));
    expect(forBranchMock).toHaveBeenCalledTimes(1);

    rerender({ employeeIds: [e1, e3] });

    await waitFor(() => expect(hookResult.current.absences).toEqual(secondResult));
    expect(forBranchMock).toHaveBeenCalledTimes(2);
    expect(forBranchMock).toHaveBeenLastCalledWith([e1, e3]);
  });
});
