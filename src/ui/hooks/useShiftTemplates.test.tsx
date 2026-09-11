import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import type { BranchId, ShiftTemplateId } from '@domain/shared/ids';
import { clockTime } from '@domain/shared/ClockTime';
import { createShift } from '@domain/schedule/Shift';
import type { ShiftTemplate } from '@domain/schedule/ShiftTemplate';
import { services } from '@infrastructure/services';
import { useShiftTemplates } from './useShiftTemplates';

vi.mock('@infrastructure/services', () => ({
  services: { shiftTemplate: { forBranch: vi.fn() } },
}));

const forBranchMock = vi.mocked(services.shiftTemplate.forBranch);
const branchId = 'b1' as BranchId;
const otherBranchId = 'b2' as BranchId;

function template(overrides: Partial<ShiftTemplate> = {}): ShiftTemplate {
  return {
    id: 't1' as ShiftTemplateId,
    branchId,
    name: 'Frühschicht',
    shifts: [createShift(clockTime('06:00'), clockTime('14:00'))],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('useShiftTemplates', () => {
  beforeEach(() => {
    forBranchMock.mockReset();
  });

  it('calls services.shiftTemplate.forBranch and resolves templates for a real branchId', async () => {
    const templates = [template()];
    forBranchMock.mockResolvedValue(templates);

    const { result } = renderHook(() => useShiftTemplates(branchId));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(forBranchMock).toHaveBeenCalledWith(branchId);
    expect(result.current.templates).toBe(templates);
  });

  it('does not call forBranch and resolves templates to [] when branchId is null', async () => {
    const { result } = renderHook(() => useShiftTemplates(null));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(forBranchMock).not.toHaveBeenCalled();
    expect(result.current.templates).toEqual([]);
  });

  it('reloads with the new branchId when the hook rerenders with a different branchId', async () => {
    const templatesA = [template({ id: 't1' as ShiftTemplateId, name: 'A' })];
    const templatesB = [
      template({ id: 't2' as ShiftTemplateId, branchId: otherBranchId, name: 'B' }),
    ];
    forBranchMock.mockImplementation(async (id) => (id === branchId ? templatesA : templatesB));

    const { result, rerender } = renderHook(({ id }) => useShiftTemplates(id), {
      initialProps: { id: branchId as BranchId | null },
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.templates).toBe(templatesA);
    expect(forBranchMock).toHaveBeenCalledTimes(1);

    rerender({ id: otherBranchId });

    await waitFor(() => expect(result.current.templates).toBe(templatesB));
    expect(forBranchMock).toHaveBeenCalledWith(otherBranchId);
    expect(forBranchMock).toHaveBeenCalledTimes(2);
  });
});
