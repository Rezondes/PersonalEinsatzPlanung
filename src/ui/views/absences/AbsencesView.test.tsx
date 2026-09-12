import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
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
import { AbsencesView } from './AbsencesView';

vi.mock('@infrastructure/services', () => ({
  services: {
    branch: { all: vi.fn() },
    employee: { forBranch: vi.fn() },
    absence: { forEmployees: vi.fn(), create: vi.fn(), delete: vi.fn() },
  },
}));

const employeeForBranchMock = vi.mocked(services.employee.forBranch);
const absenceForBranchMock = vi.mocked(services.absence.forEmployees);
const createMock = vi.mocked(services.absence.create);
const deleteMock = vi.mocked(services.absence.delete);

/** Copied from src/ui/hooks/useBreakpoint.test.tsx: jsdom has no real layout engine, so
 * window.matchMedia is mocked to answer as if the viewport were `width` wide. Forced to laptop
 * throughout this file since most of what's under test here (the Std./Tag column, TableSortLabel
 * headers) only exists in the table layout, not the mobile card list. */
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
    <MemoryRouter>
      <AbsencesView />
      <AppNotifications />
    </MemoryRouter>,
  );

const table = () => screen.getByRole('table');
const dataRows = () => within(table()).getAllByRole('row').slice(1);
const erfassenButton = () => screen.getByRole('button', { name: 'Abwesenheit erfassen' });

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

      expect(await screen.findByText('Noch keine Abwesenheiten erfasst.')).toBeInTheDocument();
    });

    it('renders employee names, type labels, Std./Tag and date ranges for a mix of absence types', async () => {
      employeeForBranchMock.mockResolvedValue([e1, e2]);
      absenceForBranchMock.mockResolvedValue([a1, a2, a3, a4, a5]);
      renderView();

      await screen.findByText('Fortbildung');
      const rows = dataRows();
      expect(rows).toHaveLength(5);

      const row1 = within(rows[0]);
      expect(row1.getByText('Bauer, Anna')).toBeInTheDocument();
      expect(row1.getByText('Fortbildung')).toBeInTheDocument();
      expect(row1.getByText('4,5')).toBeInTheDocument();
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
      expect(row5.getAllByText('–')).toHaveLength(2);
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

    it('offers both years for a range crossing New Year, and filtering by either includes it', async () => {
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
      await user.click(screen.getByRole('option', { name: '2026' }));

      expect(dataRows()).toHaveLength(2);
      expect(screen.getByText('01.03.2026')).toBeInTheDocument();
      expect(screen.getByText('30.12.2026')).toBeInTheDocument();

      await user.click(screen.getByRole('combobox', { name: 'Jahr' }));
      await user.click(screen.getByRole('option', { name: '2027' }));

      expect(dataRows()).toHaveLength(1);
      expect(screen.queryByText('01.03.2026')).not.toBeInTheDocument();
      expect(screen.getByText('30.12.2026')).toBeInTheDocument();
      expect(screen.getByText('02.01.2027')).toBeInTheDocument();
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
      expect(await screen.findByText('Urlaub')).toBeInTheDocument();
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

    it('gives the mobile card\'s delete button a name-specific aria-label instead of the generic "Löschen"', async () => {
      mockViewportWidth(500);
      employeeForBranchMock.mockResolvedValue([e1]);
      absenceForBranchMock.mockResolvedValue([a1]);
      renderView();

      expect(await screen.findByRole('button', { name: 'Abwesenheit von Bauer, Anna löschen' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Löschen' })).not.toBeInTheDocument();
    });
  });
});
