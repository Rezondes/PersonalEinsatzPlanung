import { Link as RouterLink } from 'react-router-dom';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import { useTranslation } from 'react-i18next';
import { useLocale } from '@ui/app/locale/useLocale';
import { buildLocalizedPath } from '@ui/app/locale/locale';

/**
 * Shown by every view that needs a selected Branch once none is selected. The message says
 * "oben" (in AppHeader's Select), but that Select doesn't render at all once there are no active
 * Filialen left (see AppHeader.tsx) - the action button is the only way back to /branches in that
 * case, not just a shortcut.
 */
export function NoBranchSelectedAlert() {
  const locale = useLocale();
  const { t } = useTranslation();

  return (
    <Alert
      severity="info"
      action={
        <Button component={RouterLink} to={buildLocalizedPath(locale, '/branches')} color="inherit" size="small">
          {t('goToBranches')}
        </Button>
      }
    >
      {t('noBranchSelected')}
    </Alert>
  );
}
