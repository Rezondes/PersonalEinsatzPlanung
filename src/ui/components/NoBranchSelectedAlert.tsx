import { Link as RouterLink } from 'react-router-dom';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import { useTranslation } from 'react-i18next';
import { useLocale } from '@ui/app/locale/useLocale';
import { buildLocalizedPath } from '@ui/app/locale/locale';
import { useBranchesStore } from '@ui/app/store/branchesStore';

/**
 * Shown by every view that needs a selected Branch once none is selected. Two cases, because
 * AppHeader.tsx only renders its Filiale Select while at least one ACTIVE Filiale exists: with
 * none (a fresh install, or all deactivated) there is nothing "oben" to pick, so the alert asks to
 * create one instead and the button is the only way to /branches. "No active Filiale" is only
 * claimed once the list has loaded, never during the initial load.
 */
export function NoBranchSelectedAlert() {
  const locale = useLocale();
  const { t } = useTranslation();
  // Straight from the store: every view that renders this already loads the list via its own
  // useBranchList() call, and that hook does not expose `loaded`.
  const noneExists = useBranchesStore((s) => s.loaded && !s.branches.some((b) => b.active));

  return (
    <Alert
      severity="info"
      action={
        <Button component={RouterLink} to={buildLocalizedPath(locale, '/branches')} color="inherit" size="small">
          {noneExists ? t('createBranch') : t('goToBranches')}
        </Button>
      }
    >
      {noneExists ? t('noBranchExists') : t('noBranchSelected')}
    </Alert>
  );
}
