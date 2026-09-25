import { Link as RouterLink, isRouteErrorResponse, useRouteError } from 'react-router-dom';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useTranslation } from 'react-i18next';
import { useLocale } from './locale/useLocale';
import { buildLocalizedPath } from './locale/locale';

/**
 * Replaces React Router's built-in "Unexpected Application Error" developer page. Mounted three
 * times in router.tsx: as the `*` child inside AppShell (an unknown path - there is no route error
 * to read there, hence the explicit `notFound`), as the errorElement of the pathless route around
 * the views (`inShell`: a view threw, the shell around it still stands), and as the `/:locale`
 * route's errorElement, the last resort outside the shell.
 */
export function RouteErrorPage({ notFound = false, inShell = false }: { notFound?: boolean; inShell?: boolean }) {
  const error = useRouteError();
  const locale = useLocale();
  const { t } = useTranslation('app');
  const isNotFound = notFound || (isRouteErrorResponse(error) && error.status === 404);

  return (
    // Only the variant outside the shell needs its own padding - the other two already sit inside
    // AppShell's padded Container.
    <Box sx={{ p: notFound || inShell ? 0 : 3 }}>
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
        // Reloading often hits the same error again, so the way to another page is offered too.
        <Stack direction="row" spacing={2}>
          <Button variant="contained" onClick={() => window.location.reload()}>
            {t('errorAction')}
          </Button>
          <Button component={RouterLink} to={buildLocalizedPath(locale, '/schedule')}>
            {t('notFoundAction')}
          </Button>
        </Stack>
      )}
    </Box>
  );
}
