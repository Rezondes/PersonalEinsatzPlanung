import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { createBranch } from '@domain/branch/Branch';
import { useBranchesStore } from '@ui/app/store/branchesStore';
import { NoBranchSelectedAlert } from './NoBranchSelectedAlert';

function renderAlert() {
  render(
    <MemoryRouter>
      <NoBranchSelectedAlert />
    </MemoryRouter>,
  );
}

const branch = (active: boolean) => ({
  ...createBranch({ name: 'Innenstadt', branchNumber: '4711', federalState: 'Sachsen' }),
  active,
});

describe('NoBranchSelectedAlert', () => {
  beforeEach(() => {
    useBranchesStore.setState({ branches: [], loading: false, loaded: true });
  });

  it('asks to create a Filiale when there is no active one (first start: the header select is not rendered)', () => {
    useBranchesStore.setState({ branches: [branch(false)] });

    renderAlert();

    expect(screen.getByText('Lege zuerst eine Filiale an.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Filiale anlegen' })).toHaveAttribute('href', '/de/branches');
    expect(screen.queryByText(/oben/)).not.toBeInTheDocument();
  });

  it('points to the header select when active Filialen exist but none is selected (N19)', () => {
    useBranchesStore.setState({ branches: [branch(true)] });

    renderAlert();

    expect(screen.getByText('Bitte oben eine Filiale auswählen.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Zu den Filialen' })).toHaveAttribute('href', '/de/branches');
  });

  it('does not claim there is no Filiale while the list is still loading', () => {
    useBranchesStore.setState({ branches: [], loaded: false, loading: true });

    renderAlert();

    expect(screen.queryByText('Lege zuerst eine Filiale an.')).not.toBeInTheDocument();
  });
});
