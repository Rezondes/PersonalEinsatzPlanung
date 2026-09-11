import { describe, it, expect, vi } from 'vitest';
import type { BranchId, ShiftTemplateId } from '@domain/shared/ids';
import { clockTime } from '@domain/shared/ClockTime';
import { createShift } from '@domain/schedule/Shift';
import type { ShiftTemplate } from '@domain/schedule/ShiftTemplate';
import type { ShiftTemplateRepository } from '@application/ports/ShiftTemplateRepository';
import { createShiftTemplateService } from './shiftTemplateService';

const branchId = 'b1' as BranchId;

function fakeRepo(): ShiftTemplateRepository {
  return {
    findAll: vi.fn(),
    findByBranch: vi.fn(async () => []),
    save: vi.fn(async () => {}),
    delete: vi.fn(async () => {}),
    deleteAll: vi.fn(),
  };
}

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

describe('shiftTemplateService', () => {
  it('forBranch sorts the repository results by name', async () => {
    const repo = fakeRepo();
    repo.findByBranch = vi.fn(async () => [
      template({ id: 't2' as ShiftTemplateId, name: 'Spätschicht' }),
      template({ id: 't1' as ShiftTemplateId, name: 'Frühschicht' }),
    ]);

    const result = await createShiftTemplateService(repo).forBranch(branchId);

    expect(result.map((t) => t.name)).toEqual(['Frühschicht', 'Spätschicht']);
    expect(repo.findByBranch).toHaveBeenCalledWith(branchId);
  });

  it('create builds a new ShiftTemplate and saves it', async () => {
    const repo = fakeRepo();
    const created = await createShiftTemplateService(repo).create({
      branchId,
      name: 'Frühschicht',
      shifts: [createShift(clockTime('06:00'), clockTime('14:00'))],
    });

    expect(created.id).toBeTruthy();
    expect(repo.save).toHaveBeenCalledWith(created);
  });

  it('update saves the template with a refreshed updatedAt, without re-validating', async () => {
    const repo = fakeRepo();
    const existing = template();

    const updated = await createShiftTemplateService(repo).update({ ...existing, name: '' });

    expect(updated.name).toBe('');
    expect(updated.updatedAt).not.toBe(existing.updatedAt);
    expect(repo.save).toHaveBeenCalledWith(updated);
  });

  it('delete is a hard delete via the repository', async () => {
    const repo = fakeRepo();
    await createShiftTemplateService(repo).delete('t1' as ShiftTemplateId);
    expect(repo.delete).toHaveBeenCalledWith('t1');
  });
});
