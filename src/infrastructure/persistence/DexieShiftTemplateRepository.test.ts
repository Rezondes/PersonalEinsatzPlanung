import { describe, it, expect, beforeEach } from 'vitest';
import type { BranchId, ShiftTemplateId } from '@domain/shared/ids';
import { clockTime } from '@domain/shared/ClockTime';
import { createShift } from '@domain/schedule/Shift';
import type { ShiftTemplate } from '@domain/schedule/ShiftTemplate';
import { db } from './db';
import { DexieShiftTemplateRepository } from './DexieShiftTemplateRepository';

const branchA = 'b1' as BranchId;
const branchB = 'b2' as BranchId;

function template(overrides: Partial<ShiftTemplate> = {}): ShiftTemplate {
  return {
    id: 't1' as ShiftTemplateId,
    branchId: branchA,
    name: 'Frühschicht',
    shifts: [createShift(clockTime('06:00'), clockTime('14:00'))],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('DexieShiftTemplateRepository', () => {
  beforeEach(async () => {
    await db.shiftTemplates.clear();
  });

  it('findAll returns an empty array when the store is empty', async () => {
    const repo = new DexieShiftTemplateRepository();
    await expect(repo.findAll()).resolves.toEqual([]);
  });

  it('findAll returns every stored template', async () => {
    const repo = new DexieShiftTemplateRepository();
    const t1 = template({ id: 't1' as ShiftTemplateId, branchId: branchA });
    const t2 = template({ id: 't2' as ShiftTemplateId, branchId: branchB, name: 'Spätschicht' });
    await repo.save(t1);
    await repo.save(t2);

    const result = await repo.findAll();

    expect(result).toHaveLength(2);
    expect(result.map((t) => t.id).sort()).toEqual(['t1', 't2']);
  });

  it('findByBranch filters by the branchId index', async () => {
    const repo = new DexieShiftTemplateRepository();
    const t1 = template({ id: 't1' as ShiftTemplateId, branchId: branchA });
    const t2 = template({ id: 't2' as ShiftTemplateId, branchId: branchA, name: 'Spätschicht' });
    const t3 = template({ id: 't3' as ShiftTemplateId, branchId: branchB, name: 'Nachtschicht' });
    await repo.save(t1);
    await repo.save(t2);
    await repo.save(t3);

    const resultA = await repo.findByBranch(branchA);
    const resultB = await repo.findByBranch(branchB);

    expect(resultA.map((t) => t.id).sort()).toEqual(['t1', 't2']);
    expect(resultB.map((t) => t.id)).toEqual(['t3']);
  });

  it('findByBranch returns an empty array for a branch with no templates', async () => {
    const repo = new DexieShiftTemplateRepository();
    await repo.save(template({ id: 't1' as ShiftTemplateId, branchId: branchA }));

    await expect(repo.findByBranch(branchB)).resolves.toEqual([]);
  });

  it('save inserts a new template', async () => {
    const repo = new DexieShiftTemplateRepository();
    const t1 = template();

    await repo.save(t1);

    const stored = await db.shiftTemplates.get(t1.id);
    expect(stored).toEqual(t1);
  });

  it('save upserts an existing template rather than duplicating it', async () => {
    const repo = new DexieShiftTemplateRepository();
    const t1 = template();
    await repo.save(t1);

    const updated: ShiftTemplate = { ...t1, name: 'Umbenannt', updatedAt: '2026-01-02T00:00:00.000Z' };
    await repo.save(updated);

    const all = await repo.findAll();
    expect(all).toHaveLength(1);
    expect(all[0].name).toBe('Umbenannt');
  });

  it('delete permanently removes the template, not a soft-delete flag', async () => {
    const repo = new DexieShiftTemplateRepository();
    const t1 = template({ id: 't1' as ShiftTemplateId });
    await repo.save(t1);

    await repo.delete(t1.id);

    const stored = await db.shiftTemplates.get(t1.id);
    expect(stored).toBeUndefined();
    await expect(repo.findAll()).resolves.toEqual([]);
  });

  it('delete on a non-existent id does not throw', async () => {
    const repo = new DexieShiftTemplateRepository();
    await expect(repo.delete('missing' as ShiftTemplateId)).resolves.toBeUndefined();
  });

  it('deleteAll clears every template across branches', async () => {
    const repo = new DexieShiftTemplateRepository();
    await repo.save(template({ id: 't1' as ShiftTemplateId, branchId: branchA }));
    await repo.save(template({ id: 't2' as ShiftTemplateId, branchId: branchB }));

    await repo.deleteAll();

    await expect(repo.findAll()).resolves.toEqual([]);
    await expect(db.shiftTemplates.count()).resolves.toBe(0);
  });
});
