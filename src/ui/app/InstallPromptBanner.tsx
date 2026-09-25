import { useState } from 'react';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import { useTranslation } from 'react-i18next';
import { useInstallPrompt } from '@ui/hooks/useInstallPrompt';
import { promptInstall } from './installPrompt';

const DISMISSED_INSTALL_KEY = 'pep.install.dismissed';
// Clears the AppHeader plus a small margin. AppShell publishes the header's measured height on
// <html>, so the variable resolves here too even though this banner mounts outside the router.
const BANNER_TOP_OFFSET = 'calc(var(--pep-header-height, 64px) + 8px)';

/**
 * Proactively offers to install the app once the browser reports it as installable (Desktop
 * Chrome/Edge or Android Chrome - both fire the identical `beforeinstallprompt` event captured by
 * installPrompt.ts). SettingsView.tsx's own "App installieren" button stays as a manual fallback;
 * this banner is the same underlying offer, just surfaced without the user having to find it.
 *
 * Named InstallPromptBanner, not InstallPrompt: this filesystem is case-insensitive
 * (`git config core.ignorecase` is true here), and a same-directory `InstallPrompt.tsx` differing
 * from `installPrompt.ts` only by the first letter's case caused Vite's resolver to load the wrong
 * module entirely (a bare `undefined` import, no error until React tried to render it). Never
 * name a new file in this directory something that differs from an existing one only by case.
 *
 * iOS Safari never fires `beforeinstallprompt` at all, so `installable` stays false there and this
 * banner never appears - the existing manual "Teilen -> Zum Home-Bildschirm" hint in Settings
 * remains the only path for iOS, unchanged.
 *
 * Unlike UpdatePrompt (whose useRegisterSW gives it a [value, setter] tuple for free),
 * useInstallPrompt() returns a plain boolean with no setter - dismissing this banner is therefore
 * genuinely local state, not a shared one to clear.
 */
export function InstallPromptBanner() {
  const { t } = useTranslation('app');
  const { t: tSettings } = useTranslation('settings');
  const installable = useInstallPrompt();
  const [dismissed, setDismissed] = useState(() => sessionStorage.getItem(DISMISSED_INSTALL_KEY) === '1');

  return (
    <Snackbar
      open={installable && !dismissed}
      anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      // !important: MuiSnackbar's own anchorOriginTopCenter class sets its own `top` from a
      // min-width media query at equal-or-higher specificity - the same reason UpdatePrompt/
      // AppNotifications need it for their bottom offset. Confirmed live: a plain override here is
      // silently ignored without it.
      sx={{ '@media print': { display: 'none' }, top: `${BANNER_TOP_OFFSET} !important` }}
    >
      <Alert
        severity="info"
        variant="filled"
        action={
          <>
            <Button
              color="inherit"
              size="small"
              onClick={() => {
                sessionStorage.setItem(DISMISSED_INSTALL_KEY, '1');
                setDismissed(true);
              }}
            >
              {t('installLater')}
            </Button>
            <Button color="inherit" size="small" onClick={() => void promptInstall()}>
              {tSettings('appStorage.installButton')}
            </Button>
          </>
        }
      >
        {t('installAvailable')}
      </Alert>
    </Snackbar>
  );
}
