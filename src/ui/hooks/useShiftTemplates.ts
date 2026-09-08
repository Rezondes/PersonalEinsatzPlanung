import { useCallback, useEffect, useState } from 'react';
import type { BranchId } from '@domain/shared/ids';
import type { ShiftTemplate } from '@domain/schedule/ShiftTemplate';
import { services } from '@infrastructure/services';

/** The branch's own reusable shift templates, for the weekly planning toolbar. */
export function useShiftTemplates(branchId: BranchId | null) {
  const [templates, setTemplates] = useState<ShiftTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!branchId) {
      setTemplates([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setTemplates(await services.shiftTemplate.forBranch(branchId));
    setLoading(false);
  }, [branchId]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { templates, loading, reload };
}
