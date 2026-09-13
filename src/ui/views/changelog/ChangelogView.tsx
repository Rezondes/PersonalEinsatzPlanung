import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import CircularProgress from '@mui/material/CircularProgress';
import Link from '@mui/material/Link';
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

  return (
    <Box
      sx={{
        maxWidth: 720,
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        minHeight: 0,
        height: '100%',
        px: layout === 'mobile' ? 1.5 : 3,
        py: layout === 'mobile' ? 1.5 : 3,
      }}
    >
      <Typography variant="h5" fontWeight={500} sx={{ mb: 3 }}>
        Änderungen
      </Typography>
      <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        {loading ? (
          <Stack alignItems="center" spacing={2} sx={{ py: 8 }}>
            <CircularProgress />
            <Typography role="status" variant="body2" color="text.secondary">
              Änderungen werden geladen…
            </Typography>
          </Stack>
        ) : releases.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            Noch keine Einträge vorhanden.
          </Typography>
        ) : (
          <Stack spacing={2}>
            {releases.map((release) => (
              <Paper key={release.tagName} sx={{ p: 3 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="baseline" flexWrap="wrap" gap={1}>
                  <Typography variant="subtitle1" fontWeight={500}>
                    {release.title}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {formatDateGerman(new Date(release.publishedAt))}
                  </Typography>
                </Stack>
                {release.entries.length > 0 && (
                  <List dense sx={{ listStyleType: 'disc', pl: 2 }}>
                    {release.entries.map((entry, index) => (
                      <ListItem key={index} sx={{ display: 'list-item', p: 0 }}>
                        <ListItemText primary={entry} />
                      </ListItem>
                    ))}
                  </List>
                )}
                <Link href={release.url} target="_blank" rel="noreferrer" variant="body2" sx={{ mt: 1, display: 'inline-block' }}>
                  Auf GitHub ansehen
                </Link>
              </Paper>
            ))}
          </Stack>
        )}
      </Box>
    </Box>
  );
}
