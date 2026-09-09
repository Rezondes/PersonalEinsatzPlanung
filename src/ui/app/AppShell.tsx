import { useLayoutEffect, useRef } from 'react';
import { Outlet } from 'react-router-dom';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import { BuildVersionBadge } from '@ui/components/BuildVersionBadge';
import { useBreakpoint } from '@ui/hooks/useBreakpoint';
import { AppHeader } from './AppHeader';
import { PageActionsProvider, usePageActionsValue } from './PageActionsContext';
import { LaptopNav } from './nav/LaptopNav';
import { NavRail } from './nav/NavRail';
import { BottomTabBar } from './nav/BottomTabBar';
import { MobileFab } from './nav/MobileFab';
import { mobileSafeBottom } from './nav/mobileChromeOffset';

export function AppShell() {
  // A thin wrapper: the actual layout lives in AppShellLayout, mounted as a CHILD of
  // PageActionsProvider (not a sibling of it) so its usePageActionsValue() call - needed for the
  // fullBleedMobile branch below - actually sees what a view registers. Calling that hook here
  // instead would not work: this component RENDERS the Provider, it isn't rendered inside one.
  return (
    <PageActionsProvider>
      <AppShellLayout />
    </PageActionsProvider>
  );
}

function AppShellLayout() {
  const layout = useBreakpoint();
  const { fullBleedMobile } = usePageActionsValue();
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

  // A view (only Woche today) can opt into a zero-padding, bounded flex-column instead of the
  // normal padded/page-scrolling Container - see PageActionsContext's doc comment on
  // fullBleedMobile for why. Irrelevant outside mobile: at every other breakpoint the padded
  // branch always applies, same as before this existed.
  const fullBleed = layout === 'mobile' && !!fullBleedMobile;

  return (
    <Box ref={rootRef} sx={{ minHeight: ['100vh', '100dvh'], backgroundColor: 'background.default', display: 'flex' }}>
      {showRail && <NavRail />}

      <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <AppHeader headerRef={headerRef} nav={nav} />

        <Container
          maxWidth={layout === 'mobile' ? false : 'xl'}
          disableGutters={layout === 'mobile'}
          sx={
            fullBleed
              ? {
                  flex: 1,
                  minHeight: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                  p: 0,
                  // The fixed BottomTabBar is a sibling, not a descendant, of this Container - it
                  // paints on top of whatever is underneath it. Without reserving its own height
                  // here, this Container's last flex child (the schedule grid's toolbar bar) would
                  // render right where the tab bar visually covers it, not above it.
                  pb: mobileSafeBottom(0),
                }
              : {
                  flex: 1,
                  px: layout === 'mobile' ? 1.5 : 3,
                  py: 3,
                  // Mobile content must clear the fixed BottomTabBar (and MobileFab, which floats
                  // above it) so the last row of a list or the schedule grid's toolbar sheet isn't
                  // hidden behind them.
                  pb: layout === 'mobile' ? mobileSafeBottom(24) : 3,
                }
          }
        >
          <Outlet />
        </Container>
      </Box>

      {layout === 'mobile' && <BottomTabBar />}
      {layout === 'mobile' && <MobileFab />}

      <BuildVersionBadge />
    </Box>
  );
}
