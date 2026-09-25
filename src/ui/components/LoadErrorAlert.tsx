import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import { useTranslation } from 'react-i18next';

/** Shown in place of a list's empty state when its load failed (`useAsyncData`'s `error`). Without
 * it a failed load looked exactly like "nothing there", which offline read as lost data. */
export function LoadErrorAlert({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <Alert
      severity="error"
      action={
        <Button color="inherit" size="small" onClick={onRetry}>
          {t('retry')}
        </Button>
      }
    >
      {t('loadFailedAlert')}
    </Alert>
  );
}
