import type { BranchId } from '@domain/shared/ids';
import type { ShiftTemplate } from '@domain/schedule/ShiftTemplate';
import { services } from '@infrastructure/services';
import { useAsyncData } from './useAsyncData';

/** The branch's own reusable shift templates, for the weekly planning toolbar. */
export function useShiftTemplates(branchId: BranchId | null) {
  const { data: templates, loading, reload } = useAsyncData<ShiftTemplate[]>(
    [],
    () => (branchId ? services.shiftTemplate.forBranch(branchId) : Promise.resolve([])),
    [branchId],
  );

  return { templates, loading, reload };
}
