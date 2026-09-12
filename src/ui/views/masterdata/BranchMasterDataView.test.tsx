import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { BranchId } from '@domain/shared/ids';
import type { Branch } from '@domain/branch/Branch';
import { services } from '@infrastructure/services';
import { useBranchesStore } from '@ui/app/store/branchesStore';
import { AppNotifications } from '@ui/app/AppNotifications';
import { useNotificationStore } from '@ui/app/store/notificationStore';
import { BranchMasterDataView } from './BranchMasterDataView';

vi.mock('@infrastructure/services', () => ({
  services: { branch: { all: vi.fn(), changeActiveStatus: vi.fn(), create: vi.fn(), update: vi.fn() } },
}));

const allMock = vi.mocked(services.branch.all);
const changeActiveStatusMock = vi.mocked(services.branch.changeActiveStatus);
const createMock = vi.mocked(services.branch.create);
const updateMock = vi.mocked(services.branch.update);

function makeBranch(overrides: Partial<Branch> = {}): Branch {
  return {
    id: 'branch-1' as BranchId,
    name: 'Filiale Nord',
    branchNumber: '001',
    address: { street: 'Hauptstraße', houseNumber: '12', postalCode: '30159', city: 'Hannover' },
    logoBase64: null,
    federalState: 'Niedersachsen',
    allowedOpenSundays: [],
    active: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

/** Same viewport-mocking helper as useBreakpoint.test.tsx, copied to force the laptop layout for
 * tests that need the inline edit/toggle IconButtons instead of the mobile/tablet action sheet. */
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

function seedBranches(branches: Branch[]) {
  useBranchesStore.setState({ branches, loading: false, loaded: true });
}

const renderView = () =>
  render(
    <MemoryRouter>
      <BranchMasterDataView />
      <AppNotifications />
    </MemoryRouter>,
  );

describe('BranchMasterDataView', () => {
  beforeEach(() => {
    allMock.mockReset();
    changeActiveStatusMock.mockReset();
    createMock.mockReset();
    updateMock.mockReset();
    allMock.mockResolvedValue([]);
    useBranchesStore.setState({ branches: [], loading: true, loaded: false });
    useNotificationStore.getState().clear();
  });

  afterEach(() => {
    // @ts-expect-error -- undo the per-test stub, jsdom has no matchMedia of its own to restore
    delete window.matchMedia;
  });

  it('renders the seeded branches with their name, number, city, federal state and status chip', () => {
    mockViewportWidth(1700);
    const active = makeBranch({ id: 'branch-1' as BranchId, name: 'Filiale Nord', branchNumber: '001' });
    const inactive = makeBranch({
      id: 'branch-2' as BranchId,
      name: 'Filiale Süd',
      branchNumber: '002',
      address: { street: 'Marktplatz', houseNumber: '3', postalCode: '80331', city: 'München' },
      federalState: 'Bayern',
      active: false,
    });
    seedBranches([active, inactive]);

    renderView();

    const table = screen.getByRole('table');
    expect(within(table).getByText('Filiale Nord')).toBeInTheDocument();
    expect(within(table).getByText('001')).toBeInTheDocument();
    expect(within(table).getByText('Hannover')).toBeInTheDocument();
    expect(within(table).getByText('Niedersachsen')).toBeInTheDocument();
    expect(within(table).getByText('Filiale Süd')).toBeInTheDocument();
    expect(within(table).getByText('002')).toBeInTheDocument();
    expect(within(table).getByText('München')).toBeInTheDocument();
    expect(within(table).getByText('Bayern')).toBeInTheDocument();
    expect(within(table).getByText('Aktiv')).toBeInTheDocument();
    expect(within(table).getByText('Inaktiv')).toBeInTheDocument();
  });

  it('shows the empty-state message in the default mobile-resolved card layout', () => {
    seedBranches([]);

    renderView();

    expect(screen.getByText('Noch keine Filiale angelegt.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('shows the table\'s own empty-row message at the laptop layout', () => {
    mockViewportWidth(1700);
    seedBranches([]);

    renderView();

    const table = screen.getByRole('table');
    expect(within(table).getByText('Noch keine Filiale angelegt.')).toBeInTheDocument();
  });

  it('opens BranchDialog on "Neue Filiale"', async () => {
    const user = userEvent.setup();
    seedBranches([makeBranch()]);
    renderView();

    await user.click(screen.getByRole('button', { name: 'Neue Filiale' }));

    expect(screen.getByRole('heading', { name: 'Neue Filiale' })).toBeInTheDocument();
  });

  it('opens BranchDialog pre-filled for editing via the laptop-layout edit button', async () => {
    mockViewportWidth(1700);
    const user = userEvent.setup();
    const branch = makeBranch({ name: 'Filiale Nord' });
    seedBranches([branch]);
    renderView();

    await user.click(screen.getByRole('button', { name: 'Filiale Nord bearbeiten' }));

    expect(screen.getByRole('heading', { name: 'Filiale bearbeiten' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('Filiale Nord');
  });

  it('confirms and deactivates an active branch, then reloads the list', async () => {
    mockViewportWidth(1700);
    const user = userEvent.setup();
    const branch = makeBranch({ name: 'Filiale Nord', active: true });
    seedBranches([branch]);
    changeActiveStatusMock.mockResolvedValue({ ...branch, active: false });
    allMock.mockResolvedValue([{ ...branch, active: false }]);
    renderView();

    await user.click(screen.getByRole('button', { name: 'Filiale Nord deaktivieren' }));

    expect(screen.getByRole('heading', { name: 'Filiale deaktivieren?' })).toBeInTheDocument();
    expect(
      screen.getByText(
        'Filiale Nord wird als inaktiv markiert und verschwindet aus der Filial-Auswahl. Mitarbeiter, Wochenpläne und Abwesenheiten bleiben vollständig erhalten und die Filiale kann jederzeit wieder aktiviert werden.',
      ),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Deaktivieren' }));

    expect(changeActiveStatusMock).toHaveBeenCalledWith(branch, false);
    await waitFor(() => expect(allMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByText('Inaktiv')).toBeInTheDocument());
  });

  it('opens the activate confirmation with the pinned title and text for an inactive branch', async () => {
    mockViewportWidth(1700);
    const user = userEvent.setup();
    const branch = makeBranch({ name: 'Filiale Nord', active: false });
    seedBranches([branch]);
    renderView();

    await user.click(screen.getByRole('button', { name: 'Filiale Nord aktivieren' }));

    expect(screen.getByRole('heading', { name: 'Filiale aktivieren?' })).toBeInTheDocument();
    expect(
      screen.getByText('Filiale Nord wird wieder als aktiv markiert und erscheint wieder in der Filial-Auswahl.'),
    ).toBeInTheDocument();
  });

  it('reports an error and keeps the branch active when changeActiveStatus rejects', async () => {
    mockViewportWidth(1700);
    const user = userEvent.setup();
    const branch = makeBranch({ name: 'Filiale Nord', active: true });
    seedBranches([branch]);
    changeActiveStatusMock.mockRejectedValue(new Error('Netzwerkfehler'));
    renderView();

    await user.click(screen.getByRole('button', { name: 'Filiale Nord deaktivieren' }));
    await user.click(screen.getByRole('button', { name: 'Deaktivieren' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Status konnte nicht geändert werden: Netzwerkfehler',
    );
    expect(allMock).not.toHaveBeenCalled();
    expect(screen.getByText('Aktiv')).toBeInTheDocument();
  });

  it('saves a new branch through the dialog, closing it and reloading the list', async () => {
    const user = userEvent.setup();
    seedBranches([]);
    const created = makeBranch({ id: 'branch-9' as BranchId, name: 'Filiale Ost', branchNumber: '009' });
    createMock.mockResolvedValue(created);
    allMock.mockResolvedValue([created]);
    renderView();

    await user.click(screen.getByRole('button', { name: 'Neue Filiale' }));
    await user.type(screen.getByRole('textbox', { name: 'Name' }), 'Filiale Ost');
    await user.type(screen.getByRole('textbox', { name: 'Filialnummer' }), '009');
    await user.click(screen.getByRole('button', { name: 'Speichern' }));

    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Neue Filiale' })).not.toBeInTheDocument());
    expect(createMock).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(allMock).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('009 Filiale Ost')).toBeInTheDocument();
  });

  it('closes the dialog without saving or reloading when Abbrechen is clicked', async () => {
    const user = userEvent.setup();
    seedBranches([]);
    renderView();

    await user.click(screen.getByRole('button', { name: 'Neue Filiale' }));
    await user.click(screen.getByRole('button', { name: 'Abbrechen' }));

    expect(screen.queryByRole('heading', { name: 'Neue Filiale' })).not.toBeInTheDocument();
    expect(createMock).not.toHaveBeenCalled();
    expect(allMock).not.toHaveBeenCalled();
  });

  it('opens the edit dialog when a branch card is focused and Enter is pressed (keyboard activation)', async () => {
    const user = userEvent.setup();
    const branch = makeBranch({ name: 'Filiale Nord' });
    seedBranches([branch]);
    renderView();

    const card = screen.getByText('001 Filiale Nord').closest('button') as HTMLButtonElement;
    act(() => card.focus());
    await user.keyboard('{Enter}');

    expect(screen.getByRole('heading', { name: 'Filiale bearbeiten' })).toBeInTheDocument();
  });

  it("opens the action sheet via a click on the card's visible kebab icon, independent of long-press", async () => {
    const user = userEvent.setup();
    const branch = makeBranch({ name: 'Filiale Nord' });
    seedBranches([branch]);
    renderView();

    await user.click(screen.getByRole('button', { name: 'Weitere Aktionen für Filiale Nord' }));

    expect(screen.getByRole('button', { name: 'Bearbeiten' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Deaktivieren/ })).toBeInTheDocument();
  });

  it("opens the action sheet when the card's kebab icon is focused and Enter is pressed, without also opening the edit dialog", async () => {
    const user = userEvent.setup();
    const branch = makeBranch({ name: 'Filiale Nord' });
    seedBranches([branch]);
    renderView();

    act(() => screen.getByRole('button', { name: 'Weitere Aktionen für Filiale Nord' }).focus());
    await user.keyboard('{Enter}');

    expect(screen.getByRole('button', { name: 'Bearbeiten' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Filiale bearbeiten' })).not.toBeInTheDocument();
  });

  it("offers only the status toggle, not edit, among the edit dialog's own secondary actions, and routes it into the confirm dialog", async () => {
    mockViewportWidth(800);
    const user = userEvent.setup();
    const branch = makeBranch({ name: 'Filiale Nord', active: true });
    seedBranches([branch]);
    renderView();

    await user.click(screen.getByText('Filiale Nord'));

    expect(screen.getByRole('heading', { name: 'Filiale bearbeiten' })).toBeInTheDocument();
    expect(screen.getByText('Weitere Aktionen')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Bearbeiten' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Deaktivieren' }));

    expect(screen.queryByRole('heading', { name: 'Filiale bearbeiten' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Filiale deaktivieren?' })).toBeInTheDocument();
  });
});
