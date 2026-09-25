import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useListFiltersStore } from '@ui/app/store/listFiltersStore';
import { render, screen, waitFor, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import type { AbsenceId, BranchId, EmployeeId } from '@domain/shared/ids';
import type { Branch } from '@domain/branch/Branch';
import type { Employee } from '@domain/employee/Employee';
import { services } from '@infrastructure/services';
import { useBranchesStore } from '@ui/app/store/branchesStore';
import { useBranchSelectionStore } from '@ui/app/store/branchSelectionStore';
import { AppNotifications } from '@ui/app/AppNotifications';
import { useNotificationStore } from '@ui/app/store/notificationStore';
import { theme } from '@ui/app/theme';
import { EmployeeMasterDataView } from './EmployeeMasterDataView';

vi.mock('@infrastructure/services', () => ({
  services: {
    branch: { all: vi.fn() },
    employee: {
      forBranch: vi.fn(),
      changeActiveStatus: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    absence: { forEmployees: vi.fn() },
  },
}));

const branchAllMock = vi.mocked(services.branch.all);
const forBranchMock = vi.mocked(services.employee.forBranch);
const changeActiveStatusMock = vi.mocked(services.employee.changeActiveStatus);
const createMock = vi.mocked(services.employee.create);
const updateMock = vi.mocked(services.employee.update);
const forEmployeesMock = vi.mocked(services.absence.forEmployees);

/** Same helper as src/ui/hooks/useBreakpoint.test.tsx - jsdom has no layout engine, so
 * window.matchMedia is mocked to answer as if the viewport were `width` wide. */
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

const branch: Branch = {
  id: 'b1' as BranchId,
  name: 'Filiale Nord',
  branchNumber: '001',
  address: { street: 'Hauptstraße', houseNumber: '12', postalCode: '30159', city: 'Hannover' },
  logoBase64: null,
  federalState: 'Niedersachsen',
  allowedOpenSundays: [],
  active: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function makeEmployee(overrides: Partial<Employee> = {}): Employee {
  return {
    id: 'e1' as EmployeeId,
    branchId: branch.id,
    lastName: 'Bauer',
    firstName: 'Anna',
    jobTitle: 'Verkäuferin',
    employmentType: { type: 'PartTime', weeklyHours: 20 },
    vacationEntitlementPerYear: 28,
    holidayVacationHours: 5,
    active: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

const anna = makeEmployee({
  id: 'e1' as EmployeeId,
  lastName: 'Bauer',
  firstName: 'Anna',
  jobTitle: 'Verkäuferin',
  employmentType: { type: 'PartTime', weeklyHours: 20 },
  vacationEntitlementPerYear: 28,
});
const ben = makeEmployee({
  id: 'e2' as EmployeeId,
  lastName: 'Cengiz',
  firstName: 'Ben',
  jobTitle: 'Marktleiter',
  employmentType: { type: 'FullTime', weeklyHours: 40 },
  vacationEntitlementPerYear: 30,
});
const cara = makeEmployee({
  id: 'e3' as EmployeeId,
  lastName: 'Deniz',
  firstName: 'Cara',
  jobTitle: 'Aushilfe',
  employmentType: { type: 'Minijob', minHours: 5, maxHours: 10 },
  vacationEntitlementPerYear: 20,
});
const david = makeEmployee({
  id: 'e4' as EmployeeId,
  lastName: 'Engel',
  firstName: 'David',
  jobTitle: 'Lagerist',
  employmentType: { type: 'PartTime', weeklyHours: 20 },
  vacationEntitlementPerYear: 25,
  active: false,
});
const mika = makeEmployee({
  id: 'e5' as EmployeeId,
  lastName: 'Fischer',
  firstName: 'Mika',
  jobTitle: 'Auszubildende',
  employmentType: { type: 'FullTime', weeklyHours: 35 },
  vacationEntitlementPerYear: 26,
  birthDate: '2015-01-01',
});
const employees = [anna, ben, cara, david, mika];

function renderView() {
  return render(
    <ThemeProvider theme={theme}>
      <MemoryRouter>
        <EmployeeMasterDataView />
        <AppNotifications />
      </MemoryRouter>
    </ThemeProvider>,
  );
}

/** Uses the container's full text, not RTL's getByText, so a name is found regardless of a
 * trailing minor-icon title (Mika) sitting right next to it in the same element. */
function order(container: HTMLElement, names: string[]): string[] {
  const text = container.textContent ?? '';
  return [...names].sort((a, b) => text.indexOf(a) - text.indexOf(b));
}

async function chooseStatusFilter(user: ReturnType<typeof userEvent.setup>, option: string) {
  await user.click(screen.getByRole('combobox', { name: 'Status' }));
  await user.click(screen.getByRole('option', { name: option }));
}

async function chooseEmploymentFilter(user: ReturnType<typeof userEvent.setup>, option: string) {
  await user.click(screen.getByRole('combobox', { name: 'Beschäftigung' }));
  await user.click(screen.getByRole('option', { name: option }));
}

// The list filters live in a module-level store since Teil 6 and would otherwise leak between tests.
beforeEach(() => useListFiltersStore.getState().reset());

describe('EmployeeMasterDataView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useNotificationStore.getState().clear();
    mockViewportWidth(1100);
    useBranchesStore.setState({ branches: [branch], loading: false, loaded: true });
    useBranchSelectionStore.setState({ selectedBranchId: branch.id });
    branchAllMock.mockResolvedValue([branch]);
    forBranchMock.mockResolvedValue(employees);
    changeActiveStatusMock.mockResolvedValue(anna);
    createMock.mockResolvedValue(anna);
    updateMock.mockResolvedValue(anna);
    forEmployeesMock.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.useRealTimers();
    // @ts-expect-error -- undo the per-test stub, jsdom has no matchMedia of its own to restore
    delete window.matchMedia;
  });

  // Teil 8, Package 8: a failed load showed "Noch keine Mitarbeiter", as if everyone was gone.
  it('shows a load error with a retry instead of the empty message', async () => {
    const user = userEvent.setup();
    forBranchMock.mockRejectedValueOnce(new Error('boom'));
    renderView();

    expect(await screen.findByText('Daten konnten nicht geladen werden.')).toBeInTheDocument();
    expect(screen.queryByText(/Noch keine Mitarbeiter/)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Erneut versuchen' }));
    expect(await screen.findByText('Bauer, Anna')).toBeInTheDocument();
  });

  // Teil 8, Package 20: on a phone "Noch keine Mitarbeiter" flashed on every visit while loading.
  it('shows no empty text while the list is still loading on a phone', async () => {
    mockViewportWidth(390);
    forBranchMock.mockReturnValue(new Promise(() => {}));
    renderView();

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.queryByText(/Noch keine Mitarbeiter/)).not.toBeInTheDocument();
  });

  it('shows an alert instead of the table when no branch is selected', async () => {
    useBranchesStore.setState({ branches: [], loading: false, loaded: true });
    useBranchSelectionStore.setState({ selectedBranchId: null });

    renderView();

    // findBy (not getBy) so the pending useEmployeeList load - it still runs even with no branch,
    // resolving to [] - settles inside act() before the test ends.
    expect(await screen.findByText('Lege zuerst eine Filiale an.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Filiale anlegen' })).toHaveAttribute('href', '/de/branches');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('hebt die fixierte Namens-Zelle beim Hover der Zeile mit hervor', async () => {
    renderView();

    const nameCell = (await screen.findByText('Bauer, Anna')).closest('td')!;
    expect(nameCell).toHaveClass('pep-sticky-first-column');
    const row = nameCell.closest('tr')!;
    const rowClass = Array.from(row.classList).find((c) => c.startsWith('css-'));
    // jsdom has no real :hover engine - assert on the injected Emotion stylesheet text instead.
    const styles = Array.from(document.querySelectorAll('style')).map((s) => s.textContent).join('\n');
    expect(styles).toContain(`.${rowClass}:hover .pep-sticky-first-column`);
  });

  it('renders every employee with their fields and flags the minor employee', async () => {
    const { container } = renderView();

    await screen.findByText('Bauer, Anna');
    expect(screen.getByText('5 von 5 Mitarbeitern')).toBeInTheDocument();

    for (const text of [
      'Bauer, Anna',
      'Verkäuferin',
      'Teilzeit',
      'Cengiz, Ben',
      'Marktleiter',
      'Vollzeit',
      'Deniz, Cara',
      'Aushilfe',
      'Geringfügig beschäftigt',
      '5-10',
      'Engel, David',
      'Lagerist',
      'Fischer, Mika',
      'Auszubildende',
    ]) {
      expect(container.textContent).toContain(text);
    }

    // Vacation days per year, rendered via toLocaleString('de-DE').
    for (const days of ['20', '25', '26', '28', '30']) {
      expect(container.textContent).toContain(days);
    }

    expect(screen.getByTitle('Minderjährig — Jugendarbeitsschutz beachten')).toBeInTheDocument();
  });

  it('zeigt eine h1-Überschrift mit dem Seitentitel', async () => {
    renderView();

    expect(await screen.findByRole('heading', { level: 1, name: 'Mitarbeiter' })).toBeInTheDocument();
  });

  it('zeigt den inaktiven Mitarbeiter david ohne Opacity-Verwaschung', async () => {
    renderView();

    const nameCell = await screen.findByText('Engel, David');
    const row = nameCell.closest('tr')!;

    expect(row).not.toHaveStyle({ opacity: '0.55' });
    expect(row).toHaveStyle({ backgroundColor: theme.palette.inactiveSurface, color: theme.palette.text.secondary });
  });

  it('shows a Resturlaub column reflecting taken vacation days for the current year, full entitlement when none were taken', async () => {
    const year = new Date().getFullYear();
    // A 14-day range always contains exactly 2 Sundays regardless of which weekday it starts on,
    // and February in Niedersachsen carries no public holiday (Easter can never fall that early) -
    // so this is deterministically 12 work days taken, whatever year the test happens to run in.
    forEmployeesMock.mockResolvedValue([
      {
        id: 'abs1' as AbsenceId,
        employeeId: anna.id,
        type: 'Vacation',
        from: `${year}-02-02`,
        to: `${year}-02-15`,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ]);
    renderView();
    await screen.findByText('Bauer, Anna');

    expect(screen.getByRole('columnheader', { name: 'Resturlaub' })).toBeInTheDocument();

    // Anna: vacationEntitlementPerYear 28, 12 work days taken -> 16 remaining.
    const annaRow = screen.getByText('Bauer, Anna').closest('tr') as HTMLElement;
    expect(await within(annaRow).findByText('16')).toBeInTheDocument();

    // Ben has no absences in this test - his Resturlaub shows the full, unchanged entitlement (30),
    // same as his Urlaub/Jahr column, so "30" appears twice in his row.
    const benRow = screen.getByText('Cengiz, Ben').closest('tr') as HTMLElement;
    expect(within(benRow).getAllByText('30')).toHaveLength(2);
  });

  it('adds unused prior-year vacation to the Resturlaub total with a breakdown hint, while the March 31 deadline has not passed', async () => {
    vi.setSystemTime(new Date('2027-02-01T10:00:00'));
    forEmployeesMock.mockResolvedValue([
      // Same deterministic 14-day-February trick as the test above, one year earlier: 12 work days
      // taken in 2026, none in 2027 -> Anna carries over 28 - 12 = 16 days into 2027.
      { id: 'abs1' as AbsenceId, employeeId: anna.id, type: 'Vacation', from: '2026-02-02', to: '2026-02-15', createdAt: '2026-01-01T00:00:00.000Z' },
      // Ben used up his full 2026 entitlement (5 Mon-Sat weeks = 30 work days), so his carry-over
      // is genuinely 0 - the intended "no breakdown, unchanged column" control row (an employee
      // with NO 2026 absence at all would legitimately carry over their full unused entitlement
      // too, which would defeat the point of this control).
      { id: 'abs2' as AbsenceId, employeeId: ben.id, type: 'Vacation', from: '2026-01-05', to: '2026-02-07', createdAt: '2026-01-01T00:00:00.000Z' },
    ]);
    renderView();
    await screen.findByText('Bauer, Anna');

    const annaRow = screen.getByText('Bauer, Anna').closest('tr') as HTMLElement;
    // 28 (full 2027 entitlement, untouched) + 16 (carried over from 2026) = 44.
    expect(await within(annaRow).findByText('44')).toBeInTheDocument();
    expect(within(annaRow).getByText('44 Tage, davon 16 aus 2026, gültig bis 31.03.2027')).toBeInTheDocument();

    const benRow = screen.getByText('Cengiz, Ben').closest('tr') as HTMLElement;
    await waitFor(() => expect(within(benRow).getAllByText('30')).toHaveLength(2));
    expect(within(benRow).queryByText(/gültig bis/)).not.toBeInTheDocument();
  });

  it('drops the carry-over once the March 31 deadline of the following year has passed (regression: unchanged column)', async () => {
    vi.setSystemTime(new Date('2027-04-01T10:00:00'));
    forEmployeesMock.mockResolvedValue([
      { id: 'abs1' as AbsenceId, employeeId: anna.id, type: 'Vacation', from: '2026-02-02', to: '2026-02-15', createdAt: '2026-01-01T00:00:00.000Z' },
    ]);
    renderView();
    await screen.findByText('Bauer, Anna');

    const annaRow = screen.getByText('Bauer, Anna').closest('tr') as HTMLElement;
    // The deadline has passed, so Anna's Resturlaub is her plain, unchanged full 2027 entitlement
    // (28) with no breakdown line - same as Urlaub/Jahr, so "28" legitimately appears twice.
    await waitFor(() => expect(within(annaRow).getAllByText('28')).toHaveLength(2));
    expect(within(annaRow).queryByText(/gültig bis/)).not.toBeInTheDocument();
  });

  it('keeps search and Status across leaving the page and coming back (Teil 6)', async () => {
    const user = userEvent.setup();
    const { unmount } = renderView();
    await screen.findByText('Bauer, Anna');
    await user.type(screen.getByLabelText('Mitarbeiter suchen'), 'Bau');
    await chooseStatusFilter(user, 'Aktiv');

    unmount();
    renderView();
    await screen.findByText('Bauer, Anna');

    expect(screen.getByLabelText('Mitarbeiter suchen')).toHaveValue('Bau');
    expect(screen.getByRole('combobox', { name: 'Status' })).toHaveTextContent('Aktiv');
  });

  describe('mobile filters (Teil 5, Package 11)', () => {
    it('keeps the search visible but folds Status/Beschäftigung behind a "Filter" button on a phone', async () => {
      mockViewportWidth(500);
      const user = userEvent.setup();
      renderView();
      await screen.findByText('Bauer, Anna');

      expect(screen.getByLabelText('Mitarbeiter suchen')).toBeInTheDocument();
      expect(screen.queryByRole('combobox', { name: 'Status' })).not.toBeInTheDocument();
      expect(screen.getByText(/von \d+ Mitarbeitern/)).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Filter' }));

      expect(screen.getByRole('combobox', { name: 'Status' })).toBeInTheDocument();
      expect(screen.getByRole('combobox', { name: 'Beschäftigung' })).toBeInTheDocument();
    });

    it('counts the active filters on the button, so a folded filter is never invisible', async () => {
      mockViewportWidth(500);
      const user = userEvent.setup();
      renderView();
      await screen.findByText('Bauer, Anna');

      await user.click(screen.getByRole('button', { name: 'Filter' }));
      await chooseStatusFilter(user, 'Aktiv');

      expect(screen.getByRole('button', { name: 'Filter (1)' })).toBeInTheDocument();
    });

    it('keeps every filter in one visible row on desktop, without a "Filter" button', async () => {
      renderView();
      await screen.findByText('Bauer, Anna');

      expect(screen.getByRole('combobox', { name: 'Status' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Filter' })).not.toBeInTheDocument();
    });
  });

  it('shows no chevron on the mobile card: the card itself opens the dialog, the kebab holds the actions (Teil 5)', async () => {
    mockViewportWidth(500);
    const user = userEvent.setup();
    renderView();
    await screen.findByText('Bauer, Anna');

    const card = screen.getByText('Bauer, Anna').closest('button') as HTMLButtonElement;
    expect(card.parentElement!.querySelector('[data-testid="ChevronRightIcon"]')).toBeNull();

    await user.click(card);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('keeps 8px between the mobile card and its kebab (Teil 6)', async () => {
    mockViewportWidth(500);
    renderView();
    await screen.findByText('Bauer, Anna');

    expect(screen.getByRole('button', { name: 'Weitere Aktionen für Bauer, Anna' }).parentElement).toHaveStyle({ gap: '8px' });
  });

  it('shows the Resturlaub figure as a compact line on the mobile card too', async () => {
    mockViewportWidth(500);
    renderView();
    await screen.findByText('Bauer, Anna');

    const card = screen.getByText('Bauer, Anna').closest('button') as HTMLButtonElement;
    // Anna has no absences in this test, so her card shows the full entitlement (28).
    expect(within(card).getByText('28 Resturlaub')).toBeInTheDocument();
  });

  it('search narrows the visible employees by name or job title, and clearing restores them', async () => {
    const user = userEvent.setup();
    const { container } = renderView();
    await screen.findByText('Bauer, Anna');

    const search = screen.getByLabelText('Mitarbeiter suchen');
    await user.type(search, 'aushilfe');

    expect(screen.getByText('1 von 5 Mitarbeitern')).toBeInTheDocument();
    expect(container.textContent).toContain('Deniz, Cara');
    expect(container.textContent).not.toContain('Bauer, Anna');

    await user.clear(search);
    await user.type(search, 'ben');

    expect(screen.getByText('1 von 5 Mitarbeitern')).toBeInTheDocument();
    expect(container.textContent).toContain('Cengiz, Ben');
    expect(container.textContent).not.toContain('Fischer, Mika');

    await user.clear(search);

    expect(screen.getByText('5 von 5 Mitarbeitern')).toBeInTheDocument();
    for (const name of ['Bauer, Anna', 'Cengiz, Ben', 'Deniz, Cara', 'Engel, David', 'Fischer, Mika']) {
      expect(container.textContent).toContain(name);
    }
  });

  it('the status filter narrows the visible employees', async () => {
    const user = userEvent.setup();
    const { container } = renderView();
    await screen.findByText('Bauer, Anna');

    await chooseStatusFilter(user, 'Aktiv');
    expect(screen.getByText('4 von 5 Mitarbeitern')).toBeInTheDocument();
    expect(container.textContent).not.toContain('Engel, David');

    await chooseStatusFilter(user, 'Inaktiv');
    expect(screen.getByText('1 von 5 Mitarbeitern')).toBeInTheDocument();
    expect(container.textContent).toContain('Engel, David');
    expect(container.textContent).not.toContain('Bauer, Anna');

    await chooseStatusFilter(user, 'Alle');
    expect(screen.getByText('5 von 5 Mitarbeitern')).toBeInTheDocument();
  });

  it('the employment-type filter narrows the visible employees', async () => {
    const user = userEvent.setup();
    const { container } = renderView();
    await screen.findByText('Bauer, Anna');

    await chooseEmploymentFilter(user, 'Vollzeit');
    expect(screen.getByText('2 von 5 Mitarbeitern')).toBeInTheDocument();
    expect(container.textContent).toContain('Cengiz, Ben');
    expect(container.textContent).toContain('Fischer, Mika');
    expect(container.textContent).not.toContain('Bauer, Anna');
    expect(container.textContent).not.toContain('Deniz, Cara');
    expect(container.textContent).not.toContain('Engel, David');

    await chooseEmploymentFilter(user, 'Teilzeit');
    expect(screen.getByText('2 von 5 Mitarbeitern')).toBeInTheDocument();
    expect(container.textContent).toContain('Bauer, Anna');
    expect(container.textContent).toContain('Engel, David');
    expect(container.textContent).not.toContain('Cengiz, Ben');
    expect(container.textContent).not.toContain('Deniz, Cara');
    expect(container.textContent).not.toContain('Fischer, Mika');

    await chooseEmploymentFilter(user, 'Geringfügig beschäftigt');
    expect(screen.getByText('1 von 5 Mitarbeitern')).toBeInTheDocument();
    expect(container.textContent).toContain('Deniz, Cara');
    expect(container.textContent).not.toContain('Bauer, Anna');
    expect(container.textContent).not.toContain('Cengiz, Ben');
    expect(container.textContent).not.toContain('Engel, David');
    expect(container.textContent).not.toContain('Fischer, Mika');
  });

  it('shows a different empty message when a filter matches nothing than when there are no employees at all', async () => {
    const user = userEvent.setup();
    renderView();
    await screen.findByText('Bauer, Anna');

    await chooseStatusFilter(user, 'Inaktiv');
    await chooseEmploymentFilter(user, 'Vollzeit');

    expect(screen.getByText('0 von 5 Mitarbeitern')).toBeInTheDocument();
    expect(screen.getByText('Kein Mitarbeiter passt zu den Filtern.')).toBeInTheDocument();
    expect(screen.queryByText('Noch kein Mitarbeiter angelegt.')).not.toBeInTheDocument();
  });

  it('shows the "no employees at all" message when the branch has none, not the filter message', async () => {
    forBranchMock.mockResolvedValue([]);
    renderView();

    await screen.findByText('0 von 0 Mitarbeitern');

    expect(screen.getByText('Noch kein Mitarbeiter angelegt.')).toBeInTheDocument();
    expect(screen.queryByText('Kein Mitarbeiter passt zu den Filtern.')).not.toBeInTheDocument();
  });

  it('sorts by name ascending and descending when the column header is clicked', async () => {
    const user = userEvent.setup();
    const { container } = renderView();
    await screen.findByText('Bauer, Anna');

    const names = ['Bauer, Anna', 'Cengiz, Ben', 'Deniz, Cara', 'Engel, David', 'Fischer, Mika'];
    expect(order(container, names)).toEqual(names);

    await user.click(screen.getByText('Name'));
    expect(order(container, names)).toEqual([...names].reverse());

    await user.click(screen.getByText('Name'));
    expect(order(container, names)).toEqual(names);
  });

  it('sorts by vacation days (numeric) ascending and descending', async () => {
    const user = userEvent.setup();
    const { container } = renderView();
    await screen.findByText('Bauer, Anna');

    const ascendingByVacation = ['Deniz, Cara', 'Engel, David', 'Fischer, Mika', 'Bauer, Anna', 'Cengiz, Ben'];

    await user.click(screen.getByText('Urlaub/Jahr'));
    expect(order(container, ascendingByVacation)).toEqual(ascendingByVacation);

    await user.click(screen.getByText('Urlaub/Jahr'));
    expect(order(container, ascendingByVacation)).toEqual([...ascendingByVacation].reverse());
  });

  it('sorts by Resturlaub, distinctly from Urlaub/Jahr once taken vacation lowers one employee below it (N26)', async () => {
    const user = userEvent.setup();
    const year = new Date().getFullYear();
    // Same deterministic 12-work-day range as the Resturlaub-column test above: Anna's remaining
    // drops from 28 to 16, below Cara's untouched 20 - a genuinely different order than sorting by
    // the raw vacationEntitlementPerYear column would give.
    forEmployeesMock.mockResolvedValue([
      {
        id: 'abs1' as AbsenceId,
        employeeId: anna.id,
        type: 'Vacation',
        from: `${year}-02-02`,
        to: `${year}-02-15`,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ]);
    const { container } = renderView();
    await screen.findByText('Bauer, Anna');

    const ascendingByRemaining = ['Bauer, Anna', 'Deniz, Cara', 'Engel, David', 'Fischer, Mika', 'Cengiz, Ben'];

    await user.click(screen.getByText('Resturlaub'));
    expect(order(container, ascendingByRemaining)).toEqual(ascendingByRemaining);

    await user.click(screen.getByText('Resturlaub'));
    expect(order(container, ascendingByRemaining)).toEqual([...ascendingByRemaining].reverse());
  });

  it('creates a new employee through the dialog, passing the branch id and reloading the list on save', async () => {
    const user = userEvent.setup();
    const { container } = renderView();
    await screen.findByText('Bauer, Anna');
    expect(forBranchMock).toHaveBeenCalledTimes(1);

    const createdEmployee = makeEmployee({
      id: 'e6' as EmployeeId,
      lastName: 'Gruber',
      firstName: 'Nina',
      jobTitle: 'Kassiererin',
      employmentType: { type: 'PartTime', weeklyHours: 20 },
      vacationEntitlementPerYear: 28,
      holidayVacationHours: 5,
    });
    createMock.mockResolvedValueOnce(createdEmployee);
    forBranchMock.mockResolvedValueOnce([...employees, createdEmployee]);

    await user.click(screen.getByRole('button', { name: 'Neuer Mitarbeiter' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Neuer Mitarbeiter')).toBeInTheDocument();
    expect(within(dialog).getByRole('textbox', { name: 'Vorname' })).toHaveValue('');

    await user.type(within(dialog).getByRole('textbox', { name: 'Vorname' }), 'Nina');
    await user.type(within(dialog).getByRole('textbox', { name: 'Nachname' }), 'Gruber');
    await user.type(within(dialog).getByRole('combobox', { name: 'Tätigkeit' }), 'Kassiererin');
    await user.type(within(dialog).getByRole('textbox', { name: 'Wochenstunden' }), '20');
    await user.type(within(dialog).getByRole('textbox', { name: 'Std. je Feier-/Urlaubstag' }), '5');
    await user.click(within(dialog).getByRole('button', { name: 'Speichern' }));

    await waitFor(() => expect(createMock).toHaveBeenCalledTimes(1));
    expect(createMock).toHaveBeenCalledWith({
      branchId: branch.id,
      lastName: 'Gruber',
      firstName: 'Nina',
      jobTitle: 'Kassiererin',
      employmentType: { type: 'PartTime', weeklyHours: 20 },
      vacationEntitlementPerYear: 28,
      holidayVacationHours: 5,
      birthDate: undefined,
      entryDate: undefined,
      exitDate: undefined,
    });

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(forBranchMock).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(container.textContent).toContain('Gruber, Nina'));
  });

  it('defers a secondary action inside the edit dialog until the dialog has actually closed, so its own confirm dialog does not race the closing focus trap (N24)', async () => {
    mockViewportWidth(500);
    const user = userEvent.setup();
    renderView();
    await screen.findByText('Bauer, Anna');

    const card = screen.getByText('Bauer, Anna').closest('button') as HTMLButtonElement;
    act(() => card.focus());
    await user.keyboard('{Enter}');
    expect(screen.getByText('Mitarbeiter bearbeiten')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Deaktivieren' }));

    // The status-confirm dialog must not appear until the edit dialog has actually finished
    // closing - opening it in the same tick would build its own focus trap while the edit
    // dialog's is still tearing down (N24).
    expect(screen.queryByText('Mitarbeiter deaktivieren?')).not.toBeInTheDocument();

    expect(await screen.findByText('Mitarbeiter deaktivieren?')).toBeInTheDocument();
    expect(screen.queryByText('Mitarbeiter bearbeiten')).not.toBeInTheDocument();
  });

  it('opens the edit dialog pre-filled for an existing employee and closes without saving on Abbrechen', async () => {
    const user = userEvent.setup();
    renderView();
    await screen.findByText('Bauer, Anna');

    await user.click(screen.getByRole('button', { name: 'Weitere Aktionen für Bauer, Anna' }));
    await user.click(screen.getByRole('button', { name: 'Bearbeiten' }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Mitarbeiter bearbeiten')).toBeInTheDocument();
    expect(within(dialog).getByRole('textbox', { name: 'Vorname' })).toHaveValue('Anna');
    expect(within(dialog).getByRole('textbox', { name: 'Nachname' })).toHaveValue('Bauer');
    expect(within(dialog).getByRole('combobox', { name: 'Tätigkeit' })).toHaveValue('Verkäuferin');
    expect(within(dialog).getByRole('textbox', { name: 'Wochenstunden' })).toHaveValue('20');
    expect(within(dialog).getByRole('textbox', { name: 'Urlaubsanspruch/Jahr (Tage)' })).toHaveValue('28');

    await user.click(within(dialog).getByRole('button', { name: 'Abbrechen' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('deactivates an employee via the confirm dialog, pinned text, and reloads the list', async () => {
    const user = userEvent.setup();
    renderView();
    await screen.findByText('Bauer, Anna');

    await user.click(screen.getByRole('button', { name: 'Weitere Aktionen für Bauer, Anna' }));
    await user.click(screen.getByRole('button', { name: /^Deaktivieren/ }));

    expect(await screen.findByText('Mitarbeiter deaktivieren?')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Bauer, Anna wird als inaktiv markiert und nicht mehr in der Wochenplanung eingeplant. Bereits erfasste Wochenpläne und Abwesenheiten bleiben vollständig erhalten und werden dort weiterhin schreibgeschützt angezeigt; der Mitarbeiter kann jederzeit wieder aktiviert werden.',
      ),
    ).toBeInTheDocument();

    expect(screen.getAllByText('Aktiv')).toHaveLength(4);
    expect(screen.getAllByText('Inaktiv')).toHaveLength(1);
    // Dangerous per getRowActions (employee.active), so the confirm button must actually be red,
    // not the app's green primary color (M15).
    expect(screen.getByRole('button', { name: 'Deaktivieren' })).toHaveClass('MuiButton-containedError');

    forBranchMock.mockResolvedValueOnce(employees.map((e) => (e.id === anna.id ? { ...e, active: false } : e)));

    await user.click(screen.getByRole('button', { name: 'Deaktivieren' }));

    await waitFor(() => expect(changeActiveStatusMock).toHaveBeenCalledWith(anna, false));
    await waitFor(() => expect(screen.queryByText('Mitarbeiter deaktivieren?')).not.toBeInTheDocument());
    await waitFor(() => expect(screen.getAllByText('Inaktiv')).toHaveLength(2));
    expect(screen.getAllByText('Aktiv')).toHaveLength(3);
    expect(await screen.findByText('Mitarbeiter wurde deaktiviert.')).toBeInTheDocument();
  });

  it('shows a busy state while changing status: disables Abbrechen, spins the confirm button, blocks dismissal (M15)', async () => {
    const user = userEvent.setup();
    renderView();
    await screen.findByText('Bauer, Anna');

    let resolveStatus!: (value: Employee) => void;
    changeActiveStatusMock.mockReturnValueOnce(
      new Promise<Employee>((res) => {
        resolveStatus = res;
      }),
    );

    await user.click(screen.getByRole('button', { name: 'Weitere Aktionen für Bauer, Anna' }));
    await user.click(screen.getByRole('button', { name: /^Deaktivieren/ }));
    await screen.findByText('Mitarbeiter deaktivieren?');
    await user.click(screen.getByRole('button', { name: 'Deaktivieren' }));

    expect(screen.getByRole('button', { name: 'Abbrechen' })).toBeDisabled();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.getByText('Mitarbeiter deaktivieren?')).toBeInTheDocument();

    forBranchMock.mockResolvedValueOnce(employees.map((e) => (e.id === anna.id ? { ...e, active: false } : e)));
    resolveStatus({ ...anna, active: false });
    await waitFor(() => expect(screen.queryByText('Mitarbeiter deaktivieren?')).not.toBeInTheDocument());
  });

  it('activates an inactive employee via the confirm dialog with its own pinned text', async () => {
    const user = userEvent.setup();
    renderView();
    await screen.findByText('Engel, David');

    await user.click(screen.getByRole('button', { name: 'Weitere Aktionen für Engel, David' }));
    await user.click(screen.getByRole('button', { name: 'Aktivieren' }));

    expect(await screen.findByText('Mitarbeiter aktivieren?')).toBeInTheDocument();
    expect(
      screen.getByText('Engel, David wird wieder als aktiv markiert und kann wieder in der Wochenplanung eingeplant werden.'),
    ).toBeInTheDocument();

    expect(screen.getAllByText('Aktiv')).toHaveLength(4);
    expect(screen.getAllByText('Inaktiv')).toHaveLength(1);

    forBranchMock.mockResolvedValueOnce(employees.map((e) => (e.id === david.id ? { ...e, active: true } : e)));

    await user.click(screen.getByRole('button', { name: 'Aktivieren' }));

    await waitFor(() => expect(changeActiveStatusMock).toHaveBeenCalledWith(david, true));
    await waitFor(() => expect(screen.queryByText('Mitarbeiter aktivieren?')).not.toBeInTheDocument());
    await waitFor(() => expect(screen.getAllByText('Aktiv')).toHaveLength(5));
    expect(screen.queryByText('Inaktiv')).not.toBeInTheDocument();
    expect(forBranchMock).toHaveBeenCalledTimes(2);
  });

  it('opens the edit dialog when an employee card is focused and Enter is pressed (keyboard activation)', async () => {
    mockViewportWidth(500);
    const user = userEvent.setup();
    renderView();
    await screen.findByText('Bauer, Anna');

    const card = screen.getByText('Bauer, Anna').closest('button') as HTMLButtonElement;
    act(() => card.focus());
    await user.keyboard('{Enter}');

    expect(screen.getByText('Mitarbeiter bearbeiten')).toBeInTheDocument();
  });

  it("opens the action sheet via a click on the card's visible kebab icon, independent of long-press", async () => {
    mockViewportWidth(500);
    const user = userEvent.setup();
    renderView();
    await screen.findByText('Bauer, Anna');

    await user.click(screen.getByRole('button', { name: 'Weitere Aktionen für Bauer, Anna' }));

    expect(screen.getByRole('button', { name: 'Bearbeiten' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Deaktivieren/ })).toBeInTheDocument();
  });

  it("opens the action sheet when the card's kebab icon is focused and Enter is pressed, without also opening the edit dialog", async () => {
    mockViewportWidth(500);
    const user = userEvent.setup();
    renderView();
    await screen.findByText('Bauer, Anna');

    act(() => screen.getByRole('button', { name: 'Weitere Aktionen für Bauer, Anna' }).focus());
    await user.keyboard('{Enter}');

    expect(screen.getByRole('button', { name: 'Bearbeiten' })).toBeInTheDocument();
    expect(screen.queryByText('Mitarbeiter bearbeiten')).not.toBeInTheDocument();
  });

  it('reports an error and still closes the confirm dialog when the status change fails', async () => {
    const user = userEvent.setup();
    renderView();
    await screen.findByText('Bauer, Anna');

    changeActiveStatusMock.mockRejectedValueOnce(new Error('Datenbank offline'));
    expect(forBranchMock).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'Weitere Aktionen für Bauer, Anna' }));
    await user.click(screen.getByRole('button', { name: /^Deaktivieren/ }));
    await screen.findByText('Mitarbeiter deaktivieren?');
    await user.click(screen.getByRole('button', { name: 'Deaktivieren' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Status konnte nicht geändert werden: Datenbank offline');
    await waitFor(() => expect(screen.queryByText('Mitarbeiter deaktivieren?')).not.toBeInTheDocument());
    // The catch block skips reload() entirely on failure - the list must not silently refetch.
    expect(forBranchMock).toHaveBeenCalledTimes(1);
    expect(screen.getAllByText('Aktiv')).toHaveLength(4);
  });
});
