// Must be the first import - see the file itself for why (it patches a global that router.tsx's
// own module-level createHashRouter(routes) call needs to see already applied).
import '../../testStubs/patchDataRouterRequestSignal';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import { theme } from './theme';
import { useBranchesStore } from './store/branchesStore';
import { useBranchSelectionStore } from './store/branchSelectionStore';
import { useLocaleStore } from './locale/localeStore';
import { routes } from './router';

// Every leaf view gets a lightweight stand-in, same approach as AppShell.test.tsx - this file
// tests ROUTING (redirects, locale param handling, path preservation, print-route isolation, lang
// sync), not each view's own rendering correctness, which already has its own dedicated test file.
vi.mock('@ui/views/schedule/ScheduleView', () => ({ ScheduleView: () => <div>schedule-view</div> }));
vi.mock('@ui/views/month/MonthOverviewView', () => ({ MonthOverviewView: () => <div>month-view</div> }));
vi.mock('@ui/views/masterdata/BranchMasterDataView', () => ({
  BranchMasterDataView: () => <div>branches-view</div>,
}));
vi.mock('@ui/views/masterdata/EmployeeMasterDataView', () => ({
  EmployeeMasterDataView: () => <div>employees-view</div>,
}));
vi.mock('@ui/views/absences/AbsencesView', () => ({ AbsencesView: () => <div>absences-view</div> }));
vi.mock('@ui/views/print/PrintPreviewView', () => ({ PrintPreviewView: () => <div>print-view</div> }));
vi.mock('@ui/views/settings/SettingsView', () => ({ SettingsView: () => <div>settings-view</div> }));
vi.mock('@ui/views/settings/PrivacyView', () => ({ PrivacyView: () => <div>privacy-view</div> }));
vi.mock('@ui/views/settings/TermsView', () => ({ TermsView: () => <div>terms-view</div> }));
vi.mock('@ui/views/changelog/ChangelogView', () => ({ ChangelogView: () => <div>changelog-view</div> }));

/** jsdom has no real layout engine, so `window.matchMedia` is mocked to answer as if the viewport
 * were `width` wide. Copied from AppShell.test.tsx/useBreakpoint.test.tsx. Pinned to a tablet width
 * so AppShell's real NavRail renders (exercising its own useLocale()/buildLocalizedPath calls)
 * without needing a mobile-only BottomTabBar/MobileFab. */
function mockViewportWidth(width: number) {
  window.matchMedia = ((query: string) => {
    const match = /min-width:\s*(\d+(?:\.\d+)?)px/.exec(query);
    const minWidth = match ? Number(match[1]) : 0;
    return {
      matches: width >= minWidth,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    } as unknown as MediaQueryList;
  }) as typeof window.matchMedia;
}

// ThemeProvider wraps the real app theme: at tablet width this renders the real NavRail (see the
// mockViewportWidth comment above), whose active-link style reads the custom
// theme.palette.accentSurface key - absent on MUI's own default theme, so resolving it throws
// without this.
function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(
    <ThemeProvider theme={theme}>
      <RouterProvider router={router} />
    </ThemeProvider>,
  );
  return router;
}

describe('router', () => {
  beforeEach(() => {
    mockViewportWidth(900);
    useBranchesStore.setState({ branches: [], loading: false, loaded: true });
    useBranchSelectionStore.setState({ selectedBranchId: null });
    useLocaleStore.setState({ locale: 'de' });
    document.documentElement.lang = '';
  });

  afterEach(() => {
    // @ts-expect-error -- undo the per-test stub, jsdom has no matchMedia of its own to restore
    delete window.matchMedia;
  });

  it('redirects the bare hash root to /de/schedule', async () => {
    const router = renderAt('/');

    await screen.findByText('schedule-view');
    expect(router.state.location.pathname).toBe('/de/schedule');
  });

  it('redirects an unsupported locale segment to /de, preserving the rest of the path', async () => {
    const router = renderAt('/xx/schedule');

    await screen.findByText('schedule-view');
    expect(router.state.location.pathname).toBe('/de/schedule');
  });

  it('renders directly at /de/schedule with no redirect', async () => {
    const router = renderAt('/de/schedule');

    await screen.findByText('schedule-view');
    expect(router.state.location.pathname).toBe('/de/schedule');
  });

  it('renders directly at /de/settings with no redirect', async () => {
    const router = renderAt('/de/settings');

    await screen.findByText('settings-view');
    expect(router.state.location.pathname).toBe('/de/settings');
  });

  it('renders the print route outside any AppShell nav chrome', async () => {
    renderAt('/de/print/abc');

    await screen.findByText('print-view');
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  it('redirects an old bare bookmark to a non-default page onto /de/schedule (accepted quirk)', async () => {
    // /settings has no `/:locale` segment of its own - "settings" itself gets consumed AS the
    // (invalid) locale attempt by localeLoader and dropped, so this does NOT preserve "/settings".
    // This is a deliberate, accepted one-time quirk (see the plan's Context section), not a bug -
    // a future fix to preserve the path should update this test on purpose, not by silently
    // no longer failing it.
    const router = renderAt('/settings');

    await screen.findByText('schedule-view');
    expect(router.state.location.pathname).toBe('/de/schedule');
  });

  it('syncs document.documentElement.lang and the locale store after navigating', async () => {
    renderAt('/de/settings');

    await screen.findByText('settings-view');
    await waitFor(() => {
      expect(document.documentElement.lang).toBe('de');
      expect(useLocaleStore.getState().locale).toBe('de');
    });
  });
});
