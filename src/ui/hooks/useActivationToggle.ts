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
 * `entityLabel` (e.g. "Mitarbeiter"/"Filiale") is only used to word the success notification -
 * the hook itself has no other use for the entity's type or display name.
 */
export function useActivationToggle<T extends Activatable>(
  service: ActivationService<T>,
  reload: () => Promise<void>,
  entityLabel: string,
) {
  const [target, setTarget] = useState<T | null>(null);
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    if (!target) return;
    const activating = !target.active;
    setBusy(true);
    try {
      await service.changeActiveStatus(target, activating);
      await reload();
      notify.success(`${entityLabel} wurde ${activating ? 'aktiviert' : 'deaktiviert'}.`);
    } catch (e) {
      notify.report(e, 'Status konnte nicht geändert werden');
    } finally {
      setBusy(false);
      setTarget(null);
    }
  };

  return { target, request: setTarget, cancel: () => setTarget(null), confirm, busy };
}
