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
      disabled={fab.disabled}
      sx={{
        position: 'fixed',
        right: 16,
        bottom: mobileSafeBottom(16),
        zIndex: (theme) => theme.zIndex.appBar,
        // MUI's own Fab hover darkens toward primary.dark, which theme.ts pins to the mode-stable
        // accent.dark (meant for solid-fill-plus-white-text spots, see accentColors.ts) rather than
        // a mode-adjusted shade - in dark mode that darkens the background while the resting
        // auto-contrastText (computed from the lighter primary.main) stays put, dropping contrast
        // on hover. Real touch taps are unaffected (MUI already resets this under
        // @media (hover:none)); this only fixes mouse/trackpad hover.
        '&:hover': { backgroundColor: 'primary.main' },
      }}
    >
      <fab.icon sx={{ mr: 1 }} />
      {fab.label}
    </Fab>
  );
}
