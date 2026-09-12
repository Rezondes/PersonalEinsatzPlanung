import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { AbsenceId, BranchId, EmployeeId } from '@domain/shared/ids';
import type { Branch } from '@domain/branch/Branch';
import type { Employee } from '@domain/employee/Employee';
import { services } from '@infrastructure/services';
import { useBranchesStore } from '@ui/app/store/branchesStore';
import { useBranchSelectionStore } from '@ui/app/store/branchSelectionStore';
import { AppNotifications } from '@ui/app/AppNotifications';
import { useNotificationStore } from '@ui/app/store/notificationStore';
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
    <MemoryRouter>
      <EmployeeMasterDataView />
      <AppNotifications />
    </MemoryRouter>,
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
    // @ts-expect-error -- undo the per-test stub, jsdom has no matchMedia of its own to restore
    delete window.matchMedia;
  });

  it('shows an alert instead of the table when no branch is selected', async () => {
    useBranchesStore.setState({ branches: [], loading: false, loaded: true });
    useBranchSelectionStore.setState({ selectedBranchId: null });

    renderView();

    // findBy (not getBy) so the pending useEmployeeList load - it still runs even with no branch,
    // resolving to [] - settles inside act() before the test ends.
    expect(await screen.findByText('Bitte zuerst oben eine Filiale auswählen oder anlegen.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
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

  it('shows a Resturlaub column reflecting taken vacation days for the current year, full entitlement when none were taken', async () => {
    mockViewportWidth(1700);
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

    // The view's aria-label ends up on the TextField's outer wrapper, not the native input (a
    // pre-existing MUI quirk, not something this test should paper over), and placeholder text
    // does not contribute to the accessible name either - so the input is found by placeholder.
    const search = screen.getByPlaceholderText('Name oder Tätigkeit');
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

  it('opens the edit dialog pre-filled for an existing employee and closes without saving on Abbrechen', async () => {
    mockViewportWidth(1700);
    const user = userEvent.setup();
    renderView();
    await screen.findByText('Bauer, Anna');

    await user.click(screen.getByRole('button', { name: 'Bauer, Anna bearbeiten' }));

    const dialog = screen.getByRole('dialog');
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
    mockViewportWidth(1700);
    const user = userEvent.setup();
    renderView();
    await screen.findByText('Bauer, Anna');

    await user.click(screen.getByRole('button', { name: 'Bauer, Anna deaktivieren' }));

    expect(screen.getByText('Mitarbeiter deaktivieren?')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Bauer, Anna wird als inaktiv markiert und nicht mehr in der Wochenplanung eingeplant. Bereits erfasste Wochenpläne und Abwesenheiten bleiben vollständig erhalten und werden dort weiterhin schreibgeschützt angezeigt; der Mitarbeiter kann jederzeit wieder aktiviert werden.',
      ),
    ).toBeInTheDocument();

    expect(screen.getAllByText('Aktiv')).toHaveLength(4);
    expect(screen.getAllByText('Inaktiv')).toHaveLength(1);

    forBranchMock.mockResolvedValueOnce(employees.map((e) => (e.id === anna.id ? { ...e, active: false } : e)));

    await user.click(screen.getByRole('button', { name: 'Deaktivieren' }));

    await waitFor(() => expect(changeActiveStatusMock).toHaveBeenCalledWith(anna, false));
    await waitFor(() => expect(screen.queryByText('Mitarbeiter deaktivieren?')).not.toBeInTheDocument());
    await waitFor(() => expect(screen.getAllByText('Inaktiv')).toHaveLength(2));
    expect(screen.getAllByText('Aktiv')).toHaveLength(3);
  });

  it('activates an inactive employee via the confirm dialog with its own pinned text', async () => {
    mockViewportWidth(1700);
    const user = userEvent.setup();
    renderView();
    await screen.findByText('Engel, David');

    await user.click(screen.getByRole('button', { name: 'Engel, David aktivieren' }));

    expect(screen.getByText('Mitarbeiter aktivieren?')).toBeInTheDocument();
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
    mockViewportWidth(1700);
    const user = userEvent.setup();
    renderView();
    await screen.findByText('Bauer, Anna');

    changeActiveStatusMock.mockRejectedValueOnce(new Error('Datenbank offline'));
    expect(forBranchMock).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'Bauer, Anna deaktivieren' }));
    await user.click(screen.getByRole('button', { name: 'Deaktivieren' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Status konnte nicht geändert werden: Datenbank offline');
    await waitFor(() => expect(screen.queryByText('Mitarbeiter deaktivieren?')).not.toBeInTheDocument());
    // The catch block skips reload() entirely on failure - the list must not silently refetch.
    expect(forBranchMock).toHaveBeenCalledTimes(1);
    expect(screen.getAllByText('Aktiv')).toHaveLength(4);
  });
});
