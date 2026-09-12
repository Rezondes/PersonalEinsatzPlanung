import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { useBranchesStore } from '@ui/app/store/branchesStore';
import { useBranchSelectionStore } from '@ui/app/store/branchSelectionStore';
import { AppShell } from './AppShell';

/** jsdom has no real layout engine, so `window.matchMedia` is mocked to answer as if the viewport
 * were `width` wide. Copied from useBreakpoint.test.tsx. Pinned to laptop width throughout this
 * file so NavRail/BottomTabBar/MobileFab (none of which this test needs) do not render at all. */
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

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={<AppShell />}>
          <Route path="schedule" element={<div>schedule-view</div>} />
          <Route path="absences" element={<div>absences-view</div>} />
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
});
