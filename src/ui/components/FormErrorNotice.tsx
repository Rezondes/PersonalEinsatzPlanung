import Typography from '@mui/material/Typography';
import { useTranslation } from 'react-i18next';
import type { FieldError } from '@domain/validation/FieldError';

interface FormErrorNoticeProps {
  errors: readonly FieldError[];
}

/** One-line summary shown next to the dialog buttons after a failed save attempt, where the eye is
 * right after clicking. The details live on the fields themselves; this line only announces that
 * something is wrong (role alert, so screen readers hear it immediately). */
export function FormErrorNotice({ errors }: FormErrorNoticeProps) {
  const { t } = useTranslation();
  if (errors.length === 0) {
    return null;
  }
  return (
    <Typography role="alert" variant="body2" color="error" sx={{ mr: 'auto' }}>
      {t('formErrorNotice')}
    </Typography>
  );
}
