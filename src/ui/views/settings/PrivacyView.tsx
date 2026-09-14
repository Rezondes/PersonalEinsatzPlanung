import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import { useTranslation } from 'react-i18next';
import { usePageActions } from '@ui/app/PageActionsContext';
import { useBreakpoint } from '@ui/hooks/useBreakpoint';

export function PrivacyView() {
  const layout = useBreakpoint();
  usePageActions({ fullBleedPage: true });
  const { t } = useTranslation('privacy');
  const sections = t('sections', { returnObjects: true });

  return (
    <Box
      sx={{
        maxWidth: 920,
        mx: 'auto',
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        minHeight: 0,
        height: '100%',
        px: layout === 'mobile' ? 1.5 : 3,
        py: layout === 'mobile' ? 1.5 : 3,
      }}
    >
      <Typography variant="h5" component="h1" fontWeight={500} sx={{ mb: 3 }}>
        {t('heading')}
      </Typography>
      <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        <Stack spacing={2} data-selectable>
          {sections.map((section) => (
            <Paper key={section.title} sx={{ p: 3 }}>
              <Typography variant="subtitle1" component="h2" fontWeight={500} sx={{ mb: 1 }}>
                {section.title}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {section.text}
              </Typography>
            </Paper>
          ))}
        </Stack>
      </Box>
    </Box>
  );
}
