import { useEffect, useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
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
import type { RemoteBackup } from '@application/ports/BackupStorage';
import { formatDateGerman } from '@domain/shared/DateFormat';
import { services } from '@infrastructure/services';
import { ConfirmDialog } from '@ui/components/ConfirmDialog';

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

function subtitle(backup: RemoteBackup): string {
  const parts: string[] = [];
  if (backup.modifiedAt) {
    parts.push(`Gesichert am ${formatDateGerman(new Date(backup.modifiedAt))}`);
  }
  if (backup.sizeBytes !== null) {
    parts.push(`${Math.max(1, Math.round(backup.sizeBytes / 1024)).toLocaleString('de-DE')} KB`);
  }
  return parts.join(' · ');
}

/** Lists the backups this app put into the user's Google Drive, newest first, and lets them be
 * loaded or thrown away. */
export function DriveBackupDialog({ busy = false, onClose, onSelect, onError }: DriveBackupDialogProps) {
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
        if (!cancelled) setError(e instanceof Error ? e.message : 'Die Sicherungen konnten nicht geladen werden.');
      });
    return () => {
      cancelled = true;
    };
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
      onError(e, 'Die Sicherung konnte nicht gelöscht werden');
    } finally {
      setDeletingId(null);
    }
  };

  const anyBusy = busy || deletingId !== null;

  return (
    <>
      <Dialog open onClose={anyBusy ? undefined : onClose} maxWidth="sm" fullWidth>
        <DialogTitle>Sicherung aus Google Drive laden oder löschen</DialogTitle>
        <DialogContent dividers>
          {error && <Alert severity="error">{error}</Alert>}

          {!error && (backups === null || busy) && (
            <Stack direction="row" spacing={2} alignItems="center" sx={{ py: 2 }}>
              <CircularProgress size={20} />
              <Typography variant="body2" color="text.secondary">
                {busy ? 'Sicherung wird geladen…' : 'Sicherungen werden geladen…'}
              </Typography>
            </Stack>
          )}

          {!error && !busy && backups !== null && backups.length === 0 && (
            // Neither "noch" nor "zuerst": you also land here by deleting your last backup.
            <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
              In Google Drive liegt keine Sicherung. Lege über „In Google Drive sichern“ eine an.
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
                        aria-label={`${backup.name} löschen`}
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
                    <ListItemText primary={backup.name} secondary={subtitle(backup)} />
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onClose} disabled={anyBusy}>
            Abbrechen
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Sicherung löschen?"
        // Says what actually happens. The adapter trashes rather than erases, so promising the file
        // is gone for good would be a lie - and the 30 days are the reassuring part.
        text={`„${deleteTarget?.name ?? ''}“ wird in den Papierkorb von Google Drive verschoben und dort nach 30 Tagen endgültig gelöscht. Die Daten in dieser App bleiben unverändert.`}
        confirmText="Löschen"
        dangerous
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
}
