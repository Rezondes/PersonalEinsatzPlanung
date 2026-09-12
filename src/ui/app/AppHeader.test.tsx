import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { BranchId } from '@domain/shared/ids';
import type { Branch } from '@domain/branch/Branch';
import { useBranchesStore } from '@ui/app/store/branchesStore';
import { useBranchSelectionStore } from '@ui/app/store/branchSelectionStore';
import { AppHeader } from './AppHeader';

/** jsdom has no real layout engine, so `window.matchMedia` is mocked to answer as if the viewport
 * were `width` wide. Copied from useBreakpoint.test.tsx. */
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

function makeBranch(overrides: Partial<Branch> = {}): Branch {
  return {
    id: 'b1' as BranchId,
    name: 'Filiale Nord',
    branchNumber: '001',
    address: { street: '', houseNumber: '', postalCode: '', city: '' },
    logoBase64: null,
    federalState: 'Niedersachsen',
    allowedOpenSundays: [],
    active: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('AppHeader', () => {
  beforeEach(() => {
    mockViewportWidth(1700);
  });

  afterEach(() => {
    // @ts-expect-error -- undo the per-test stub, jsdom has no matchMedia of its own to restore
    delete window.matchMedia;
  });

  it('labels the Filiale switcher for screen readers', () => {
    const branch = makeBranch();
    useBranchesStore.setState({ branches: [branch], loading: false, loaded: true });
    useBranchSelectionStore.setState({ selectedBranchId: branch.id });

    render(<AppHeader />);

    expect(screen.getByRole('combobox', { name: 'Filiale auswählen' })).toBeInTheDocument();
  });
});
