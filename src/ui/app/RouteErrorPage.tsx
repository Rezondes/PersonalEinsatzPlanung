import { Link as RouterLink, isRouteErrorResponse, useRouteError } from 'react-router-dom';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { useTranslation } from 'react-i18next';
import { useLocale } from './locale/useLocale';
import { buildLocalizedPath } from './locale/locale';

/**
 * Replaces React Router's built-in "Unexpected Application Error" developer page. Mounted twice in
 * router.tsx: as the `*` child inside AppShell (an unknown path, so the nav stays usable - there is
 * no route error to read there, hence the explicit `notFound`), and as the `/:locale` route's
 * errorElement, which catches anything a view throws while rendering.
 */
export function RouteErrorPage({ notFound = false }: { notFound?: boolean }) {
  const error = useRouteError();
  const locale = useLocale();
  const { t } = useTranslation('app');
  const isNotFound = notFound || (isRouteErrorResponse(error) && error.status === 404);

  return (
    // Only the errorElement variant needs its own padding - the `*` route already sits inside
    // AppShell's padded Container.
    <Box sx={{ p: notFound ? 0 : 3 }}>
      <Typography variant="h5" component="h1" fontWeight={500} sx={{ mb: 1 }}>
        {isNotFound ? t('notFoundTitle') : t('errorTitle')}
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        {isNotFound ? t('notFoundText') : t('errorText')}
      </Typography>
      {isNotFound ? (
        <Button variant="contained" component={RouterLink} to={buildLocalizedPath(locale, '/schedule')}>
          {t('notFoundAction')}
        </Button>
      ) : (
        <Button variant="contained" onClick={() => window.location.reload()}>
          {t('errorAction')}
        </Button>
      )}
    </Box>
  );
}
