import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';

interface ErrorSnackbarProps {
  error: string | null;
  onClose: () => void;
}

/** Generic error toast used across views together with useErrorSnackbar, so a failed save/delete
 * is always visible to the user instead of only showing up in the browser console. */
export function ErrorSnackbar({ error, onClose }: ErrorSnackbarProps) {
  return (
    <Snackbar open={!!error} autoHideDuration={6000} onClose={onClose} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
      <Alert severity="error" onClose={onClose} variant="filled" sx={{ width: '100%' }}>
        {error}
      </Alert>
    </Snackbar>
  );
}
