import { useLayoutEffect, useRef } from 'react';
import { Outlet } from 'react-router-dom';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import { BuildVersionBadge } from '@ui/components/BuildVersionBadge';
import { useBreakpoint } from '@ui/hooks/useBreakpoint';
import { AppHeader } from './AppHeader';
import { PageActionsProvider } from './PageActionsContext';
import { LaptopNav } from './nav/LaptopNav';
import { NavRail } from './nav/NavRail';
import { BottomTabBar } from './nav/BottomTabBar';
import { MobileFab } from './nav/MobileFab';
import { mobileSafeBottom } from './nav/mobileChromeOffset';

export function AppShell() {
  const layout = useBreakpoint();
  const rootRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement>(null);

  // The header's toolbar wraps at narrow widths, so its height is not a constant. Publishing it as
  // a CSS custom property lets a sticky element below it (the Wochenplanung toolbar) dock exactly
  // underneath without hardcoding 64px. Written straight to the DOM, deliberately not via state:
  // a resize must not re-render the whole shell. AppHeader is mounted at every breakpoint (its
  // `nav` slot varies; navigation itself moves to BottomTabBar/NavRail where applicable), so the
  // observed element never disappears and this needs no per-layout branch.
  useLayoutEffect(() => {
    const root = rootRef.current;
    const header = headerRef.current;
    if (!root || !header) return;

    const publish = () => root.style.setProperty('--pep-header-height', `${header.offsetHeight}px`);
    publish();

    // jsdom has no ResizeObserver and the app must still render in tests.
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(publish);
    observer.observe(header);
    return () => observer.disconnect();
  }, []);

  // Mobile -> bottom tab bar; tablet (portrait AND landscape) -> the sidebar rail; only once
  // there's room for a full horizontal row (laptop) does navigation move into the top bar. Not
  // three separate nav chromes in sequence - the rail covers both tablet widths.
  const showRail = layout === 'tabletPortrait' || layout === 'tabletLandscape';
  const nav = layout === 'laptop' ? <LaptopNav /> : undefined;

  return (
    <PageActionsProvider>
      <Box ref={rootRef} sx={{ minHeight: '100vh', backgroundColor: 'background.default', display: 'flex' }}>
        {showRail && <NavRail />}

        <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <AppHeader headerRef={headerRef} nav={nav} />

          <Container
            maxWidth={layout === 'mobile' ? false : 'xl'}
            disableGutters={layout === 'mobile'}
            sx={{
              flex: 1,
              px: layout === 'mobile' ? 1.5 : 3,
              py: 3,
              // Mobile content must clear the fixed BottomTabBar (and MobileFab, which floats
              // above it) so the last row of a list or the schedule grid's toolbar sheet isn't
              // hidden behind them.
              pb: layout === 'mobile' ? mobileSafeBottom(24) : 3,
            }}
          >
            <Outlet />
          </Container>
        </Box>

        {layout === 'mobile' && <BottomTabBar />}
        {layout === 'mobile' && <MobileFab />}

        <BuildVersionBadge />
      </Box>
    </PageActionsProvider>
  );
}
