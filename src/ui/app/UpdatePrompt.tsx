import { useEffect, useRef } from 'react';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import { useRegisterSW } from 'virtual:pwa-register/react';

/** Once an hour. Often enough that a fix reaches the shops the same day, rare enough to be free. */
const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;

/**
 * Registers the service worker and asks before switching to a new version.
 *
 * The whole app is precached, so it also runs without a network. The price of that is an update
 * problem: a browser tab picks up a new deployment on the next reload, an installed app does not.
 * Hence this: the new version is downloaded and then WAITS until the user says so
 * (registerType 'prompt' plus skipWaiting: false in vite.config.ts). Never swap it in silently -
 * this is a data-entry tool, and a reload during an open day dialog destroys what was typed.
 *
 * Rendered from App.tsx rather than AppShell for three reasons: the print route lives outside the
 * shell and would unmount this along with a pending update; a Snackbar needs no router context;
 * and it belongs next to CssBaseline, which is anchored there for the same reason.
 *
 * Anchored bottom LEFT because components/ErrorSnackbar.tsx sits bottom centre and MUI snackbars
 * do not stack.
 */
export function UpdatePrompt() {
  const registration = useRef<ServiceWorkerRegistration | undefined>(undefined);
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW: (_swUrl, r) => {
      registration.current = r;
    },
  });

  // Deliberately its own effect rather than a setInterval inside onRegisteredSW: that callback has
  // no teardown and runs twice under StrictMode, so the timer would leak. This one cleans up.
  useEffect(() => {
    const timer = setInterval(() => void registration.current?.update(), UPDATE_CHECK_INTERVAL_MS);
    return () => clearInterval(timer);
  }, []);

  return (
    <Snackbar
      open={needRefresh}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      sx={{ '@media print': { display: 'none' } }}
    >
      <Alert
        severity="info"
        variant="filled"
        // Both buttons live in `action`, and there is no onClose: MUI renders its own close icon
        // only when `action` is empty, so an onClose next to an action is silently dead. Two
        // labelled buttons beat an X anyway for people who do not read icons.
        action={
          <>
            <Button color="inherit" size="small" onClick={() => setNeedRefresh(false)}>
              Später
            </Button>
            <Button color="inherit" size="small" onClick={() => void updateServiceWorker(true)}>
              Jetzt laden
            </Button>
          </>
        }
      >
        Eine neue Version ist verfügbar.
      </Alert>
    </Snackbar>
  );
}
