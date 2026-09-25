import { useState } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ConfirmDialog } from '@ui/components/ConfirmDialog';

/**
 * Guards closing a data-entry dialog that holds unsaved changes. Every way out goes through
 * `requestClose` - ResponsiveDialog's onClose (X, Escape, backdrop, back gesture) and the dialog's
 * own "Abbrechen" - so typed input is never dropped without a question. Without changes it closes
 * at once. A successful save calls the dialog's onClose directly and never asks.
 *
 * `onClose` undefined (a save in flight) keeps `requestClose` undefined too, so the existing lock
 * (ResponsiveDialog/Abbrechen disabled) stays exactly as it was.
 */
export function useDiscardConfirm(
  dirty: boolean,
  onClose: (() => void) | undefined,
): { requestClose: (() => void) | undefined; confirmDialog: ReactNode } {
  const { t } = useTranslation();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const requestClose = onClose && (() => (dirty ? setConfirmOpen(true) : onClose()));

  const confirmDialog = (
    <ConfirmDialog
      open={confirmOpen}
      title={t('discardChangesTitle')}
      text={t('discardChangesText')}
      confirmText={t('discardChangesConfirm')}
      cancelText={t('discardChangesCancel')}
      dangerous
      onConfirm={() => {
        setConfirmOpen(false);
        onClose?.();
      }}
      onCancel={() => setConfirmOpen(false)}
    />
  );

  return { requestClose, confirmDialog };
}
