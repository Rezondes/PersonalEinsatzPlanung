import { useEffect, useState } from 'react';
import Button from '@mui/material/Button';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import IconButton from '@mui/material/IconButton';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import type { RemoteBackup } from '@application/ports/BackupStorage';
import { formatDateGerman } from '@domain/shared/DateFormat';
import { services } from '@infrastructure/services';
import { ConfirmDialog } from '@ui/components/ConfirmDialog';
import { ResponsiveDialog } from '@ui/components/ResponsiveDialog';

interface DriveBackupDialogProps {
  /** True while the parent is downloading the chosen backup. The dialog stays open and says so -
   * it is the only thing on screen during that wait. */
  busy?: boolean;
  onClose: () => void;
  /** The chosen backup. The parent runs the usual confirmation and import from here on. */
  onSelect: (backup: RemoteBackup) => void;
  /** Same contract the data-entry dialogs take. A failed delete is reported by the PARENT, not in
   * here: this dialog is mounted conditionally, so closing it mid-request would take its own error
   * message down with it - and an Alert at the top of a scrolling list is out of sight anyway. */
  onError: (e: unknown, context?: string) => void;
}

// Not a hook itself (a plain helper called from render), so it takes the caller's own `t` rather
// than calling useTranslation() - TFunction<'settings'> keeps the same typo-safety useTranslation
// would give directly.
function subtitle(backup: RemoteBackup, t: TFunction<'settings'>): string {
  const parts: string[] = [];
  if (backup.modifiedAt) {
    parts.push(t('driveBackupDialog.subtitleSavedAt', { date: formatDateGerman(new Date(backup.modifiedAt)) }));
  }
  if (backup.sizeBytes !== null) {
    parts.push(
      t('driveBackupDialog.subtitleSizeKb', { kb: Math.max(1, Math.round(backup.sizeBytes / 1024)).toLocaleString('de-DE') }),
    );
  }
  return parts.join(' · ');
}

/** Lists the backups this app put into the user's Google Drive, newest first, and lets them be
 * loaded or thrown away. */
export function DriveBackupDialog({ busy = false, onClose, onSelect, onError }: DriveBackupDialogProps) {
  const { t } = useTranslation('settings');
  const { t: tCommon } = useTranslation();
  const [backups, setBackups] = useState<RemoteBackup[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RemoteBackup | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    services.backupStorage
      .list()
      .then((list) => {
        if (!cancelled) setBackups(list);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : t('driveBackupDialog.loadFailedFallback'));
      });
    return () => {
      cancelled = true;
    };
    // t only affects the error-message text, not the fetch itself - excluding it means a future
    // language switch never re-fetches the list, it just reads the current t when the catch fires.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const confirmDelete = async () => {
    const target = deleteTarget;
    if (!target) return;
    setDeleteTarget(null);
    setDeletingId(target.id);
    try {
      await services.backupStorage.delete(target.id);
      // Dropped locally rather than re-fetched: Drive can take a moment to stop listing a file it
      // has just trashed, and a re-fetch would put the row back for a beat.
      setBackups((current) => (current ?? []).filter((b) => b.id !== target.id));
    } catch (e) {
      onError(e, t('driveBackupDialog.deleteError'));
    } finally {
      setDeletingId(null);
    }
  };

  const anyBusy = busy || deletingId !== null;

  return (
    <>
      <ResponsiveDialog
        open
        onClose={anyBusy ? undefined : onClose}
        title={t('driveBackupDialog.title')}
        dividers
        actions={
          <Button onClick={onClose} disabled={anyBusy}>
            {tCommon('cancel')}
          </Button>
        }
      >
        {error && <Alert severity="error">{error}</Alert>}

          {!error && (backups === null || busy) && (
            <Stack direction="row" spacing={2} alignItems="center" sx={{ py: 2 }}>
              <CircularProgress size={20} />
              <Typography role="status" variant="body2" color="text.secondary">
                {busy ? t('driveBackupDialog.loadingOne') : t('driveBackupDialog.loadingMany')}
              </Typography>
            </Stack>
          )}

          {!error && !busy && backups !== null && backups.length === 0 && (
            // Neither "noch" nor "zuerst": you also land here by deleting your last backup.
            <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
              {t('driveBackupDialog.empty')}
            </Typography>
          )}

          {!busy && backups !== null && backups.length > 0 && (
            <List disablePadding>
              {backups.map((backup) => (
                // secondaryAction renders as a SIBLING of the button, not inside it. Nesting one
                // interactive element in another is both an accessibility fault and unclickable.
                <ListItem
                  key={backup.id}
                  disablePadding
                  secondaryAction={
                    deletingId === backup.id ? (
                      <CircularProgress size={20} />
                    ) : (
                      <IconButton
                        edge="end"
                        size="small"
                        aria-label={t('driveBackupDialog.deleteAriaLabel', { name: backup.name })}
                        onClick={() => setDeleteTarget(backup)}
                        // NOT `deletingId !== null`: a disabled button cannot hold focus, and the
                        // focus trap of the confirmation would drop it on <body> when it closes.
                        // The spinner in the row is what signals that something is happening.
                        disabled={deletingId !== null && deletingId !== backup.id}
                      >
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    )
                  }
                >
                  <ListItemButton onClick={() => onSelect(backup)} disabled={deletingId !== null}>
                    <ListItemText primary={backup.name} secondary={subtitle(backup, t)} />
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          )}
      </ResponsiveDialog>

      <ConfirmDialog
        open={deleteTarget !== null}
        title={t('driveBackupDialog.deleteConfirmTitle')}
        // Says what actually happens. The adapter trashes rather than erases, so promising the file
        // is gone for good would be a lie - and the 30 days are the reassuring part.
        text={t('driveBackupDialog.deleteConfirmText', { name: deleteTarget?.name ?? '' })}
        confirmText={tCommon('delete')}
        dangerous
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
}
