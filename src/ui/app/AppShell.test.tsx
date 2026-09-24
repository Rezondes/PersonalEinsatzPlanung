import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
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

  it('hat einen Skip-Link als erstes fokussierbares Element', () => {
    renderAt('/schedule');

    const link = screen.getByRole('link', { name: 'Zum Hauptinhalt springen' });
    expect(link).toHaveAttribute('href', '#main-content');

    const focusable = Array.from(document.querySelectorAll<HTMLElement>('a[href], button'));
    expect(focusable[0]).toBe(link);
  });
});
