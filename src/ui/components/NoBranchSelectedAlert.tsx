import { Link as RouterLink } from 'react-router-dom';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';

/**
 * Shown by every view that needs a selected Branch once none is selected. The message says
 * "oben" (in AppHeader's Select), but that Select doesn't render at all once there are no active
 * Filialen left (see AppHeader.tsx) - the action button is the only way back to /branches in that
 * case, not just a shortcut.
 */
export function NoBranchSelectedAlert() {
  return (
    <Alert
      severity="info"
      action={
        <Button component={RouterLink} to="/branches" color="inherit" size="small">
          Zu den Filialen
        </Button>
      }
    >
      Bitte zuerst oben eine Filiale auswählen oder anlegen.
    </Alert>
  );
}
