import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import DialogContentText from '@mui/material/DialogContentText';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  text: string;
  confirmText?: string;
  dangerous?: boolean;
  /** While true the dialog stays open with a spinning confirm button and cannot be dismissed.
   * For confirmations whose action takes a visible moment (a full database replace, a network
   * call) - without it the dialog vanishes and the user waits in front of an unchanged screen
   * with no idea whether anything is happening. */
  busy?: boolean;
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
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    // onClose is short-circuited while busy: Escape and a click on the backdrop would otherwise
    // tear the dialog down in the middle of the very action it is reporting on.
    <Dialog open={open} onClose={busy ? undefined : onCancel} maxWidth="xs" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        {/* Freigegeben, weil hier die ArbZG-Verstoesse des DayEditors und die Warnungen vor
            Import und Loeschung stehen - Text, den man beim Nachfragen kopieren koennen muss. */}
        <DialogContentText data-selectable>{text}</DialogContentText>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onCancel} disabled={busy}>
          Abbrechen
        </Button>
        <Button
          variant="contained"
          color={dangerous ? 'error' : 'primary'}
          onClick={onConfirm}
          disabled={busy}
          startIcon={busy ? <CircularProgress size={16} color="inherit" /> : undefined}
        >
          {confirmText}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
