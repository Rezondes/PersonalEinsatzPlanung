import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import DialogContentText from '@mui/material/DialogContentText';
import Button from '@mui/material/Button';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  text: string;
  confirmText?: string;
  dangerous?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Shared MUI confirmation dialog for destructive/irreversible actions, replacing native
 * window.confirm() so every such prompt in the app looks and behaves consistently. */
export function ConfirmDialog({
  open,
  title,
  text,
  confirmText = 'Bestätigen',
  dangerous = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onClose={onCancel} maxWidth="xs" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        {/* Freigegeben, weil hier die ArbZG-Verstoesse des DayEditors und die Warnungen vor
            Import und Loeschung stehen - Text, den man beim Nachfragen kopieren koennen muss. */}
        <DialogContentText data-selectable>{text}</DialogContentText>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onCancel}>Abbrechen</Button>
        <Button variant="contained" color={dangerous ? 'error' : 'primary'} onClick={onConfirm}>
          {confirmText}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
