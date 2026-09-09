import { useEffect, useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import type { RemoteBackup } from '@application/ports/BackupStorage';
import { formatDateGerman } from '@domain/shared/DateFormat';
import { services } from '@infrastructure/services';

interface DriveBackupDialogProps {
  /** True while the parent is downloading the chosen backup. The dialog stays open and says so -
   * it is the only thing on screen during that wait. */
  busy?: boolean;
  onClose: () => void;
  /** The chosen backup. The parent runs the usual confirmation and import from here on. */
  onSelect: (backup: RemoteBackup) => void;
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

/** Lists the backups this app put into the user's Google Drive, newest first. */
export function DriveBackupDialog({ busy = false, onClose, onSelect }: DriveBackupDialogProps) {
  const [backups, setBackups] = useState<RemoteBackup[] | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <Dialog open onClose={busy ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Sicherung aus Google Drive laden</DialogTitle>
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
          <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
            In Google Drive liegt noch keine Sicherung. Lege zuerst über „In Google Drive sichern“ eine an.
          </Typography>
        )}

        {!busy && backups !== null && backups.length > 0 && (
          <List disablePadding>
            {backups.map((backup) => (
              <ListItemButton key={backup.id} onClick={() => onSelect(backup)}>
                <ListItemText primary={backup.name} secondary={subtitle(backup)} />
              </ListItemButton>
            ))}
          </List>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={busy}>
          Abbrechen
        </Button>
      </DialogActions>
    </Dialog>
  );
}
