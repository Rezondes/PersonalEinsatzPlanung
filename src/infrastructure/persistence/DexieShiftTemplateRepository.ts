import type { BranchId, ShiftTemplateId } from '@domain/shared/ids';
import type { ShiftTemplate } from '@domain/schedule/ShiftTemplate';
import type { ShiftTemplateRepository } from '@application/ports/ShiftTemplateRepository';
import { DexieCrudRepository } from './DexieCrudRepository';
import { db } from './db';

export class DexieShiftTemplateRepository
  extends DexieCrudRepository<ShiftTemplate, ShiftTemplateId>
  implements ShiftTemplateRepository
{
  constructor() {
    super(db.shiftTemplates);
  }

  async findByBranch(branchId: BranchId): Promise<ShiftTemplate[]> {
    return db.shiftTemplates.where('branchId').equals(branchId).toArray();
  }
}
