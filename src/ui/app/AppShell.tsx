import { useLayoutEffect, useRef } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import { BuildVersionBadge } from '@ui/components/BuildVersionBadge';
import { useBreakpoint } from '@ui/hooks/useBreakpoint';
import { useDocumentTitle } from '@ui/hooks/useDocumentTitle';
import { AppHeader } from './AppHeader';
import { titleForPath } from './routeMeta';
import { PageActionsProvider, usePageActionsValue } from './PageActionsContext';
import { LaptopNav } from './nav/LaptopNav';
import { NavRail } from './nav/NavRail';
import { BottomTabBar } from './nav/BottomTabBar';
import { MobileFab } from './nav/MobileFab';
import { mobileSafeBottom } from './nav/mobileChromeOffset';

export function AppShell() {
  // A thin wrapper: the actual layout lives in AppShellLayout, mounted as a CHILD of
  // PageActionsProvider (not a sibling of it) so its usePageActionsValue() call - needed for the
  // fullBleedPage branch below - actually sees what a view registers. Calling that hook here
  // instead would not work: this component RENDERS the Provider, it isn't rendered inside one.
  return (
    <PageActionsProvider>
      <AppShellLayout />
    </PageActionsProvider>
  );
}

function AppShellLayout() {
  const layout = useBreakpoint();
  const { fullBleedPage } = usePageActionsValue();
  const rootRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  // The one place this is called - no individual view needs to set its own title. Deliberately not
  // a visible on-page heading (see ui/CLAUDE.md on why those were removed); this only reaches the
  // browser tab and assistive tech.
  const location = useLocation();
  useDocumentTitle(titleForPath(location.pathname));

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

  // A view can opt into a zero-padding, bounded flex-column instead of the normal
  // padded/page-scrolling Container - see PageActionsContext's doc comment on fullBleedPage for
  // why. Applies at every breakpoint: the page itself never scrolls anywhere in the app, only
  // whichever bounded region a view designates as its own (its table, list, or section stack).
  const fullBleed = !!fullBleedPage;

  return (
    // `height`, not `minHeight`: a min only floors the box at the viewport height, it never caps
    // it - if content further down doesn't shrink to fit, this Box (and with it html/body, which
    // auto-size to their single child) simply grows past the viewport and the whole PAGE scrolls
    // instead of the Wochenplanung table alone. A fixed `height` makes every `flex:1, minHeight:0`
    // descendant's height definite instead of content-driven, which is what lets
    // AppShellLayout's fullBleed Container's `overflow:hidden` actually clip - `overflow:hidden`
    // on an auto-sized box is a no-op since an auto box always exactly fits its own content.
    // Harmless for every other (non-fullBleed) route: nothing between here and their Container sets
    // `overflow:hidden`, so a page taller than the viewport still overflows visibly and the browser
    // still scrolls the document, same as before.
    // Plain '100dvh', not the `['100vh', '100dvh']` breakpoint-array form used elsewhere in this
    // file for iOS Safari's dynamic toolbar: that array is a MUI RESPONSIVE value (100vh below the
    // `sm` breakpoint, 100dvh from `sm` up), not a CSS fallback - it does not mean "prefer dvh,
    // fall back to vh where unsupported". With a firm `height` (unlike a `minHeight` floor, where
    // this was harmless), using plain vh below `sm` made the root taller than the actually-visible
    // area on mobile Chrome whenever its address bar was showing, leaving exactly that much residual
    // page scroll - the same bug this fix removes, just reintroduced at the unit level. dvh is
    // supported by every browser this app targets, so there is no real fallback need here.
    <Box ref={rootRef} sx={{ height: '100dvh', backgroundColor: 'background.default', display: 'flex' }}>
      {showRail && <NavRail />}

      <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <AppHeader headerRef={headerRef} nav={nav} />

        <Container
          maxWidth={fullBleed ? false : 'xl'}
          disableGutters={fullBleed}
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
                  // render right where the tab bar visually covers it, not above it. Tablet has no
                  // such fixed bottom chrome (NavRail is a side rail instead), so nothing to clear.
                  pb: layout === 'mobile' ? mobileSafeBottom(0) : 0,
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
