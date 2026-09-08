import type { BranchId, ShiftTemplateId } from '@domain/shared/ids';
import type { ShiftTemplate } from '@domain/schedule/ShiftTemplate';
import type { ShiftTemplateRepository } from '@application/ports/ShiftTemplateRepository';
import { db } from './db';

export class DexieShiftTemplateRepository implements ShiftTemplateRepository {
  async findAll(): Promise<ShiftTemplate[]> {
    return db.shiftTemplates.toArray();
  }

  async findByBranch(branchId: BranchId): Promise<ShiftTemplate[]> {
    return db.shiftTemplates.where('branchId').equals(branchId).toArray();
  }

  async save(template: ShiftTemplate): Promise<void> {
    await db.shiftTemplates.put(template);
  }

  async delete(id: ShiftTemplateId): Promise<void> {
    await db.shiftTemplates.delete(id);
  }

  async deleteAll(): Promise<void> {
    await db.shiftTemplates.clear();
  }
}
