import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route, Link, useNavigate } from 'react-router-dom';
import { useBranchesStore } from '@ui/app/store/branchesStore';
import { useBranchSelectionStore } from '@ui/app/store/branchSelectionStore';
import { AppShell } from './AppShell';
import { usePageActions } from './PageActionsContext';

/** jsdom has no real layout engine, so `window.matchMedia` is mocked to answer as if the viewport
 * were `width` wide. Copied from useBreakpoint.test.tsx. Pinned to laptop width throughout this
 * file so NavRail/BottomTabBar/MobileFab (none of which this test needs) do not render at all. */
function mockViewportWidth(width: number, height = 900) {
  window.matchMedia = ((query: string) => {
    const minWidth = /min-width:\s*(\d+(?:\.\d+)?)px/.exec(query);
    const maxHeight = /max-height:\s*(\d+(?:\.\d+)?)px/.exec(query);
    return {
      matches: (!minWidth || width >= Number(minWidth[1])) && (!maxHeight || height <= Number(maxHeight[1])),
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

function PageA() {
  const navigate = useNavigate();
  return (
    <>
      <h1>Seite A</h1>
      <Link to="/page-b">zu B</Link>
      <button type="button" onClick={() => navigate('/page-a?x=1')}>
        nur Query
      </button>
    </>
  );
}

function FullBleedStub() {
  usePageActions({ fullBleedPage: true });
  return <div>fullbleed-view</div>;
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={<AppShell />}>
          <Route path="schedule" element={<div>schedule-view</div>} />
          <Route path="absences" element={<div>absences-view</div>} />
          <Route path="fullbleed" element={<FullBleedStub />} />
          <Route path="page-a" element={<PageA />} />
          <Route path="page-b" element={<h1>Seite B</h1>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('AppShell', () => {
  beforeEach(() => {
    mockViewportWidth(1700);
    useBranchesStore.setState({ branches: [], loading: false, loaded: true });
    useBranchSelectionStore.setState({ selectedBranchId: null });
  });

  afterEach(() => {
    // @ts-expect-error -- undo the per-test stub, jsdom has no matchMedia of its own to restore
    delete window.matchMedia;
  });

  it('sets document.title from routeMeta for the current route', () => {
    renderAt('/absences');

    expect(document.title).toBe('Abwesenheiten - Personaleinsatzplanung');
  });

  it('sets a different title for a different route', () => {
    renderAt('/schedule');

    expect(document.title).toBe('Wochenplanung - Personaleinsatzplanung');
  });

  it('hat ein main-Landmark mit id=main-content', () => {
    const { container } = renderAt('/schedule');

    expect(container.querySelector('main#main-content')).toBeInTheDocument();
  });

  it('clips a full-bleed page on an upright phone, so only its own region scrolls', async () => {
    mockViewportWidth(390, 844);
    const { container } = renderAt('/fullbleed');
    await screen.findByText('fullbleed-view');

    const main = container.querySelector('main')!;
    expect(getComputedStyle(main).overflow).toBe('hidden');
    expect(getComputedStyle(main.parentElement!.parentElement!).height).toBe('100dvh');
  });

  it('lets the document scroll on a phone held sideways (height <= 500px) instead of clipping', async () => {
    mockViewportWidth(780, 360);
    const { container } = renderAt('/fullbleed');
    await screen.findByText('fullbleed-view');

    const main = container.querySelector('main')!;
    expect(getComputedStyle(main).overflow).toBe('visible');
    // The shell root no longer caps the height, so every view's height:100% resolves to its
    // content height and the whole page scrolls (the Mitarbeiter list was 0px tall at 780x360).
    expect(getComputedStyle(main.parentElement!.parentElement!).height).not.toBe('100dvh');
  });

  // Teil 6, Package 7: after a page change the focus stayed on the nav tab, so a screen reader
  // only heard the changed document title.
  it('moves the focus to the h1 of the new page after a page change', async () => {
    renderAt('/page-a');

    await userEvent.setup().click(screen.getByRole('link', { name: 'zu B' }));

    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('heading', { level: 1, name: 'Seite B' })));
    expect(screen.getByRole('heading', { level: 1, name: 'Seite B' })).toHaveAttribute('tabindex', '-1');
  });

  it('leaves the focus alone on the first load, so the skip link stays the first stop', async () => {
    renderAt('/page-a');
    await new Promise((resolve) => requestAnimationFrame(resolve));

    expect(document.activeElement).toBe(document.body);
  });

  it('does not move the focus when only the query changes (a week change on the same page)', async () => {
    renderAt('/page-a');
    const button = screen.getByRole('button', { name: 'nur Query' });

    await userEvent.setup().click(button);
    await new Promise((resolve) => requestAnimationFrame(resolve));

    expect(document.activeElement).toBe(button);
  });

  // Teil 7, Package 1: in phone landscape the document scrolls, and focused elements ended up under
  // the sticky header / fixed tab bar / sticky action bar (WCAG 2.4.11).
  const headCss = () => [...document.head.querySelectorAll('style')].map((el) => el.textContent).join(' ');

  it('reserves scroll padding for the fixed bars on a phone held sideways', async () => {
    mockViewportWidth(780, 360);
    renderAt('/fullbleed');
    await screen.findByText('fullbleed-view');

    expect(headCss()).toMatch(/html\{[^}]*scroll-padding-top:var\(--pep-header-height/);
    expect(headCss()).toMatch(/html\{[^}]*scroll-padding-bottom:/);
  });

  it('adds no scroll padding on an upright phone', async () => {
    mockViewportWidth(390, 844);
    renderAt('/fullbleed');
    await screen.findByText('fullbleed-view');

    expect(headCss()).not.toMatch(/scroll-padding-top:var\(--pep-header-height/);
  });

  it('publishes the header height on the html element, where html itself can read it', () => {
    renderAt('/schedule');

    expect(document.documentElement.style.getPropertyValue('--pep-header-height')).not.toBe('');
  });

  it('hat einen Skip-Link als erstes fokussierbares Element', () => {
    renderAt('/schedule');

    const link = screen.getByRole('link', { name: 'Zum Hauptinhalt springen' });
    expect(link).toHaveAttribute('href', '#main-content');

    const focusable = Array.from(document.querySelectorAll<HTMLElement>('a[href], button'));
    expect(focusable[0]).toBe(link);
  });

  // Teil 8, Package 2: the app routes on the hash, so following "#main-content" navigated to the
  // unknown path /main-content and the locale loader bounced the user to Wochenplanung.
  it('moves the focus to the main content without touching the URL hash', async () => {
    window.location.hash = '#/de/employees';
    renderAt('/schedule');
    const link = screen.getByRole('link', { name: 'Zum Hauptinhalt springen' });

    await userEvent.setup().click(link);

    expect(window.location.hash).toBe('#/de/employees');
    expect(document.activeElement).toBe(document.getElementById('main-content'));
  });

  it('makes the main content focusable by script only', () => {
    renderAt('/schedule');

    expect(document.getElementById('main-content')).toHaveAttribute('tabindex', '-1');
  });
});
