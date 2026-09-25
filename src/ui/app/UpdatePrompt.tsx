import { useEffect, useRef } from 'react';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { useTranslation } from 'react-i18next';
import { useBreakpoint } from '@ui/hooks/useBreakpoint';
import { APP_VERSION } from './buildInfo';
import { router } from './router';
import { useLocaleStore } from './locale/localeStore';
import { buildLocalizedPath } from './locale/locale';

/** Once an hour. Often enough that a fix reaches the shops the same day, rare enough to be free. */
const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;

/** sessionStorage, not localStorage: a closed-and-reopened tab is a fresh session and should see
 * the prompt again even for the very same still-waiting update, but a reload of the SAME tab must
 * not immediately re-show what "Später" just dismissed - that was the bug this fixes. Keyed by the
 * waiting worker's own scriptURL so a genuinely different update (one that replaces the dismissed
 * one, e.g. found by the hourly check below) is never suppressed by an unrelated earlier dismissal. */
const DISMISSED_UPDATE_KEY = 'pep.update.dismissedScriptURL';

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
  const layout = useBreakpoint();
  const { t } = useTranslation('app');
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

  // Read directly during render, not via state: sessionStorage cannot change from outside this
  // tab's own JS between renders, so there is nothing to synchronize - only "Später" below ever
  // writes it, and that already triggers a re-render via setNeedRefresh.
  const waitingScriptURL = registration.current?.waiting?.scriptURL;
  const isDismissedUpdate =
    waitingScriptURL !== undefined && sessionStorage.getItem(DISMISSED_UPDATE_KEY) === waitingScriptURL;

  return (
    <Snackbar
      open={needRefresh && !isDismissedUpdate}
      // On a phone every snackbar is full width, and AppNotifications owns the bottom: at the same
      // spot an error could cover these buttons. So this one sits at the top there, under the header.
      anchorOrigin={{ vertical: layout === 'mobile' ? 'top' : 'bottom', horizontal: 'left' }}
      sx={{
        '@media print': { display: 'none' },
        ...(layout === 'mobile' && { top: 'calc(var(--pep-header-height, 56px) + 8px) !important' }),
      }}
    >
      <Alert
        severity="info"
        variant="filled"
        // flexWrap so a narrow phone drops the action buttons to their own line below the message
        // instead of forcing all three into MUI Alert's default nowrap row (see AlertAction/Alert
        // root in node_modules/@mui/material/Alert/Alert.js - neither sets flexWrap on its own). A
        // no-op at widths where everything already fits on one line.
        sx={{ flexWrap: 'wrap', rowGap: 0.5 }}
        // All three buttons live in `action`, and there is no onClose: MUI renders its own close
        // icon only when `action` is empty, so an onClose next to an action is silently dead.
        // Labelled buttons beat an X anyway for people who do not read icons.
        action={
          <Stack direction="row" flexWrap="wrap" justifyContent="flex-end" gap={0.5}>
            <Button
              color="inherit"
              size="small"
              // Neither closes the banner nor triggers the update - just a way to see what's new
              // before deciding, so it must not touch needRefresh/updateServiceWorker at all.
              onClick={() => {
                const locale = useLocaleStore.getState().locale;
                router.navigate(buildLocalizedPath(locale, '/changelog'));
              }}
            >
              {t('viewChanges')}
            </Button>
            <Button
              color="inherit"
              size="small"
              onClick={() => {
                if (waitingScriptURL !== undefined) {
                  sessionStorage.setItem(DISMISSED_UPDATE_KEY, waitingScriptURL);
                }
                setNeedRefresh(false);
              }}
            >
              {t('updateLater')}
            </Button>
            <Button color="inherit" size="small" onClick={() => void updateServiceWorker(true)}>
              {t('updateNow')}
            </Button>
          </Stack>
        }
      >
        {t('updateAvailable', { version: APP_VERSION })}
      </Alert>
    </Snackbar>
  );
}
