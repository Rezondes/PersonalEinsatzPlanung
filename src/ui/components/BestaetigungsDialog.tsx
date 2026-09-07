import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import DialogContentText from '@mui/material/DialogContentText';
import Button from '@mui/material/Button';

interface BestaetigungsDialogProps {
  open: boolean;
  titel: string;
  text: string;
  bestaetigenText?: string;
  gefaehrlich?: boolean;
  onBestaetigen: () => void;
  onAbbrechen: () => void;
}

/** Shared MUI confirmation dialog for destructive/irreversible actions, replacing native
 * window.confirm() so every such prompt in the app looks and behaves consistently. */
export function BestaetigungsDialog({
  open,
  titel,
  text,
  bestaetigenText = 'Bestätigen',
  gefaehrlich = false,
  onBestaetigen,
  onAbbrechen,
}: BestaetigungsDialogProps) {
  return (
    <Dialog open={open} onClose={onAbbrechen} maxWidth="xs" fullWidth>
      <DialogTitle>{titel}</DialogTitle>
      <DialogContent>
        <DialogContentText>{text}</DialogContentText>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onAbbrechen}>Abbrechen</Button>
        <Button variant="contained" color={gefaehrlich ? 'error' : 'primary'} onClick={onBestaetigen}>
          {bestaetigenText}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
