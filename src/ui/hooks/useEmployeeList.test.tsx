import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import type { BranchId, EmployeeId } from '@domain/shared/ids';
import type { Employee } from '@domain/employee/Employee';
import { services } from '@infrastructure/services';
import { useEmployeeList } from './useEmployeeList';

vi.mock('@infrastructure/services', () => ({
  services: { employee: { forBranch: vi.fn() } },
}));

const forBranchMock = vi.mocked(services.employee.forBranch);

function employee(overrides: Partial<Employee> = {}): Employee {
  return {
    id: 'm1' as EmployeeId,
    branchId: 'b1' as BranchId,
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

describe('useEmployeeList', () => {
  beforeEach(() => {
    forBranchMock.mockReset();
  });

  it('calls services.employee.forBranch with the given branchId and resolves employeeList to its result', async () => {
    const branchId = 'b1' as BranchId;
    const employees = [employee()];
    forBranchMock.mockResolvedValue(employees);

    const { result } = renderHook(() => useEmployeeList(branchId));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(forBranchMock).toHaveBeenCalledWith(branchId);
    expect(result.current.employeeList).toEqual(employees);
  });

  it('does not call services.employee.forBranch when branchId is null and resolves employeeList to []', async () => {
    const { result } = renderHook(() => useEmployeeList(null));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(forBranchMock).not.toHaveBeenCalled();
    expect(result.current.employeeList).toEqual([]);
  });

  it('reloads with the new branchId when rerendered with a different branchId', async () => {
    const branchA = 'b1' as BranchId;
    const branchB = 'b2' as BranchId;
    const employeesA = [employee({ id: 'm1' as EmployeeId, lastName: 'Anders' })];
    const employeesB = [employee({ id: 'm2' as EmployeeId, lastName: 'Zimmer' })];
    forBranchMock.mockImplementation((branchId) =>
      Promise.resolve(branchId === branchA ? employeesA : employeesB),
    );

    const { result, rerender } = renderHook(({ branchId }) => useEmployeeList(branchId), {
      initialProps: { branchId: branchA as BranchId | null },
    });

    await waitFor(() => expect(result.current.employeeList).toEqual(employeesA));

    rerender({ branchId: branchB });

    await waitFor(() => expect(result.current.employeeList).toEqual(employeesB));

    expect(forBranchMock).toHaveBeenCalledWith(branchA);
    expect(forBranchMock).toHaveBeenCalledWith(branchB);
    expect(forBranchMock).toHaveBeenCalledTimes(2);
  });
});
