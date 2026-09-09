import Fab from '@mui/material/Fab';
import { usePageActionsValue } from '../PageActionsContext';
import { mobileSafeBottom } from './mobileChromeOffset';

/**
 * Renders whatever the current view registered via usePageActions - or nothing. Woche, Monat and
 * Mehr register no Fab (confirmed against the mockup art: the schedule screen's primary touch
 * affordance is the "Vorlagen & Werkzeuge" sheet handle instead, and Monat/Mehr have no single
 * create action), so this can render null on those routes.
 */
export function MobileFab() {
  const { fab } = usePageActionsValue();
  if (!fab) return null;

  return (
    <Fab
      variant="extended"
      color="primary"
      onClick={fab.onClick}
      sx={{
        position: 'fixed',
        right: 16,
        bottom: mobileSafeBottom(16),
        zIndex: (theme) => theme.zIndex.appBar,
      }}
    >
      <fab.icon sx={{ mr: 1 }} />
      {fab.label}
    </Fab>
  );
}
