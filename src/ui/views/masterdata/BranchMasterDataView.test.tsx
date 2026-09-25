import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import type { BranchId } from '@domain/shared/ids';
import type { Branch } from '@domain/branch/Branch';
import { services } from '@infrastructure/services';
import { useBranchesStore } from '@ui/app/store/branchesStore';
import { useListFiltersStore } from '@ui/app/store/listFiltersStore';
import { AppNotifications } from '@ui/app/AppNotifications';
import { useNotificationStore } from '@ui/app/store/notificationStore';
import { theme } from '@ui/app/theme';
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

/** Same viewport-mocking helper as useBreakpoint.test.tsx, copied to force the tablet (table)
 * layout for tests that need the table instead of the mobile card list. */
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

/** Same helper as EmployeeMasterDataView.test.tsx - orders a set of known strings by where they
 * first appear in the rendered table, so a sort assertion can compare against a plain array. */
function order(container: HTMLElement, names: string[]): string[] {
  const text = container.textContent ?? '';
  return [...names].sort((a, b) => text.indexOf(a) - text.indexOf(b));
}

// ThemeProvider wraps the real app theme - the branch card's logo-avatar style reads the custom
// theme.palette.accentSurface key, absent on MUI's own default theme.
// The list filters live in a module-level store and would otherwise leak between tests.
beforeEach(() => useListFiltersStore.getState().reset());

// Teil 8, Package 20: the search reset on every visit (Mitarbeiter and Abwesenheiten keep theirs),
// and a missing city showed "-" where the other lists show "–".
describe('BranchMasterDataView, kept filters and placeholders', () => {
  beforeEach(() => {
    useListFiltersStore.getState().reset();
    allMock.mockResolvedValue([makeBranch()]);
    useBranchesStore.setState({ branches: [makeBranch()], loading: false, loaded: true });
  });

  it('keeps the search after leaving the page and coming back', async () => {
    const user = userEvent.setup();
    const { unmount } = renderView();
    await user.type(screen.getByRole('textbox', { name: 'Filiale suchen' }), 'Hann');
    unmount();

    renderView();

    expect(screen.getByRole('textbox', { name: 'Filiale suchen' })).toHaveValue('Hann');
  });

  it('shows a missing city as an en dash', () => {
    const noCity = makeBranch({ address: { street: '', houseNumber: '', postalCode: '', city: '' } });
    allMock.mockResolvedValue([noCity]);
    useBranchesStore.setState({ branches: [noCity], loading: false, loaded: true });
    renderView();

    expect(screen.getAllByText(/^–/).length).toBeGreaterThan(0);
    expect(screen.queryAllByText(/^- /)).toHaveLength(0);
  });
});

const renderView = () =>
  render(
    <ThemeProvider theme={theme}>
      <MemoryRouter>
        <BranchMasterDataView />
        <AppNotifications />
      </MemoryRouter>
    </ThemeProvider>,
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

  it('renders the seeded branches with their name, number, city and status chip', () => {
    mockViewportWidth(1100);
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
    expect(within(table).getByText('Filiale Süd')).toBeInTheDocument();
    expect(within(table).getByText('002')).toBeInTheDocument();
    expect(within(table).getByText('München')).toBeInTheDocument();
    expect(within(table).getByText('Aktiv')).toBeInTheDocument();
    expect(within(table).getByText('Inaktiv')).toBeInTheDocument();
  });

  it('shows no chevron on the mobile card, like the Mitarbeiter cards (Teil 5)', () => {
    mockViewportWidth(500);
    seedBranches([makeBranch({ id: 'branch-1' as BranchId, name: 'Filiale Nord', branchNumber: '001' })]);

    const { container } = renderView();

    expect(screen.getByText(/Filiale Nord/)).toBeInTheDocument();
    expect(container.querySelector('[data-testid="ChevronRightIcon"]')).toBeNull();
  });

  it('keeps 8px between the mobile card and its kebab (Teil 6)', () => {
    mockViewportWidth(500);
    seedBranches([makeBranch({ id: 'branch-1' as BranchId, name: 'Filiale Nord', branchNumber: '001' })]);

    renderView();

    expect(screen.getByRole('button', { name: 'Weitere Aktionen für Filiale Nord' }).parentElement).toHaveStyle({ gap: '8px' });
  });

  it('zeigt eine h1-Überschrift mit dem Seitentitel', () => {
    renderView();

    expect(screen.getByRole('heading', { level: 1, name: 'Filialen' })).toBeInTheDocument();
  });

  it('zeigt die inaktive Filiale Süd ohne Opacity-Verwaschung', () => {
    mockViewportWidth(1100);
    const active = makeBranch({ id: 'branch-1' as BranchId, name: 'Filiale Nord', branchNumber: '001' });
    const inactive = makeBranch({ id: 'branch-2' as BranchId, name: 'Filiale Süd', branchNumber: '002', active: false });
    seedBranches([active, inactive]);

    renderView();

    const row = screen.getByText('Filiale Süd').closest('tr')!;
    expect(row).not.toHaveStyle({ opacity: '0.55' });
    expect(row).toHaveStyle({ backgroundColor: theme.palette.inactiveSurface, color: theme.palette.text.secondary });
  });

  it('colors the mobile card logo avatar and its placeholder icon from the theme, not a hardcoded literal', () => {
    // Default (mobile-like) viewport, matching this file's own convention - renders the card list,
    // where the logo avatar/icon actually live (the desktop table above has no such element).
    seedBranches([makeBranch()]);

    renderView();

    const avatar = document.querySelector('.MuiAvatar-root');
    expect(avatar).toHaveStyle({ backgroundColor: theme.palette.accentSurface.subtle });
    expect(avatar?.querySelector('.MuiSvgIcon-root')).toHaveStyle({ color: theme.palette.primary.main });
  });

  it('hat ein leeres alt-Attribut auf dem Logo, da der Name schon als sichtbarer Text daneben steht', () => {
    seedBranches([makeBranch({ logoBase64: 'data:image/png;base64,abc' })]);

    renderView();

    expect(document.querySelector('img')?.getAttribute('alt')).toBe('');
  });

  it('search narrows the visible branches by name, number or city, and clearing restores them (N26)', async () => {
    mockViewportWidth(1100);
    const user = userEvent.setup();
    const nord = makeBranch({ id: 'branch-1' as BranchId, name: 'Filiale Nord', branchNumber: '001' });
    const sued = makeBranch({
      id: 'branch-2' as BranchId,
      name: 'Filiale Süd',
      branchNumber: '002',
      address: { street: 'Marktplatz', houseNumber: '3', postalCode: '80331', city: 'München' },
      federalState: 'Bayern',
    });
    seedBranches([nord, sued]);
    renderView();

    expect(screen.getByText('Filiale Nord')).toBeInTheDocument();
    expect(screen.getByText('Filiale Süd')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Filiale suchen'), 'München');
    expect(screen.queryByText('Filiale Nord')).not.toBeInTheDocument();
    expect(screen.getByText('Filiale Süd')).toBeInTheDocument();

    await user.clear(screen.getByLabelText('Filiale suchen'));
    expect(screen.getByText('Filiale Nord')).toBeInTheDocument();
    expect(screen.getByText('Filiale Süd')).toBeInTheDocument();
  });

  it('filters branches by status (Alle/Aktiv/Inaktiv)', async () => {
    mockViewportWidth(1100);
    const user = userEvent.setup();
    const active = makeBranch({ id: 'branch-1' as BranchId, name: 'Filiale Nord', active: true });
    const inactive = makeBranch({ id: 'branch-2' as BranchId, name: 'Filiale Süd', active: false });
    seedBranches([active, inactive]);
    renderView();

    expect(screen.getByRole('combobox', { name: 'Status' })).toBeInTheDocument();

    await user.click(screen.getByRole('combobox', { name: 'Status' }));
    await user.click(screen.getByRole('option', { name: 'Aktiv' }));
    expect(screen.getByText('Filiale Nord')).toBeInTheDocument();
    expect(screen.queryByText('Filiale Süd')).not.toBeInTheDocument();

    await user.click(screen.getByRole('combobox', { name: 'Status' }));
    await user.click(screen.getByRole('option', { name: 'Inaktiv' }));
    expect(screen.queryByText('Filiale Nord')).not.toBeInTheDocument();
    expect(screen.getByText('Filiale Süd')).toBeInTheDocument();
  });

  it('combines the status filter and search (AND), matching only the branch that satisfies both', async () => {
    mockViewportWidth(1100);
    const user = userEvent.setup();
    const nord = makeBranch({ id: 'branch-1' as BranchId, name: 'Filiale Nord', active: true });
    const west = makeBranch({ id: 'branch-2' as BranchId, name: 'Filiale West', active: true });
    const sued = makeBranch({ id: 'branch-3' as BranchId, name: 'Filiale Süd', active: false });
    seedBranches([nord, west, sued]);
    renderView();

    await user.click(screen.getByRole('combobox', { name: 'Status' }));
    await user.click(screen.getByRole('option', { name: 'Aktiv' }));
    await user.type(screen.getByLabelText('Filiale suchen'), 'Nord');

    expect(screen.getByText('Filiale Nord')).toBeInTheDocument();
    expect(screen.queryByText('Filiale West')).not.toBeInTheDocument();
    expect(screen.queryByText('Filiale Süd')).not.toBeInTheDocument();
  });

  it('hebt die fixierte Namens-Zelle beim Hover der Zeile mit hervor', async () => {
    mockViewportWidth(1100);
    const nord = makeBranch({ id: 'branch-1' as BranchId, name: 'Filiale Nord', branchNumber: '001' });
    seedBranches([nord]);
    renderView();

    const nameCell = (await screen.findByText('Filiale Nord')).closest('td')!;
    expect(nameCell).toHaveClass('pep-sticky-first-column');
    const row = nameCell.closest('tr')!;
    const rowClass = Array.from(row.classList).find((c) => c.startsWith('css-'));
    // jsdom has no real :hover engine - assert on the injected Emotion stylesheet text instead.
    const styles = Array.from(document.querySelectorAll('style')).map((s) => s.textContent).join('\n');
    expect(styles).toContain(`.${rowClass}:hover .pep-sticky-first-column`);
  });

  it('sorts by Filiale (name) ascending and descending when the column header is clicked (N26)', async () => {
    mockViewportWidth(1100);
    const user = userEvent.setup();
    const nord = makeBranch({ id: 'branch-1' as BranchId, name: 'Filiale Nord', branchNumber: '001' });
    const sued = makeBranch({ id: 'branch-2' as BranchId, name: 'Filiale Süd', branchNumber: '002' });
    seedBranches([sued, nord]);
    const { container } = renderView();
    await screen.findByText('Filiale Nord');

    const names = ['Filiale Nord', 'Filiale Süd'];
    expect(order(container, names)).toEqual(names);

    await user.click(screen.getByText('Filiale'));
    expect(order(container, names)).toEqual([...names].reverse());
  });

  it('shows the empty-state message in the default mobile-resolved card layout', () => {
    seedBranches([]);

    renderView();

    expect(screen.getByText('Noch keine Filiale angelegt.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('shows the table\'s own empty-row message at the tablet layout', () => {
    mockViewportWidth(1100);
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

  it('opens BranchDialog pre-filled for editing via the kebab menu', async () => {
    mockViewportWidth(1100);
    const user = userEvent.setup();
    const branch = makeBranch({ name: 'Filiale Nord' });
    seedBranches([branch]);
    renderView();

    await user.click(screen.getByRole('button', { name: 'Weitere Aktionen für Filiale Nord' }));
    await user.click(screen.getByRole('button', { name: 'Bearbeiten' }));

    expect(await screen.findByRole('heading', { name: 'Filiale bearbeiten' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('Filiale Nord');
  });

  it('confirms and deactivates an active branch, then reloads the list', async () => {
    mockViewportWidth(1100);
    const user = userEvent.setup();
    const branch = makeBranch({ name: 'Filiale Nord', active: true });
    seedBranches([branch]);
    changeActiveStatusMock.mockResolvedValue({ ...branch, active: false });
    allMock.mockResolvedValue([{ ...branch, active: false }]);
    renderView();

    await user.click(screen.getByRole('button', { name: 'Weitere Aktionen für Filiale Nord' }));
    await user.click(screen.getByRole('button', { name: /^Deaktivieren/ }));

    expect(await screen.findByRole('heading', { name: 'Filiale deaktivieren?' })).toBeInTheDocument();
    expect(
      screen.getByText(
        'Filiale Nord wird als inaktiv markiert und verschwindet aus der Filial-Auswahl. Mitarbeiter, Wochenpläne und Abwesenheiten bleiben vollständig erhalten und die Filiale kann jederzeit wieder aktiviert werden.',
      ),
    ).toBeInTheDocument();

    // Dangerous per getRowActions (branch.active), so the confirm button must actually be red,
    // not the app's green primary color (M15).
    expect(screen.getByRole('button', { name: 'Deaktivieren' })).toHaveClass('MuiButton-containedError');

    await user.click(screen.getByRole('button', { name: 'Deaktivieren' }));

    expect(changeActiveStatusMock).toHaveBeenCalledWith(branch, false);
    await waitFor(() => expect(allMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByText('Inaktiv')).toBeInTheDocument());
    expect(await screen.findByText('Filiale wurde deaktiviert.')).toBeInTheDocument();
  });

  it('shows a busy state while changing status: disables Abbrechen, spins the confirm button, blocks dismissal (M15)', async () => {
    mockViewportWidth(1100);
    const user = userEvent.setup();
    const branch = makeBranch({ name: 'Filiale Nord', active: true });
    seedBranches([branch]);
    let resolveStatus!: (value: Branch) => void;
    changeActiveStatusMock.mockReturnValueOnce(
      new Promise<Branch>((res) => {
        resolveStatus = res;
      }),
    );
    renderView();

    await user.click(screen.getByRole('button', { name: 'Weitere Aktionen für Filiale Nord' }));
    await user.click(screen.getByRole('button', { name: /^Deaktivieren/ }));
    await screen.findByRole('heading', { name: 'Filiale deaktivieren?' });
    await user.click(screen.getByRole('button', { name: 'Deaktivieren' }));

    expect(screen.getByRole('button', { name: 'Abbrechen' })).toBeDisabled();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.getByRole('heading', { name: 'Filiale deaktivieren?' })).toBeInTheDocument();

    allMock.mockResolvedValueOnce([{ ...branch, active: false }]);
    resolveStatus({ ...branch, active: false });
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Filiale deaktivieren?' })).not.toBeInTheDocument());
  });

  it('opens the activate confirmation with the pinned title and text for an inactive branch', async () => {
    mockViewportWidth(1100);
    const user = userEvent.setup();
    const branch = makeBranch({ name: 'Filiale Nord', active: false });
    seedBranches([branch]);
    renderView();

    await user.click(screen.getByRole('button', { name: 'Weitere Aktionen für Filiale Nord' }));
    await user.click(screen.getByRole('button', { name: 'Aktivieren' }));

    expect(await screen.findByRole('heading', { name: 'Filiale aktivieren?' })).toBeInTheDocument();
    expect(
      screen.getByText('Filiale Nord wird wieder als aktiv markiert und erscheint wieder in der Filial-Auswahl.'),
    ).toBeInTheDocument();
  });

  it('reports an error and keeps the branch active when changeActiveStatus rejects', async () => {
    mockViewportWidth(1100);
    const user = userEvent.setup();
    const branch = makeBranch({ name: 'Filiale Nord', active: true });
    seedBranches([branch]);
    changeActiveStatusMock.mockRejectedValue(new Error('Netzwerkfehler'));
    renderView();

    await user.click(screen.getByRole('button', { name: 'Weitere Aktionen für Filiale Nord' }));
    await user.click(screen.getByRole('button', { name: /^Deaktivieren/ }));
    await screen.findByRole('heading', { name: 'Filiale deaktivieren?' });
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

    // Regex, not the exact string: the mobile card (BranchCard) renders "{branchNumber} {name}" as
    // one text node, unlike the desktop table row, which renders the name and number separately.
    await user.click(screen.getByText(/Filiale Nord/));

    expect(screen.getByRole('heading', { name: 'Filiale bearbeiten' })).toBeInTheDocument();
    expect(screen.getByText('Weitere Aktionen')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Bearbeiten' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Deaktivieren' }));

    // The confirm dialog must not build its own focus trap while the edit dialog's is still
    // tearing down (N24) - it only appears once the edit dialog has actually closed.
    expect(screen.queryByRole('heading', { name: 'Filiale deaktivieren?' })).not.toBeInTheDocument();

    expect(screen.queryByRole('heading', { name: 'Filiale bearbeiten' })).not.toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Filiale deaktivieren?' })).toBeInTheDocument();
  });
});
