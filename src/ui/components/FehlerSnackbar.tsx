import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';

interface FehlerSnackbarProps {
  fehler: string | null;
  onClose: () => void;
}

/** Generic error toast used across views together with useFehlerSnackbar, so a failed save/delete
 * is always visible to the user instead of only showing up in the browser console. */
export function FehlerSnackbar({ fehler, onClose }: FehlerSnackbarProps) {
  return (
    <Snackbar open={!!fehler} autoHideDuration={6000} onClose={onClose} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
      <Alert severity="error" onClose={onClose} variant="filled" sx={{ width: '100%' }}>
        {fehler}
      </Alert>
    </Snackbar>
  );
}
