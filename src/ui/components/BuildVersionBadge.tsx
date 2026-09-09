import Box from '@mui/material/Box';
import { APP_VERSION } from '@ui/app/buildInfo';
import { useBreakpoint } from '@ui/hooks/useBreakpoint';
import { mobileSafeBottom } from '@ui/app/nav/mobileChromeOffset';

/**
 * The build identity, pinned to the bottom right corner of the window.
 *
 * Placed so it is in frame on any screenshot regardless of scroll position, while staying out of
 * the way in daily use: it is small and muted, takes no clicks (`pointer-events: none`, so it can
 * never swallow a click meant for something underneath) and is hidden from screen readers - the
 * readable copy, together with the build time and the commit, lives on the Einstellungen page.
 *
 * Rendered from AppShell, which is why it does not appear on the print export: `/print/:scheduleId`
 * is deliberately its own route outside the shell (see app/router.tsx). The print media query
 * covers the remaining case of someone printing a normal page.
 *
 * The low z-index keeps dialogs (1300) and the app bar (1100) above it.
 */
export function BuildVersionBadge() {
  const layout = useBreakpoint();
  return (
    <Box
      aria-hidden
      sx={{
        position: 'fixed',
        right: 6,
        bottom: layout === 'mobile' ? mobileSafeBottom(4) : 4,
        zIndex: 1,
        pointerEvents: 'none',
        userSelect: 'none',
        fontFamily: 'monospace',
        fontSize: 10,
        lineHeight: 1,
        color: 'text.disabled',
        '@media print': { display: 'none' },
      }}
    >
      {APP_VERSION}
    </Box>
  );
}
