import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { BranchId, EmployeeId, AbsenceId } from '@domain/shared/ids';
import type { Branch } from '@domain/branch/Branch';
import type { Employee } from '@domain/employee/Employee';
import type { Absence } from '@domain/absence/Absence';
import { emptyAddress } from '@domain/branch/Address';
import { services } from '@infrastructure/services';
import { useBranchesStore } from '@ui/app/store/branchesStore';
import { useBranchSelectionStore } from '@ui/app/store/branchSelectionStore';
import { AppNotifications } from '@ui/app/AppNotifications';
import { useNotificationStore } from '@ui/app/store/notificationStore';
import { PageActionsProvider } from '@ui/app/PageActionsContext';
import { MobileFab } from '@ui/app/nav/MobileFab';
import { AbsencesView } from './AbsencesView';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

vi.mock('@infrastructure/services', () => ({
  services: {
    branch: { all: vi.fn() },
    employee: { forBranch: vi.fn() },
    absence: { forEmployees: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    holidayBulkCreation: { createHolidaysForYear: vi.fn() },
  },
}));

const employeeForBranchMock = vi.mocked(services.employee.forBranch);
const absenceForBranchMock = vi.mocked(services.absence.forEmployees);
const createMock = vi.mocked(services.absence.create);
const updateMock = vi.mocked(services.absence.update);
const deleteMock = vi.mocked(services.absence.delete);
const createHolidaysForYearMock = vi.mocked(services.holidayBulkCreation.createHolidaysForYear);

/** Copied from src/ui/hooks/useBreakpoint.test.tsx: jsdom has no real layout engine, so
 * window.matchMedia is mocked to answer as if the viewport were `width` wide. Forced to tablet
 * throughout this file since most of what's under test here (TableSortLabel headers) only exists
 * in the table layout, not the mobile card list. */
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

const b1 = 'b1' as BranchId;
const branch: Branch = {
  id: b1,
  name: 'Filiale Nord',
  branchNumber: '001',
  address: emptyAddress(),
  logoBase64: null,
  federalState: 'Niedersachsen',
  allowedOpenSundays: [],
  active: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function employee(id: EmployeeId, lastName: string, firstName: string, active = true): Employee {
  return {
    id,
    branchId: b1,
    lastName,
    firstName,
    jobTitle: 'Verkauf',
    employmentType: { type: 'FullTime', weeklyHours: 40 },
    vacationEntitlementPerYear: 30,
    holidayVacationHours: 8,
    active,
    createdAt: '',
    updatedAt: '',
  };
}

const e1 = employee('e1' as EmployeeId, 'Bauer', 'Anna', true);
const e2 = employee('e2' as EmployeeId, 'Meyer', 'Jan', true);
const e3 = employee('e3' as EmployeeId, 'Schulz', 'Otto', false);

function vacation(id: string, employeeId: EmployeeId, from: string, to: string, halfDay?: { atStart: boolean; atEnd: boolean }): Absence {
  return { id: id as AbsenceId, employeeId, type: 'Vacation', from, to, halfDay, createdAt: '' };
}
function illness(id: string, employeeId: EmployeeId, from: string, to: string): Absence {
  return { id: id as AbsenceId, employeeId, type: 'Illness', from, to, createdAt: '' };
}
function publicHoliday(id: string, employeeId: EmployeeId, from: string, to: string): Absence {
  return { id: id as AbsenceId, employeeId, type: 'PublicHoliday', from, to, createdAt: '' };
}
function other(id: string, employeeId: EmployeeId, from: string, to: string, label: string, hoursPerDay?: number): Absence {
  return { id: id as AbsenceId, employeeId, type: 'Other', from, to, label, hoursPerDay, createdAt: '' };
}

const a1 = vacation('a1', e1.id, '2026-06-01', '2026-06-05');
const a2 = illness('a2', e2.id, '2026-07-10', '2026-07-10');
const a3 = publicHoliday('a3', e2.id, '2026-07-20', '2026-07-20');
const a4 = other('a4', e1.id, '2026-08-01', '2026-08-01', 'Fortbildung', 4.5);
const a5 = vacation('a5', 'ghost' as EmployeeId, '2026-05-01', '2026-05-01');

const renderView = () =>
  render(
    <PageActionsProvider>
      <MemoryRouter>
        <AbsencesView />
        <AppNotifications />
      </MemoryRouter>
      <MobileFab />
    </PageActionsProvider>,
  );

const table = () => screen.getByRole('table');
const dataRows = () => within(table()).getAllByRole('row').slice(1);
const erfassenButton = () => screen.getByRole('button', { name: 'Abwesenheit erfassen' });
const feiertageButton = () => screen.getByRole('button', { name: 'Feiertage anlegen' });

describe('AbsencesView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useNotificationStore.getState().clear();
    useBranchSelectionStore.setState({ selectedBranchId: null });
    useBranchesStore.setState({ branches: [], loading: false, loaded: true });
    employeeForBranchMock.mockResolvedValue([]);
    absenceForBranchMock.mockResolvedValue([]);
    mockViewportWidth(1700);
  });

  afterEach(() => {
    // @ts-expect-error -- undo the per-test stub, jsdom has no matchMedia of its own to restore
    delete window.matchMedia;
  });

  it('shows the "no branch selected" alert and nothing else when no branch is selected', async () => {
    renderView();

    expect(await screen.findByText('Bitte zuerst oben eine Filiale auswählen oder anlegen.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Zu den Filialen' })).toHaveAttribute('href', '/de/branches');
    expect(screen.queryByRole('button', { name: 'Abwesenheit erfassen' })).not.toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  describe('with a branch selected', () => {
    beforeEach(() => {
      useBranchesStore.setState({ branches: [branch], loading: false, loaded: true });
      useBranchSelectionStore.setState({ selectedBranchId: b1 });
    });

    it('shows the empty-state message when there are no absences at all', async () => {
      employeeForBranchMock.mockResolvedValue([e1]);
      absenceForBranchMock.mockResolvedValue([]);
      renderView();

      // employeeIds starts empty (employees haven't loaded yet), so useAbsences resolves once
      // immediately via its own empty-array short-circuit before re-fetching for real once e1
      // loads - a legitimate loading->loaded->loading->loaded double-cycle, not a bug (see
      // useAbsences.ts). Waiting for the REAL call first, rather than a bare findByText, avoids
      // grabbing the transient first (pre-e1) appearance of this same message and then finding it
      // detached again a moment later when the second, real load starts.
      await waitFor(() => expect(absenceForBranchMock).toHaveBeenCalledWith([e1.id]));
      expect(await screen.findByText('Noch keine Abwesenheiten erfasst.')).toBeInTheDocument();
    });

    it('does not flash the empty-state message while absences are still loading', async () => {
      employeeForBranchMock.mockResolvedValue([e1]);
      const absencesLoad = deferred<Absence[]>();
      absenceForBranchMock.mockReturnValue(absencesLoad.promise);
      renderView();

      // employeeIds starts empty, so useAbsences resolves once immediately via its own
      // empty-array short-circuit before e1 has even loaded, then re-fetches for real (this time
      // hitting absenceForBranchMock, hence our deferred promise) once employeeIds becomes non-empty
      // - a legitimate loading->loaded->loading cycle (see useAbsences.ts), not something this test
      // is about. Waiting for the real, deferred fetch to actually have started is what puts us in
      // the window this test means to check, rather than racing that earlier, unrelated cycle.
      await waitFor(() => expect(absenceForBranchMock).toHaveBeenCalledWith([e1.id]));
      expect(screen.queryByText('Noch keine Abwesenheiten erfasst.')).not.toBeInTheDocument();

      await act(async () => {
        absencesLoad.resolve([]);
        await absencesLoad.promise;
      });

      expect(screen.getByText('Noch keine Abwesenheiten erfasst.')).toBeInTheDocument();
    });

    it('shows a disabled FAB (not none at all) and a tooltip on the laptop buttons when there are no active employees', async () => {
      const user = userEvent.setup();
      employeeForBranchMock.mockResolvedValue([e3]); // e3 is inactive
      absenceForBranchMock.mockResolvedValue([]);
      renderView();

      await screen.findByText('Noch keine Abwesenheiten erfasst.');

      expect(erfassenButton()).toBeDisabled();
      expect(feiertageButton()).toBeDisabled();

      const fab = screen.getByRole('button', { name: 'Erfassen' });
      expect(fab).toBeInTheDocument();
      expect(fab).toBeDisabled();

      // A disabled button has pointer-events:none, so it never receives a real hover - MUI's own
      // documented workaround (used in production here too, see AbsencesView.tsx) is a span
      // wrapper around it that the Tooltip actually listens on.
      await user.hover(erfassenButton().parentElement as HTMLElement);
      expect(await screen.findByRole('tooltip')).toHaveTextContent(/aktiven Mitarbeiter/i);
    });

    it('renders employee names, type labels and date ranges for a mix of absence types', async () => {
      employeeForBranchMock.mockResolvedValue([e1, e2]);
      absenceForBranchMock.mockResolvedValue([a1, a2, a3, a4, a5]);
      renderView();

      await screen.findByText('Fortbildung');
      const rows = dataRows();
      expect(rows).toHaveLength(5);

      const row1 = within(rows[0]);
      expect(row1.getByText('Bauer, Anna')).toBeInTheDocument();
      expect(row1.getByText('Fortbildung')).toBeInTheDocument();
      expect(row1.getAllByText('01.08.2026')).toHaveLength(2);

      const row2 = within(rows[1]);
      expect(row2.getByText('Meyer, Jan')).toBeInTheDocument();
      expect(row2.getByText('Feiertag')).toBeInTheDocument();
      expect(row2.getAllByText('20.07.2026')).toHaveLength(2);

      const row3 = within(rows[2]);
      expect(row3.getByText('Meyer, Jan')).toBeInTheDocument();
      expect(row3.getByText('Krankheit')).toBeInTheDocument();
      expect(row3.getAllByText('10.07.2026')).toHaveLength(2);

      const row4 = within(rows[3]);
      expect(row4.getByText('Bauer, Anna')).toBeInTheDocument();
      expect(row4.getByText('Urlaub')).toBeInTheDocument();
      expect(row4.getByText('01.06.2026')).toBeInTheDocument();
      expect(row4.getByText('05.06.2026')).toBeInTheDocument();

      const row5 = within(rows[4]);
      expect(row5.getAllByText('–')).toHaveLength(1);
      expect(row5.getAllByText('01.05.2026')).toHaveLength(2);
    });

    it('sorts by "Von" descending (newest first) by default', async () => {
      employeeForBranchMock.mockResolvedValue([e1, e2]);
      absenceForBranchMock.mockResolvedValue([a1, a2, a3, a4, a5]);
      renderView();

      await screen.findByText('Fortbildung');
      const texts = dataRows().map((r) => r.textContent);
      expect(texts[0]).toContain('01.08.2026');
      expect(texts[1]).toContain('20.07.2026');
      expect(texts[2]).toContain('10.07.2026');
      expect(texts[3]).toContain('01.06.2026');
      expect(texts[4]).toContain('01.05.2026');
    });

    it('toggles to ascending when clicking the already-default "Von" column header', async () => {
      const user = userEvent.setup();
      employeeForBranchMock.mockResolvedValue([e1, e2]);
      absenceForBranchMock.mockResolvedValue([a1, a2, a3, a4, a5]);
      renderView();

      await screen.findByText('Fortbildung');
      await user.click(within(table()).getByText('Von'));

      const texts = dataRows().map((r) => r.textContent);
      expect(texts[0]).toContain('01.05.2026');
      expect(texts[1]).toContain('01.06.2026');
      expect(texts[2]).toContain('10.07.2026');
      expect(texts[3]).toContain('20.07.2026');
      expect(texts[4]).toContain('01.08.2026');
    });

    it('sorts by "Art" ascending, grouping an Other entry under its plain kind, not its free-text label', async () => {
      const user = userEvent.setup();
      employeeForBranchMock.mockResolvedValue([e1, e2]);
      absenceForBranchMock.mockResolvedValue([a1, a2, a3, a4, a5]);
      renderView();

      await screen.findByText('Fortbildung');
      await user.click(within(table()).getByText('Art'));

      const texts = dataRows().map((r) => r.textContent);
      // Feiertag, Krankheit, Sonstige (a4/Fortbildung), then Urlaub (a5 then a1, tie-broken by from asc)
      expect(texts[0]).toContain('20.07.2026');
      expect(texts[1]).toContain('10.07.2026');
      expect(texts[2]).toContain('01.08.2026');
      expect(texts[3]).toContain('01.05.2026');
      expect(texts[4]).toContain('01.06.2026');
    });

    it('narrows rows by employee and type filter, and shows a distinct message when combined filters match nothing', async () => {
      const user = userEvent.setup();
      employeeForBranchMock.mockResolvedValue([e1, e2]);
      absenceForBranchMock.mockResolvedValue([a1, a2, a3, a4, a5]);
      renderView();

      await screen.findByText('Fortbildung');

      await user.click(screen.getByRole('combobox', { name: 'Mitarbeiter' }));
      await user.click(screen.getByRole('option', { name: 'Meyer, Jan' }));

      expect(dataRows()).toHaveLength(2);
      expect(screen.queryByText('Bauer, Anna')).not.toBeInTheDocument();
      expect(screen.queryByText('Fortbildung')).not.toBeInTheDocument();

      await user.click(screen.getByRole('combobox', { name: 'Art' }));
      await user.click(screen.getByRole('option', { name: 'Urlaub' }));

      expect(screen.getByText('Kein Eintrag passt zu den Filtern.')).toBeInTheDocument();
      expect(screen.queryByText('Noch keine Abwesenheiten erfasst.')).not.toBeInTheDocument();
    });

    it('narrows rows by the type filter alone, discriminating same-employee rows by type', async () => {
      const user = userEvent.setup();
      employeeForBranchMock.mockResolvedValue([e1, e2]);
      absenceForBranchMock.mockResolvedValue([a1, a2, a3, a4, a5]);
      renderView();

      await screen.findByText('Fortbildung');

      await user.click(screen.getByRole('combobox', { name: 'Art' }));
      await user.click(screen.getByRole('option', { name: 'Krankheit' }));

      expect(dataRows()).toHaveLength(1);
      expect(within(table()).getByText('Meyer, Jan')).toBeInTheDocument();
      expect(within(table()).getByText('Krankheit')).toBeInTheDocument();
      expect(within(table()).queryByText('Bauer, Anna')).not.toBeInTheDocument();
      expect(within(table()).queryByText('Feiertag')).not.toBeInTheDocument();
      expect(within(table()).queryByText('Urlaub')).not.toBeInTheDocument();
      expect(within(table()).queryByText('Fortbildung')).not.toBeInTheDocument();
    });

    it('offers both years for a range crossing New Year, and a single-year selection includes it (regression: behaves like the old single-select for one year)', async () => {
      const user = userEvent.setup();
      const yearOnly = vacation('y1', e1.id, '2026-03-01', '2026-03-02');
      const crossYear = vacation('y2', e1.id, '2026-12-30', '2027-01-02');
      employeeForBranchMock.mockResolvedValue([e1]);
      absenceForBranchMock.mockResolvedValue([yearOnly, crossYear]);
      renderView();

      await screen.findByText('01.03.2026');

      await user.click(screen.getByRole('combobox', { name: 'Jahr' }));
      expect(screen.getByRole('option', { name: '2026' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: '2027' })).toBeInTheDocument();
      await user.click(screen.getByRole('option', { name: '2027' }));
      await user.keyboard('{Escape}');

      expect(dataRows()).toHaveLength(1);
      expect(screen.queryByText('01.03.2026')).not.toBeInTheDocument();
      expect(screen.getByText('30.12.2026')).toBeInTheDocument();
      expect(screen.getByText('02.01.2027')).toBeInTheDocument();
    });

    it('shows absences from either year once a second year is added to the Jahr selection', async () => {
      const user = userEvent.setup();
      const y2025 = vacation('y2025', e1.id, '2025-06-01', '2025-06-02');
      const y2026 = vacation('y2026', e1.id, '2026-06-01', '2026-06-02');
      const y2027 = vacation('y2027', e1.id, '2027-06-01', '2027-06-02');
      employeeForBranchMock.mockResolvedValue([e1]);
      absenceForBranchMock.mockResolvedValue([y2025, y2026, y2027]);
      renderView();

      await screen.findByText('01.06.2025');

      await user.click(screen.getByRole('combobox', { name: 'Jahr' }));
      await user.click(screen.getByRole('option', { name: '2025' }));
      await user.keyboard('{Escape}');

      expect(dataRows()).toHaveLength(1);
      expect(screen.getByText('01.06.2025')).toBeInTheDocument();

      await user.click(screen.getByRole('combobox', { name: 'Jahr' }));
      await user.click(screen.getByRole('option', { name: '2026' }));
      await user.keyboard('{Escape}');

      expect(dataRows()).toHaveLength(2);
      expect(screen.getByText('01.06.2025')).toBeInTheDocument();
      expect(screen.getByText('01.06.2026')).toBeInTheDocument();
      expect(screen.queryByText('01.06.2027')).not.toBeInTheDocument();
    });

    it('shows every year when the Jahr filter has no selection, same as before it supported multiple years', async () => {
      employeeForBranchMock.mockResolvedValue([e1, e2]);
      absenceForBranchMock.mockResolvedValue([a1, a2, a3, a4, a5]);
      renderView();

      await screen.findByText('Fortbildung');

      expect(dataRows()).toHaveLength(5);
      expect(screen.getByRole('combobox', { name: 'Jahr' })).toHaveTextContent('Alle');
    });

    it('disables "Abwesenheit erfassen" when there are zero active employees, even with inactive ones present', async () => {
      employeeForBranchMock.mockResolvedValue([e3]);
      absenceForBranchMock.mockResolvedValue([]);
      renderView();

      await screen.findByText('Noch keine Abwesenheiten erfasst.');
      expect(erfassenButton()).toBeDisabled();
    });

    it('enables "Abwesenheit erfassen" when at least one active employee exists', async () => {
      employeeForBranchMock.mockResolvedValue([e1, e3]);
      absenceForBranchMock.mockResolvedValue([]);
      renderView();

      await screen.findByText('Noch keine Abwesenheiten erfasst.');
      expect(erfassenButton()).toBeEnabled();
    });

    it('disables "Feiertage anlegen" when there are zero active employees, even with inactive ones present', async () => {
      employeeForBranchMock.mockResolvedValue([e3]);
      absenceForBranchMock.mockResolvedValue([]);
      renderView();

      await screen.findByText('Noch keine Abwesenheiten erfasst.');
      expect(feiertageButton()).toBeDisabled();
    });

    it('opens CreateHolidaysDialog with the branch and only active employees, and wires reload + a success message with both counts', async () => {
      const user = userEvent.setup();
      employeeForBranchMock.mockResolvedValue([e1, e2, e3]);
      absenceForBranchMock.mockResolvedValueOnce([]).mockResolvedValueOnce([a1]);
      createHolidaysForYearMock.mockResolvedValueOnce({ created: 9, skipped: 3 });
      renderView();

      await screen.findByText('Noch keine Abwesenheiten erfasst.');
      await user.click(feiertageButton());

      const dialog = screen.getByRole('dialog');
      expect(within(dialog).getByText(new RegExp(branch.federalState))).toBeInTheDocument();
      await user.click(within(dialog).getByRole('button', { name: 'Anlegen' }));

      expect(createHolidaysForYearMock).toHaveBeenCalledWith(expect.any(Set), [e1, e2], []);
      await screen.findByText('9 Feiertage angelegt, 3 übersprungen (bereits erfasst/überschneidend).');
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      // reload() ran - a1, only returned by the second mocked fetch, is now shown.
      await screen.findByText('01.06.2026');
    });

    it('closing CreateHolidaysDialog via Abbrechen does not call the service or reload', async () => {
      const user = userEvent.setup();
      employeeForBranchMock.mockResolvedValue([e1]);
      absenceForBranchMock.mockResolvedValue([]);
      renderView();

      await screen.findByText('Noch keine Abwesenheiten erfasst.');
      await user.click(feiertageButton());
      await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Abbrechen' }));

      expect(createHolidaysForYearMock).not.toHaveBeenCalled();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      // Only the initial load, no reload from a cancelled dialog.
      expect(absenceForBranchMock).toHaveBeenCalledTimes(1);
    });

    it('opens AbsenceDialog with only active employees as its employee picker', async () => {
      const user = userEvent.setup();
      employeeForBranchMock.mockResolvedValue([e1, e2, e3]);
      absenceForBranchMock.mockResolvedValue([]);
      renderView();

      await screen.findByText('Noch keine Abwesenheiten erfasst.');
      await user.click(erfassenButton());

      const dialog = screen.getByRole('dialog');
      await user.click(within(dialog).getByRole('combobox', { name: 'Mitarbeiter' }));
      const options = screen.getAllByRole('option').map((o) => o.textContent);
      expect(options).toEqual(['Bauer, Anna', 'Meyer, Jan']);
    });

    it('wires onSaved to reload the absence list, showing the newly created row, and closes the dialog', async () => {
      const user = userEvent.setup();
      employeeForBranchMock.mockResolvedValue([e1]);
      absenceForBranchMock.mockResolvedValue([]);
      const created: Absence = { id: 'new' as AbsenceId, employeeId: e1.id, type: 'Vacation', from: '2026-01-01', to: '2026-01-01', createdAt: '' };
      createMock.mockResolvedValue(created);
      renderView();

      await screen.findByText('Noch keine Abwesenheiten erfasst.');
      absenceForBranchMock.mockResolvedValueOnce([created]);

      await user.click(erfassenButton());
      expect(screen.getByRole('dialog')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Speichern' }));

      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      // Generous timeout: this waits on the post-save reload round trip, which occasionally
      // outruns the 1000ms default under CI's slower/shared runners (saw it flake there).
      expect(await screen.findByText('Urlaub', {}, { timeout: 5000 })).toBeInTheDocument();
      expect(screen.queryByText('Noch keine Abwesenheiten erfasst.')).not.toBeInTheDocument();
    });

    it('wires onClose so cancelling the dialog does not save', async () => {
      const user = userEvent.setup();
      employeeForBranchMock.mockResolvedValue([e1]);
      absenceForBranchMock.mockResolvedValue([]);
      renderView();

      await screen.findByText('Noch keine Abwesenheiten erfasst.');
      await user.click(erfassenButton());
      await user.click(screen.getByRole('button', { name: 'Abbrechen' }));

      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(createMock).not.toHaveBeenCalled();
    });

    it('opens a delete confirm dialog with the pinned title and text, then deletes and reloads', async () => {
      const user = userEvent.setup();
      employeeForBranchMock.mockResolvedValue([e1]);
      absenceForBranchMock.mockResolvedValueOnce([a1]).mockResolvedValue([]);
      deleteMock.mockResolvedValue(undefined);
      renderView();

      await screen.findByText('Urlaub');
      await user.click(screen.getByRole('button', { name: 'Abwesenheit von Bauer, Anna löschen' }));

      const dialog = screen.getByRole('dialog');
      expect(within(dialog).getByText('Abwesenheit löschen?')).toBeInTheDocument();
      expect(within(dialog).getByText('Dieser Eintrag wird unwiderruflich entfernt.')).toBeInTheDocument();

      await user.click(within(dialog).getByRole('button', { name: 'Löschen' }));

      await waitFor(() => expect(deleteMock).toHaveBeenCalledWith(a1.id));
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      await waitFor(() => expect(screen.queryByText('Urlaub')).not.toBeInTheDocument());
      expect(screen.getByText('Noch keine Abwesenheiten erfasst.')).toBeInTheDocument();
      expect(await screen.findByText('Abwesenheit wurde gelöscht.')).toBeInTheDocument();
    });

    it('shows a busy state while deleting: disables Abbrechen, spins the confirm button, blocks dismissal (H8)', async () => {
      const user = userEvent.setup();
      employeeForBranchMock.mockResolvedValue([e1]);
      absenceForBranchMock.mockResolvedValueOnce([a1]).mockResolvedValue([]);
      let resolveDelete!: () => void;
      deleteMock.mockReturnValueOnce(
        new Promise<void>((res) => {
          resolveDelete = res;
        }),
      );
      renderView();

      await screen.findByText('Urlaub');
      await user.click(screen.getByRole('button', { name: 'Abwesenheit von Bauer, Anna löschen' }));
      const dialog = screen.getByRole('dialog');
      await user.click(within(dialog).getByRole('button', { name: 'Löschen' }));

      expect(within(dialog).getByRole('button', { name: 'Abbrechen' })).toBeDisabled();
      expect(within(dialog).getByRole('progressbar')).toBeInTheDocument();
      await user.keyboard('{Escape}');
      expect(screen.getByRole('dialog')).toBeInTheDocument();

      resolveDelete();
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    });

    it('does not delete when the confirm dialog is cancelled', async () => {
      const user = userEvent.setup();
      employeeForBranchMock.mockResolvedValue([e1]);
      absenceForBranchMock.mockResolvedValue([a1]);
      renderView();

      await screen.findByText('Urlaub');
      await user.click(screen.getByRole('button', { name: 'Abwesenheit von Bauer, Anna löschen' }));

      const dialog = screen.getByRole('dialog');
      await user.click(within(dialog).getByRole('button', { name: 'Abbrechen' }));

      expect(deleteMock).not.toHaveBeenCalled();
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    });

    it('reports a delete failure via notify.report with the pinned context', async () => {
      const user = userEvent.setup();
      employeeForBranchMock.mockResolvedValue([e1]);
      absenceForBranchMock.mockResolvedValue([a1]);
      deleteMock.mockRejectedValue(new Error('boom'));
      renderView();

      await screen.findByText('Urlaub');
      await user.click(screen.getByRole('button', { name: 'Abwesenheit von Bauer, Anna löschen' }));
      const dialog = screen.getByRole('dialog');
      await user.click(within(dialog).getByRole('button', { name: 'Löschen' }));

      expect(await screen.findByText('Abwesenheit konnte nicht gelöscht werden: boom')).toBeInTheDocument();
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    });

    it('marks an inactive employee in the Mitarbeiter filter with "(inaktiv)"', async () => {
      const user = userEvent.setup();
      employeeForBranchMock.mockResolvedValue([e1, e3]);
      absenceForBranchMock.mockResolvedValue([]);
      renderView();

      await user.click(screen.getByRole('combobox', { name: 'Mitarbeiter' }));

      expect(screen.getByRole('option', { name: 'Bauer, Anna' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Schulz, Otto (inaktiv)' })).toBeInTheDocument();
    });

    it('opens the edit dialog pre-filled when clicking the desktop Bearbeiten icon, titled "bearbeiten" and not "erfassen"', async () => {
      const user = userEvent.setup();
      employeeForBranchMock.mockResolvedValue([e1]);
      absenceForBranchMock.mockResolvedValue([a1]);
      renderView();

      await screen.findByText('Urlaub');
      await user.click(screen.getByRole('button', { name: 'Abwesenheit von Bauer, Anna bearbeiten' }));

      const dialog = screen.getByRole('dialog');
      expect(within(dialog).getByText('Abwesenheit bearbeiten')).toBeInTheDocument();
      expect(within(dialog).getByLabelText((t) => t.startsWith('Von'))).toHaveValue(a1.from);
      expect(within(dialog).getByLabelText((t) => t.startsWith('Bis'))).toHaveValue(a1.to);
    });

    it('saves an edit via services.absence.update, not create, and reloads the list', async () => {
      const user = userEvent.setup();
      employeeForBranchMock.mockResolvedValue([e1]);
      absenceForBranchMock.mockResolvedValueOnce([a1]).mockResolvedValue([a1]);
      updateMock.mockResolvedValue({ ...a1, to: '2026-06-06' });
      renderView();

      await screen.findByText('Urlaub');
      await user.click(screen.getByRole('button', { name: 'Abwesenheit von Bauer, Anna bearbeiten' }));
      const dialog = screen.getByRole('dialog');
      await user.click(within(dialog).getByRole('button', { name: 'Speichern' }));

      await waitFor(() => expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({ id: a1.id })));
      expect(createMock).not.toHaveBeenCalled();
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    });

    it('still lists an absence\'s owner in the Mitarbeiter dropdown when editing, even if they have since become inactive', async () => {
      const user = userEvent.setup();
      const theirAbsence = vacation('a9', e3.id, '2026-06-01', '2026-06-05');
      employeeForBranchMock.mockResolvedValue([e1, e3]);
      absenceForBranchMock.mockResolvedValue([theirAbsence]);
      renderView();

      await screen.findByText('Urlaub');
      await user.click(screen.getByRole('button', { name: 'Abwesenheit von Schulz, Otto bearbeiten' }));

      const dialog = screen.getByRole('dialog');
      expect(within(dialog).getByRole('combobox', { name: 'Mitarbeiter' })).toHaveTextContent('Schulz, Otto');
    });

    it('opens the edit dialog when tapping the mobile card itself, pre-filled for that absence', async () => {
      mockViewportWidth(500);
      const user = userEvent.setup();
      employeeForBranchMock.mockResolvedValue([e1]);
      absenceForBranchMock.mockResolvedValue([a1]);
      renderView();

      await screen.findByText('Bauer, Anna');
      await user.click(screen.getByText('Bauer, Anna').closest('button') as HTMLButtonElement);

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Abwesenheit bearbeiten')).toBeInTheDocument();
    });

    it('opens an action sheet with Bearbeiten and Löschen from the mobile card\'s kebab, replacing the old single delete button', async () => {
      mockViewportWidth(500);
      const user = userEvent.setup();
      employeeForBranchMock.mockResolvedValue([e1]);
      absenceForBranchMock.mockResolvedValue([a1]);
      renderView();

      await screen.findByText('Bauer, Anna');
      await user.click(screen.getByRole('button', { name: 'Weitere Aktionen für Abwesenheit von Bauer, Anna' }));

      expect(screen.getByRole('button', { name: 'Bearbeiten' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Löschen' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Abwesenheit von Bauer, Anna löschen' })).not.toBeInTheDocument();
    });

    it('deletes via the mobile action sheet\'s Löschen entry, through the same confirm dialog as the desktop button', async () => {
      const user = userEvent.setup();
      mockViewportWidth(500);
      employeeForBranchMock.mockResolvedValue([e1]);
      absenceForBranchMock.mockResolvedValueOnce([a1]).mockResolvedValue([]);
      deleteMock.mockResolvedValue(undefined);
      renderView();

      await screen.findByText('Bauer, Anna');
      await user.click(screen.getByRole('button', { name: 'Weitere Aktionen für Abwesenheit von Bauer, Anna' }));
      await user.click(screen.getByRole('button', { name: 'Löschen' }));

      // The confirm dialog must not build its own focus trap while the action sheet's is still
      // tearing down (N24) - it only appears once the sheet has actually finished closing.
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

      const confirmDialog = await screen.findByRole('dialog');
      expect(within(confirmDialog).getByText('Abwesenheit löschen?')).toBeInTheDocument();
      await user.click(within(confirmDialog).getByRole('button', { name: 'Löschen' }));

      await waitFor(() => expect(deleteMock).toHaveBeenCalledWith(a1.id));
    });
  });
});
