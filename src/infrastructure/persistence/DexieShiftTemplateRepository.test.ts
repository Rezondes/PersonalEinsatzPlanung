import { describe, it, expect, beforeEach } from 'vitest';
import type { BranchId, ShiftTemplateId } from '@domain/shared/ids';
import { clockTime } from '@domain/shared/ClockTime';
import { createShift } from '@domain/schedule/Shift';
import type { ShiftTemplate } from '@domain/schedule/ShiftTemplate';
import { db } from './db';
import { DexieShiftTemplateRepository } from './DexieShiftTemplateRepository';

const branchA = 'b1' as BranchId;
const branchB = 'b2' as BranchId;

function template(overrides: Partial<Extract<ShiftTemplate, { kind: 'Shift' }>> = {}): ShiftTemplate {
  return {
    id: 't1' as ShiftTemplateId,
    branchId: branchA,
    name: 'Frühschicht',
    kind: 'Shift',
    shifts: [createShift(clockTime('06:00'), clockTime('14:00'))],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

// Generic findAll/save/delete/deleteAll behavior is covered once, against a real table, in
// DexieCrudRepository.test.ts - this file only needs findByBranch plus a shape round-trip.
describe('DexieShiftTemplateRepository', () => {
  beforeEach(async () => {
    await db.shiftTemplates.clear();
  });

  it('round-trips a full ShiftTemplate through the real shiftTemplates table', async () => {
    const repo = new DexieShiftTemplateRepository();
    const t1 = template({ id: 't1' as ShiftTemplateId });

    await repo.save(t1);

    await expect(repo.findAll()).resolves.toEqual([t1]);
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

  it('delete permanently removes the template, not a soft-delete flag (unlike Branch/Employee)', async () => {
    const repo = new DexieShiftTemplateRepository();
    const t1 = template({ id: 't1' as ShiftTemplateId });
    await repo.save(t1);

    await repo.delete(t1.id);

    const stored = await db.shiftTemplates.get(t1.id);
    expect(stored).toBeUndefined();
  });
});
