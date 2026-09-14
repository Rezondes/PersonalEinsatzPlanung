import Typography from '@mui/material/Typography';
import { useTranslation } from 'react-i18next';

/** Explains the asterisk MUI renders on `required` fields. Rendered once, as the first child of a
 * dialog's DialogContent. Plain text on purpose: no alert/status role, so screen readers read it
 * once as content and never mistake it for an error. */
export function RequiredLegend() {
  const { t } = useTranslation();

  return (
    <Typography component="p" variant="caption" color="text.secondary" sx={{ mb: 1 }}>
      {t('requiredLegend')}
    </Typography>
  );
}
