import { useState } from 'react';
import { notify } from '@ui/app/store/notificationStore';

interface Activatable {
  active: boolean;
}

interface ActivationService<T> {
  changeActiveStatus: (entity: T, active: boolean) => Promise<T>;
}

/**
 * The activate/deactivate confirm-dialog flow shared identically by BranchMasterDataView and
 * EmployeeMasterDataView: request(entity) opens the confirm dialog for it, confirm() flips its
 * active flag through the given service and reloads the list, cancel() closes it without calling
 * the service. The target is cleared in every case, including a failed confirm() - otherwise the
 * confirm dialog would stay open showing a stale target after an error was already reported.
 */
export function useActivationToggle<T extends Activatable>(service: ActivationService<T>, reload: () => Promise<void>) {
  const [target, setTarget] = useState<T | null>(null);

  const confirm = async () => {
    if (!target) return;
    try {
      await service.changeActiveStatus(target, !target.active);
      await reload();
    } catch (e) {
      notify.report(e, 'Status konnte nicht geändert werden');
    } finally {
      setTarget(null);
    }
  };

  return { target, request: setTarget, cancel: () => setTarget(null), confirm };
}
