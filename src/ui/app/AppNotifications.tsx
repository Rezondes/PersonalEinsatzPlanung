import { useEffect, useState } from 'react';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import { useNotificationStore, type AppNotification } from './store/notificationStore';
import { useBreakpoint } from '@ui/hooks/useBreakpoint';
import { mobileSafeBottom } from './nav/mobileChromeOffset';

/** Long enough to read a sentence twice. MUI pauses the clock while the pointer is over it. */
const ERROR_MS = 10_000;
const SUCCESS_MS = 4_000;

/**
 * The app's single feedback surface. Mounted once from App.tsx.
 *
 * In App.tsx and not in AppShell, for the same reason UpdatePrompt lives there: /print/:scheduleId
 * is a top-level route outside the shell, and feedback has to reach it too.
 *
 * Bottom centre - where the old ErrorSnackbar sat. UpdatePrompt keeps bottom left and
 * BuildVersionBadge bottom right, so the three never overlap - except on mobile, where
 * BottomTabBar now also occupies the bottom of the screen; all three there get lifted by
 * mobileSafeBottom() so none of them render underneath it.
 *
 * Errors auto-hide too, they just get longer. A snackbar sits at z-index 1400, above every dialog
 * (1300), and is full width below 600px - a permanent one would cover the Speichern button of the
 * very dialog that raised the error.
 */
export function AppNotifications() {
  // One atomic selector per value. Zustand 5 ships no shallow compare, so a selector returning a
  // fresh object or array would re-render forever ("getSnapshot should be cached").
  const current: AppNotification | undefined = useNotificationStore((state) => state.queue[0]);
  const dismiss = useNotificationStore((state) => state.dismiss);
  const layout = useBreakpoint();

  // Held so the text does not vanish mid-fade: Snackbar keeps rendering during its exit transition,
  // and the store entry is already gone by then.
  const [shown, setShown] = useState<AppNotification | null>(null);
  useEffect(() => {
    if (current) {
      setShown(current);
    }
  }, [current]);

  if (!shown) {
    return null;
  }

  return (
    <Snackbar
      open={!!current}
      // Remounts on a change of message, so a queued one plays its own entry animation instead of
      // silently swapping the text of the one already there.
      key={shown.id}
      autoHideDuration={shown.severity === 'error' ? ERROR_MS : SUCCESS_MS}
      onClose={(_event, reason) => {
        // A click anywhere else on the page must not count as "read".
        if (reason !== 'clickaway') {
          dismiss();
        }
      }}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      sx={{ '@media print': { display: 'none' }, ...(layout === 'mobile' && { bottom: `${mobileSafeBottom(8)} !important` }) }}
    >
      <Alert
        severity={shown.severity}
        variant="filled"
        // An error interrupts, a success only informs. Note this makes the .MuiAlert-root half of
        // app/selectableText.ts load-bearing: a success is no longer role="alert".
        role={shown.severity === 'error' ? 'alert' : 'status'}
        // onClose without an action: MUI renders its own close icon only when action is empty. The
        // X is a shortcut here, not the only way out - both severities time out by themselves.
        onClose={dismiss}
        sx={{ width: '100%' }}
      >
        {shown.text}
      </Alert>
    </Snackbar>
  );
}
