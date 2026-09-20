import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import CircularProgress from '@mui/material/CircularProgress';
import Link from '@mui/material/Link';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useTranslation } from 'react-i18next';
import { formatDateGerman } from '@domain/shared/DateFormat';
import { usePageActions } from '@ui/app/PageActionsContext';
import { useBreakpoint } from '@ui/hooks/useBreakpoint';
import { useChangelog } from '@ui/hooks/useChangelog';

/** Reads the project's own GitHub Releases (see infrastructure/changelog/githubReleases.ts) so
 * anyone can see what changed between deploys without leaving the app. One deliberate, isolated
 * exception to "no outbound requests" - see PrivacyView.tsx. */
export function ChangelogView() {
  const layout = useBreakpoint();
  usePageActions({ fullBleedPage: true });
  const { releases, loading } = useChangelog();
  const { t } = useTranslation('changelog');
  const { t: tNav } = useTranslation('nav');

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
        {tNav('changelog')}
      </Typography>
      <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        {loading ? (
          <Stack alignItems="center" spacing={2} sx={{ py: 8 }}>
            <CircularProgress />
            <Typography role="status" variant="body2" color="text.secondary">
              {t('loading')}
            </Typography>
          </Stack>
        ) : releases.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            {t('empty')}
          </Typography>
        ) : (
          <Stack spacing={2}>
            {/* Each Accordion keeps its own uncontrolled expanded state (defaultExpanded, not a
                shared `expanded` prop) - that's what lets several stay open at once instead of
                collapsing one another. Only the first (newest, per fetchChangelog's own sort -
                see githubReleases.ts) starts open. */}
            {releases.map((release, index) => (
              <Accordion key={release.tagName} defaultExpanded={index === 0} disableGutters>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Stack direction="row" justifyContent="space-between" alignItems="baseline" flexWrap="wrap" gap={1} sx={{ flex: 1, mr: 1 }}>
                    <Typography variant="subtitle1" component="h2" fontWeight={500}>
                      {release.title}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {formatDateGerman(new Date(release.publishedAt))}
                    </Typography>
                  </Stack>
                </AccordionSummary>
                <AccordionDetails>
                  {release.entries.length > 0 && (
                    <List dense sx={{ listStyleType: 'disc', pl: 2 }}>
                      {release.entries.map((entry, entryIndex) => (
                        <ListItem key={entryIndex} sx={{ display: 'list-item', p: 0 }}>
                          <ListItemText primary={entry} />
                        </ListItem>
                      ))}
                    </List>
                  )}
                  <Link href={release.url} target="_blank" rel="noreferrer" variant="body2" sx={{ mt: 1, display: 'inline-block' }}>
                    {t('viewOnGitHub')}
                  </Link>
                </AccordionDetails>
              </Accordion>
            ))}
          </Stack>
        )}
      </Box>
    </Box>
  );
}
