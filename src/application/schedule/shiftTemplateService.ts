import type { BranchId, ShiftTemplateId } from '@domain/shared/ids';
import type { Shift } from '@domain/schedule/Shift';
import type { ShiftTemplate } from '@domain/schedule/ShiftTemplate';
import { compareShiftTemplatesByName, createShiftTemplate } from '@domain/schedule/ShiftTemplate';
import type { ShiftTemplateRepository } from '@application/ports/ShiftTemplateRepository';

export function createShiftTemplateService(repo: ShiftTemplateRepository) {
  return {
    // Sorted here (not left to callers) so the toolbar order is the same everywhere by construction.
    forBranch: async (branchId: BranchId) =>
      (await repo.findByBranch(branchId)).sort(compareShiftTemplatesByName),

    create: async (details: { branchId: BranchId; name: string; shifts: Shift[] }) => {
      const template = createShiftTemplate(details);
      await repo.save(template);
      return template;
    },

    /** Deliberately not re-validated, like every other update path in this app. */
    update: async (template: ShiftTemplate) => {
      const updated: ShiftTemplate = { ...template, updatedAt: new Date().toISOString() };
      await repo.save(updated);
      return updated;
    },

    /** Hard delete is fine here, unlike Branch/Employee: applying a template copies its shifts into
     * the weekly schedule, so nothing references the template afterwards. */
    delete: (id: ShiftTemplateId) => repo.delete(id),
  };
}

export type ShiftTemplateService = ReturnType<typeof createShiftTemplateService>;
