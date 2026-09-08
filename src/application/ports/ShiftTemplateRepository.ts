import type { BranchId, ShiftTemplateId } from '@domain/shared/ids';
import type { ShiftTemplate } from '@domain/schedule/ShiftTemplate';

export interface ShiftTemplateRepository {
  findAll(): Promise<ShiftTemplate[]>;
  findByBranch(branchId: BranchId): Promise<ShiftTemplate[]>;
  save(template: ShiftTemplate): Promise<void>;
  delete(id: ShiftTemplateId): Promise<void>;
  deleteAll(): Promise<void>;
}
