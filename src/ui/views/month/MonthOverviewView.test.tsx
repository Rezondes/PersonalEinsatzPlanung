import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import type { BranchId, EmployeeId } from '@domain/shared/ids';
import type { Branch } from '@domain/branch/Branch';
import type { Employee } from '@domain/employee/Employee';
import { fullName } from '@domain/employee/Employee';
import { targetWeeklyHoursRange } from '@domain/employee/EmploymentType';
import { formatHoursRangeGerman } from '@domain/schedule/scheduleCalculation';
import type { CalendarWeek, Weekday } from '@domain/shared/CalendarWeek';
import { calendarWeeksInMonth } from '@domain/shared/CalendarWeek';
import type { WeeklySchedule } from '@domain/schedule/WeeklySchedule';
import { createWeeklySchedule, withDayEntry } from '@domain/schedule/WeeklySchedule';
import { createShift } from '@domain/schedule/Shift';
import { clockTime } from '@domain/shared/ClockTime';
import { services } from '@infrastructure/services';
import { downloadTextFile } from '@infrastructure/export/fileAccess';
import { useBranchesStore } from '@ui/app/store/branchesStore';
import { useBranchSelectionStore } from '@ui/app/store/branchSelectionStore';
import { useCalendarWeekStore } from '@ui/app/store/calendarWeekStore';
import { AppNotifications } from '@ui/app/AppNotifications';
import { useNotificationStore } from '@ui/app/store/notificationStore';
import { theme } from '@ui/app/theme';
import { MonthOverviewView } from './MonthOverviewView';

vi.mock('@infrastructure/services', () => ({
  services: {
    branch: { all: vi.fn() },
    employee: { forBranch: vi.fn() },
    absence: { forEmployees: vi.fn() },
    schedule: { forBranch: vi.fn() },
  },
}));

vi.mock('@infrastructure/export/fileAccess', () => ({
  downloadTextFile: vi.fn(),
}));

const employeeForBranch = vi.mocked(services.employee.forBranch);
const absenceForBranch = vi.mocked(services.absence.forEmployees);
const scheduleForBranch = vi.mocked(services.schedule.forBranch);
const downloadTextFileMock = vi.mocked(downloadTextFile);

const MONTH_NAMES = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
];

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
    lastName: 'Meier',
    firstName: 'Anna',
    jobTitle: 'Verkäuferin',
    employmentType: { type: 'FullTime', weeklyHours: 37.5 },
    vacationEntitlementPerYear: 28,
    holidayVacationHours: 6.25,
    active: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function sollWocheText(employee: Employee): string {
  const range = targetWeeklyHoursRange(employee.employmentType);
  return formatHoursRangeGerman(range.min * 60, range.max * 60);
}

/** One shift per given weekday, each `hoursPerDay` long starting at 06:00, no break - matching
 * scheduleAssessment.test.ts's assumption that an unbroken shift's net minutes equal its full
 * scheduled duration. */
function scheduleWithWeekdayShifts(
  employeeId: EmployeeId,
  week: CalendarWeek,
  weekdays: Weekday[],
  hoursPerDay: number,
) {
  const endHour = String(6 + hoursPerDay).padStart(2, '0');
  return weekdays.reduce(
    (schedule, day) =>
      withDayEntry(schedule, employeeId, day, {
        type: 'Shift',
        shifts: [createShift(clockTime('06:00'), clockTime(`${endHour}:00`))],
      }),
    createWeeklySchedule(branch.id, week, [employeeId]),
  );
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function selectBranch() {
  useBranchesStore.setState({ branches: [branch], loading: false, loaded: true });
  useBranchSelectionStore.setState({ selectedBranchId: branch.id });
}

function LocationProbe() {
  return <div data-testid="location-search">{useLocation().search}</div>;
}

const renderView = (entry = '/month') =>
  render(
    <ThemeProvider theme={theme}>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route
            path="/month"
            element={
              <>
                <MonthOverviewView />
                <AppNotifications />
                <LocationProbe />
              </>
            }
          />
          <Route path="/de/schedule" element={<div>schedule-route-landed</div>} />
        </Routes>
      </MemoryRouter>
    </ThemeProvider>,
  );

const now = new Date();
const currentYear = now.getFullYear();
const currentMonth = now.getMonth() + 1;
const currentMonthLabel = `${MONTH_NAMES[currentMonth - 1]} ${currentYear}`;

/** Monat/Jahr live in a dialog behind the month label since Teil 5 (one month navigation, not two). */
async function openMonthPicker(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: `${currentMonthLabel}, anderen Monat auswählen` }));
}

/** Copied from useBreakpoint.test.tsx: jsdom has no real layout engine, so window.matchMedia is
 * mocked to answer as if the viewport were `width` wide. Only needed for the tests below that
 * specifically exercise hover-vs-touch behavior - every other test in this file relies on jsdom's
 * unmocked (mobile-like) default, matching this file's own existing convention. */
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

/** Week data cells lost their own aria-label/role=button in Package 5 (only the header's actions
 * menu navigates now) - locate one by its fixed position in the row instead: name(0), Soll/Woche(1),
 * one cell per week in month order(2..), Gesamt(last). */
function weekCellInRow(row: HTMLElement, weekIndexInMonth: number): HTMLElement {
  return within(row).getAllByRole('cell')[2 + weekIndexInMonth];
}

/** Opens a week's header actions menu and clicks its one "jump to week" item - the Package 5
 * replacement for directly clicking the (now removed) header role=button. */
async function jumpViaWeekMenu(user: ReturnType<typeof userEvent.setup>, week: number) {
  await user.click(screen.getByRole('button', { name: `Aktionen für Kalenderwoche ${week}` }));
  await user.click(await screen.findByRole('menuitem', { name: `Zu Kalenderwoche ${week} springen` }));
}

describe('MonthOverviewView', () => {
  afterEach(() => {
    // @ts-expect-error -- undo the per-test stub, jsdom has no matchMedia of its own to restore
    delete window.matchMedia;
  });

  beforeEach(() => {
    employeeForBranch.mockReset();
    absenceForBranch.mockReset();
    scheduleForBranch.mockReset();
    downloadTextFileMock.mockReset();
    employeeForBranch.mockResolvedValue([]);
    absenceForBranch.mockResolvedValue([]);
    scheduleForBranch.mockResolvedValue([]);
    useBranchesStore.setState({ branches: [], loading: false, loaded: true });
    useBranchSelectionStore.setState({ selectedBranchId: null });
    useCalendarWeekStore.setState({ selectedWeek: { year: 1999, week: 1 } });
    useNotificationStore.getState().clear();
  });

  it('shows an info alert and renders no table when no branch is selected', async () => {
    renderView();

    expect(await screen.findByText('Lege zuerst eine Filiale an.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Filiale anlegen' })).toHaveAttribute('href', '/de/branches');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(scheduleForBranch).not.toHaveBeenCalled();
  });

  it('shows a loading indicator while schedules are still loading, then the table once they resolve', async () => {
    selectBranch();
    employeeForBranch.mockResolvedValue([]);
    const schedulesLoad = deferred<WeeklySchedule[]>();
    scheduleForBranch.mockReturnValue(schedulesLoad.promise);

    renderView();

    expect(await screen.findByRole('status')).toHaveTextContent(/wird geladen/i);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();

    schedulesLoad.resolve([]);
    await waitFor(() => expect(screen.getByRole('table')).toBeInTheDocument());
  });

  it('zeigt einen Hinweistext, wenn keine Mitarbeiter zum Anzeigen vorhanden sind', async () => {
    selectBranch();
    employeeForBranch.mockResolvedValue([]);
    scheduleForBranch.mockResolvedValue([]);

    renderView();

    await waitFor(() => expect(screen.getByRole('table')).toBeInTheDocument());
    expect(screen.getByText('Noch kein Mitarbeiter für diese Filiale angelegt.')).toBeInTheDocument();
    // Only the header row - no employee data row.
    expect(screen.getAllByRole('row')).toHaveLength(2);
  });

  it('reports an error via the shared notification store when loading schedules fails', async () => {
    selectBranch();
    employeeForBranch.mockResolvedValue([]);
    scheduleForBranch.mockRejectedValue(new Error('Verbindung unterbrochen'));

    renderView();

    expect(await screen.findByText('Daten konnten nicht geladen werden: Verbindung unterbrochen')).toBeInTheDocument();
  });

  it('does not let a slow load for the previous branch overwrite a faster one for the branch switched to afterwards', async () => {
    const branchB: Branch = { ...branch, id: 'b2' as BranchId, name: 'Filiale Süd' };
    useBranchesStore.setState({ branches: [branch, branchB], loading: false, loaded: true });
    useBranchSelectionStore.setState({ selectedBranchId: branch.id });
    const employee = makeEmployee();
    employeeForBranch.mockResolvedValue([employee]);
    const week1 = calendarWeeksInMonth(currentYear, currentMonth)[0];
    const scheduleForBranchB = scheduleWithWeekdayShifts(employee.id, week1, ['Montag'], 8);

    const slowForBranchA = deferred<WeeklySchedule[]>();
    scheduleForBranch.mockImplementation(async (id: BranchId) =>
      id === branch.id ? slowForBranchA.promise : [scheduleForBranchB],
    );

    renderView();
    await screen.findByText(currentMonthLabel);

    await act(async () => {
      useBranchSelectionStore.setState({ selectedBranchId: branchB.id });
    });
    await waitFor(() => expect(weekCellInRow(screen.getByText(fullName(employee)).closest('tr')!, 0)).toHaveTextContent('8'));

    // Branch A's slow response finally arrives AFTER branch B's data is already showing - it must
    // not silently overwrite the table with branch A's (empty) schedule. Re-querying fresh below
    // (not reusing the element found above) matters: the unguarded bug does not just blank the
    // cell's text, it drops the whole KW column from the table (createMonthOverview returns no
    // rows at all for an empty schedules array) - a stale element reference would keep reporting
    // its last-known text ('8') even after React detaches it from the tree entirely.
    await act(async () => {
      slowForBranchA.resolve([]);
      await slowForBranchA.promise;
    });

    expect(weekCellInRow(screen.getByText(fullName(employee)).closest('tr')!, 0)).toHaveTextContent('8');
  });

  it('renders the current month/year and one row per employee with no schedule data loaded', async () => {
    selectBranch();
    const employee = makeEmployee();
    employeeForBranch.mockResolvedValue([employee]);
    scheduleForBranch.mockResolvedValue([]);

    renderView();

    expect(await screen.findByText(currentMonthLabel)).toBeInTheDocument();
    const row = (await screen.findByText(fullName(employee))).closest('tr');
    expect(row).not.toBeNull();
    expect(within(row!).getByText(sollWocheText(employee))).toBeInTheDocument();
    // No schedule loaded for any week of the month -> createMonthOverview finds nothing to
    // report, so there are no "KW" week columns to show a dash in at all.
    expect(screen.queryByText(/^KW /)).not.toBeInTheDocument();
    const cells = within(row!).getAllByRole('cell');
    expect(cells[cells.length - 1]).toHaveTextContent('0');
  });

  it('zeigt eine h1-Überschrift mit dem Seitentitel', async () => {
    selectBranch();
    renderView();

    expect(await screen.findByRole('heading', { level: 1, name: 'Monatsübersicht' })).toBeInTheDocument();
  });

  it('shows a dash for an employee not part of the loaded schedule, and the actual total for one who is', async () => {
    selectBranch();
    const assigned = makeEmployee({ id: 'e1' as EmployeeId, lastName: 'Assigned' });
    const unassigned = makeEmployee({ id: 'e2' as EmployeeId, lastName: 'Unassigned' });
    employeeForBranch.mockResolvedValue([assigned, unassigned]);
    const weeks = calendarWeeksInMonth(currentYear, currentMonth);
    const week1 = weeks[0];
    const schedule = createWeeklySchedule(branch.id, week1, [assigned.id]);
    scheduleForBranch.mockResolvedValue([schedule]);

    renderView();

    const assignedRow = (await screen.findByText(fullName(assigned))).closest('tr')!;
    expect(weekCellInRow(assignedRow, 0)).toHaveTextContent('0');

    const unassignedRow = screen.getByText(fullName(unassigned)).closest('tr')!;
    expect(weekCellInRow(unassignedRow, 0)).toHaveTextContent('–');
  });

  it('advances the month, wrapping December of this year into January of the next', async () => {
    selectBranch();
    employeeForBranch.mockResolvedValue([]);
    scheduleForBranch.mockResolvedValue([]);
    const user = userEvent.setup();
    renderView();
    await screen.findByText(currentMonthLabel);

    const next = screen.getByRole('button', { name: 'Nächster Monat' });
    const clicksToDecember = 12 - currentMonth;
    for (let i = 0; i < clicksToDecember; i++) {
      await user.click(next);
    }
    expect(screen.getByText(`Dezember ${currentYear}`)).toBeInTheDocument();

    await user.click(next);
    expect(screen.getByText(`Januar ${currentYear + 1}`)).toBeInTheDocument();
  });

  it('goes back a month, wrapping January of this year into December of the previous', async () => {
    selectBranch();
    employeeForBranch.mockResolvedValue([]);
    scheduleForBranch.mockResolvedValue([]);
    const user = userEvent.setup();
    renderView();
    await screen.findByText(currentMonthLabel);

    const previous = screen.getByRole('button', { name: 'Vorheriger Monat' });
    const clicksToJanuary = currentMonth - 1;
    for (let i = 0; i < clicksToJanuary; i++) {
      await user.click(previous);
    }
    expect(screen.getByText(`Januar ${currentYear}`)).toBeInTheDocument();

    await user.click(previous);
    expect(screen.getByText(`Dezember ${currentYear - 1}`)).toBeInTheDocument();
  });

  // Teil 6, Package 6: the month lives in the URL (?monat=2027-03), so a link or F5 keeps it.
  describe('month in the URL', () => {
    it('opens the month given as ?monat=', async () => {
      selectBranch();
      employeeForBranch.mockResolvedValue([]);
      scheduleForBranch.mockResolvedValue([]);
      renderView('/month?monat=2027-03');

      expect(await screen.findByText('März 2027')).toBeInTheDocument();
    });

    it('writes a month change into ?monat=, including a year change', async () => {
      selectBranch();
      employeeForBranch.mockResolvedValue([]);
      scheduleForBranch.mockResolvedValue([]);
      const user = userEvent.setup();
      renderView('/month?monat=2026-12');
      await screen.findByText('Dezember 2026');

      await user.click(screen.getByRole('button', { name: 'Nächster Monat' }));

      expect(screen.getByText('Januar 2027')).toBeInTheDocument();
      expect(screen.getByTestId('location-search')).toHaveTextContent('?monat=2027-01');
    });
  });

  describe('header (Teil 5, Package 10)', () => {
    it('has one month navigation: the Monat/Jahr selects only appear in the picker behind the month label', async () => {
      selectBranch();
      employeeForBranch.mockResolvedValue([]);
      scheduleForBranch.mockResolvedValue([]);
      const user = userEvent.setup();
      renderView();
      await screen.findByText(currentMonthLabel);

      expect(screen.queryByRole('combobox', { name: 'Monat' })).not.toBeInTheDocument();
      expect(screen.queryByRole('combobox', { name: 'Jahr' })).not.toBeInTheDocument();

      await openMonthPicker(user);

      const dialog = screen.getByRole('dialog', { name: 'Monat auswählen' });
      expect(within(dialog).getByRole('combobox', { name: 'Monat' })).toBeInTheDocument();
      expect(within(dialog).getByRole('combobox', { name: 'Jahr' })).toBeInTheDocument();

      // An explicit way back besides the X, for a dialog whose choices apply right away.
      await user.click(within(dialog).getByRole('button', { name: 'Fertig' }));
      await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Monat auswählen' })).not.toBeInTheDocument());
    });

    it('shows the ArbZG note only on demand, behind an info button', async () => {
      selectBranch();
      employeeForBranch.mockResolvedValue([]);
      scheduleForBranch.mockResolvedValue([]);
      const user = userEvent.setup();
      renderView();
      await screen.findByText(currentMonthLabel);

      expect(screen.queryByText(/Ruhezeit-Prüfung über Wochengrenzen/)).not.toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Hinweis zur Prüfung' }));

      expect(await screen.findByText(/Ruhezeit-Prüfung über Wochengrenzen/)).toBeInTheDocument();
      // Teil 8, Package 14: the note never reached the button's accessible description.
      expect(screen.getByRole('button', { name: 'Hinweis zur Prüfung' })).toHaveAccessibleDescription(/Ruhezeit/);
    });

    it('keeps "KW n" and its menu button on one line', async () => {
      selectBranch();
      const employee = makeEmployee();
      employeeForBranch.mockResolvedValue([employee]);
      const weeks = calendarWeeksInMonth(currentYear, currentMonth);
      scheduleForBranch.mockResolvedValue([createWeeklySchedule(branch.id, weeks[0], [employee.id])]);
      renderView();
      await screen.findByText(currentMonthLabel);

      const menuButton = await screen.findByRole('button', { name: `Aktionen für Kalenderwoche ${weeks[0].week}` });
      expect(menuButton.parentElement).toHaveStyle({ whiteSpace: 'nowrap' });
    });

    it('keeps a long employee name on one line on a phone, with the full name as title', async () => {
      selectBranch();
      const employee = makeEmployee({ lastName: 'Schmidt-Langenberg', firstName: 'Maximilian' });
      employeeForBranch.mockResolvedValue([employee]);
      scheduleForBranch.mockResolvedValue([]);
      renderView();

      const name = await screen.findByText(fullName(employee));
      expect(name).toHaveAttribute('title', fullName(employee));
      expect(name).toHaveStyle({ whiteSpace: 'nowrap', textOverflow: 'ellipsis' });
    });
  });

  it('loads the schedule once per branch and does not re-fetch on month navigation', async () => {
    selectBranch();
    employeeForBranch.mockResolvedValue([]);
    scheduleForBranch.mockResolvedValue([]);
    const user = userEvent.setup();
    renderView();
    await screen.findByText(currentMonthLabel);

    expect(scheduleForBranch).toHaveBeenCalledTimes(1);
    expect(scheduleForBranch).toHaveBeenCalledWith(branch.id);

    await user.click(screen.getByRole('button', { name: 'Nächster Monat' }));
    await user.click(screen.getByRole('button', { name: 'Nächster Monat' }));
    await user.click(screen.getByRole('button', { name: 'Vorheriger Monat' }));

    expect(scheduleForBranch).toHaveBeenCalledTimes(1);
  });

  it('jumping the Jahr-Select (in the month picker) to a different year shows that year\'s weeks for the same month', async () => {
    selectBranch();
    const employee = makeEmployee();
    employeeForBranch.mockResolvedValue([employee]);
    const weeksNextYear = calendarWeeksInMonth(currentYear + 1, currentMonth);
    scheduleForBranch.mockResolvedValue([createWeeklySchedule(branch.id, weeksNextYear[0], [employee.id])]);
    const user = userEvent.setup();
    renderView();
    await screen.findByText(currentMonthLabel);

    await openMonthPicker(user);
    await user.click(screen.getByRole('combobox', { name: 'Jahr' }));
    await user.click(screen.getByRole('option', { name: String(currentYear + 1) }));

    expect(screen.getByRole('combobox', { name: 'Jahr' })).toHaveTextContent(String(currentYear + 1));
    // The open picker is modal (the page behind it is aria-hidden), so close it before looking there.
    await user.click(screen.getByRole('button', { name: 'Schließen' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: `Aktionen für Kalenderwoche ${weeksNextYear[0].week}` })).toBeInTheDocument(),
    );
  });

  it('jumping the Monat-Select (in the month picker) to a different month works independently of the Jahr-Select', async () => {
    selectBranch();
    const employee = makeEmployee();
    employeeForBranch.mockResolvedValue([employee]);
    const marchWeeks = calendarWeeksInMonth(currentYear, 3);
    scheduleForBranch.mockResolvedValue([createWeeklySchedule(branch.id, marchWeeks[0], [employee.id])]);
    const user = userEvent.setup();
    renderView();
    await screen.findByText(currentMonthLabel);

    await openMonthPicker(user);
    await user.click(screen.getByRole('combobox', { name: 'Monat' }));
    await user.click(screen.getByRole('option', { name: 'März' }));

    expect(screen.getByRole('combobox', { name: 'Monat' })).toHaveTextContent('März');
    // The year field is untouched by a month-only jump.
    expect(screen.getByRole('combobox', { name: 'Jahr' })).toHaveTextContent(String(currentYear));
    await user.click(screen.getByRole('button', { name: 'Schließen' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: `Aktionen für Kalenderwoche ${marchWeeks[0].week}` })).toBeInTheDocument(),
    );
  });

  it('a week cell click after a Jahr-Sprung still selects that week and navigates to /schedule (jumpToWeek not bypassed)', async () => {
    selectBranch();
    const employee = makeEmployee();
    employeeForBranch.mockResolvedValue([employee]);
    const targetYear = currentYear + 1;
    const weeks = calendarWeeksInMonth(targetYear, currentMonth);
    const week1 = weeks[0];
    const schedule = createWeeklySchedule(branch.id, week1, [employee.id]);
    scheduleForBranch.mockResolvedValue([schedule]);
    const user = userEvent.setup();
    renderView();
    await screen.findByText(currentMonthLabel);

    await openMonthPicker(user);
    await user.click(screen.getByRole('combobox', { name: 'Jahr' }));
    await user.click(screen.getByRole('option', { name: String(targetYear) }));
    await user.click(screen.getByRole('button', { name: 'Schließen' }));

    await screen.findByRole('button', { name: `Aktionen für Kalenderwoche ${week1.week}` });
    await jumpViaWeekMenu(user, week1.week);

    await waitFor(() => expect(screen.getByText('schedule-route-landed')).toBeInTheDocument());
    expect(useCalendarWeekStore.getState().selectedWeek).toEqual(week1);
  });

  it('öffnet die Kalenderwoche über das Aktionsmenü der Wochenspalte', async () => {
    selectBranch();
    const employee = makeEmployee();
    employeeForBranch.mockResolvedValue([employee]);
    const weeks = calendarWeeksInMonth(currentYear, currentMonth);
    const week1 = weeks[0];
    const schedule = createWeeklySchedule(branch.id, week1, [employee.id]);
    scheduleForBranch.mockResolvedValue([schedule]);
    const user = userEvent.setup();
    renderView();

    await screen.findByRole('button', { name: `Aktionen für Kalenderwoche ${week1.week}` });
    await jumpViaWeekMenu(user, week1.week);

    await waitFor(() => expect(screen.getByText('schedule-route-landed')).toBeInTheDocument());
    expect(useCalendarWeekStore.getState().selectedWeek).toEqual(week1);
  });

  it('Wochen-Datenzellen sind nicht mehr interaktiv - nur die Kopfzeile bietet das Aktionsmenü', async () => {
    selectBranch();
    const employee = makeEmployee();
    employeeForBranch.mockResolvedValue([employee]);
    const weeks = calendarWeeksInMonth(currentYear, currentMonth);
    const week1 = weeks[0];
    const schedule = createWeeklySchedule(branch.id, week1, [employee.id]);
    scheduleForBranch.mockResolvedValue([schedule]);
    renderView();

    const row = (await screen.findByText(fullName(employee))).closest('tr')!;
    expect(within(row).queryByRole('button', { name: /KW \d+.*bearbeiten/ })).not.toBeInTheDocument();
    const dataCell = weekCellInRow(row, 0);
    expect(dataCell).not.toHaveAttribute('role', 'button');
    expect(dataCell).not.toHaveAttribute('tabindex');
  });

  it('hebt die fixierte Mitarbeiter-Zelle beim Hover der Zeile mit hervor', async () => {
    selectBranch();
    const employee = makeEmployee();
    employeeForBranch.mockResolvedValue([employee]);
    scheduleForBranch.mockResolvedValue([]);
    renderView();

    const nameCell = await screen.findByText(fullName(employee));
    expect(nameCell.closest('td')).toHaveClass('pep-sticky-first-column');
    const row = nameCell.closest('tr')!;
    const rowClass = Array.from(row.classList).find((c) => c.startsWith('css-'));
    // jsdom has no real :hover engine - assert on the injected Emotion stylesheet text instead.
    const styles = Array.from(document.querySelectorAll('style')).map((s) => s.textContent).join('\n');
    expect(styles).toContain(`.${rowClass}:hover .pep-sticky-first-column`);
  });

  it('puts the actions button on an inner element, not the <th> itself, for the week header (N23)', async () => {
    selectBranch();
    const employee = makeEmployee();
    employeeForBranch.mockResolvedValue([employee]);
    const weeks = calendarWeeksInMonth(currentYear, currentMonth);
    const week1 = weeks[0];
    scheduleForBranch.mockResolvedValue([createWeeklySchedule(branch.id, week1, [employee.id])]);
    renderView();

    const header = await screen.findByRole('button', { name: `Aktionen für Kalenderwoche ${week1.week}` });
    expect(header.tagName).not.toBe('TH');
    expect(header.closest('th')).not.toBeNull();
  });

  it('also jumps to the schedule on Enter when the week header\'s actions button is focused', async () => {
    selectBranch();
    const employee = makeEmployee();
    employeeForBranch.mockResolvedValue([employee]);
    const weeks = calendarWeeksInMonth(currentYear, currentMonth);
    const week1 = weeks[0];
    const schedule = createWeeklySchedule(branch.id, week1, [employee.id]);
    scheduleForBranch.mockResolvedValue([schedule]);
    const user = userEvent.setup();
    renderView();

    const header = await screen.findByRole('button', { name: `Aktionen für Kalenderwoche ${week1.week}` });
    // Wrapped in act(): ButtonBase's own focus-visible detection updates state on a raw DOM
    // .focus() call, outside userEvent's act() wrapping otherwise.
    act(() => header.focus());
    await user.keyboard('{Enter}');
    // MUI's Menu focuses its item asynchronously (Popper/transition timing) - wait for it to
    // actually land before the second Enter, or that keypress can race the focus-trap effect.
    await screen.findByRole('menuitem', { name: `Zu Kalenderwoche ${week1.week} springen` });
    await user.keyboard('{Enter}');

    await waitFor(() => expect(screen.getByText('schedule-route-landed')).toBeInTheDocument());
    expect(useCalendarWeekStore.getState().selectedWeek).toEqual(week1);
  });

  it('shows 0 (not a dash) for a week with no WeeklySchedule of its own, as long as some other week this month has one', async () => {
    selectBranch();
    const employee = makeEmployee();
    employeeForBranch.mockResolvedValue([employee]);
    const weeks = calendarWeeksInMonth(currentYear, currentMonth);
    expect(weeks.length).toBeGreaterThan(1);
    const [week1] = weeks;
    const schedule = createWeeklySchedule(branch.id, week1, [employee.id]);
    scheduleForBranch.mockResolvedValue([schedule]);

    renderView();

    const row = (await screen.findByText(fullName(employee))).closest('tr')!;
    expect(weekCellInRow(row, 1)).toHaveTextContent('0');
  });

  it('dims an inactive employee\'s row and marks it with an "Inaktiv" chip, matching the Stammdaten convention, as long as they still carry hours this month (N26)', async () => {
    selectBranch();
    const inactive = makeEmployee({ id: 'e2' as EmployeeId, lastName: 'Alt', active: false });
    employeeForBranch.mockResolvedValue([inactive]);
    const weeks = calendarWeeksInMonth(currentYear, currentMonth);
    scheduleForBranch.mockResolvedValue([scheduleWithWeekdayShifts(inactive.id, weeks[0], ['Montag'], 8)]);

    renderView();

    const nameCell = await screen.findByText(fullName(inactive));
    const row = nameCell.closest('tr')!;
    expect(within(row).getByText('Inaktiv')).toBeInTheDocument();
    expect(row).not.toHaveStyle({ opacity: '0.55' });
    expect(row).toHaveStyle({ backgroundColor: theme.palette.inactiveSurface, color: theme.palette.text.secondary });
  });

  it('drops an inactive employee from the month overview entirely once they carry no hours this month at all (N26)', async () => {
    selectBranch();
    const inactive = makeEmployee({ id: 'e2' as EmployeeId, lastName: 'Alt', active: false });
    employeeForBranch.mockResolvedValue([inactive]);
    scheduleForBranch.mockResolvedValue([]);

    renderView();

    await screen.findByRole('table');
    expect(screen.queryByText(fullName(inactive))).not.toBeInTheDocument();
  });

  it('shows a warning icon and tooltip next to Gesamt Monat when a Minijob employee exceeds their monthly-hours cap', async () => {
    selectBranch();
    const user = userEvent.setup();
    const minijobber = makeEmployee({
      id: 'e1' as EmployeeId,
      employmentType: { type: 'Minijob', minHours: 5, maxHours: 10, maxMonthlyHours: 40 },
    });
    employeeForBranch.mockResolvedValue([minijobber]);
    const weeks = calendarWeeksInMonth(currentYear, currentMonth);
    // 5 x 9h = 45h, over the 40h cap.
    const schedule = scheduleWithWeekdayShifts(
      minijobber.id,
      weeks[0],
      ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag'],
      9,
    );
    scheduleForBranch.mockResolvedValue([schedule]);

    renderView();
    await screen.findByText(fullName(minijobber));

    const row = screen.getByText(fullName(minijobber)).closest('tr')!;
    const warningButton = within(row).getByRole('button', { name: 'Monatsgrenze überschritten anzeigen' });
    await user.click(warningButton);

    expect(screen.getByText('45 Std. diesen Monat, Grenze 40 Std./Monat')).toBeInTheDocument();
    // Teil 8, Package 14: the tooltip text never reached the button's accessible description.
    expect(warningButton).toHaveAccessibleDescription('45 Std. diesen Monat, Grenze 40 Std./Monat');
  });

  it('der Monatslimit-Hinweis-Button hat eine 44x44-Trefffläche', async () => {
    selectBranch();
    const minijobber = makeEmployee({
      id: 'e1' as EmployeeId,
      employmentType: { type: 'Minijob', minHours: 5, maxHours: 10, maxMonthlyHours: 40 },
    });
    employeeForBranch.mockResolvedValue([minijobber]);
    const weeks = calendarWeeksInMonth(currentYear, currentMonth);
    const schedule = scheduleWithWeekdayShifts(
      minijobber.id,
      weeks[0],
      ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag'],
      9,
    );
    scheduleForBranch.mockResolvedValue([schedule]);

    renderView();
    await screen.findByText(fullName(minijobber));

    const row = screen.getByText(fullName(minijobber)).closest('tr')!;
    const warningButton = within(row).getByRole('button', { name: 'Monatsgrenze überschritten anzeigen' });
    expect(warningButton).toHaveStyle({ minWidth: '44px', minHeight: '44px' });
  });

  it('shows no warning icon when the Minijob employee stays within their monthly-hours cap', async () => {
    selectBranch();
    const minijobber = makeEmployee({
      id: 'e1' as EmployeeId,
      employmentType: { type: 'Minijob', minHours: 5, maxHours: 10, maxMonthlyHours: 40 },
    });
    employeeForBranch.mockResolvedValue([minijobber]);
    const weeks = calendarWeeksInMonth(currentYear, currentMonth);
    const schedule = scheduleWithWeekdayShifts(minijobber.id, weeks[0], ['Montag'], 8);
    scheduleForBranch.mockResolvedValue([schedule]);

    renderView();
    await screen.findByText(fullName(minijobber));

    const row = screen.getByText(fullName(minijobber)).closest('tr')!;
    expect(within(row).queryByRole('button', { name: 'Monatsgrenze überschritten anzeigen' })).not.toBeInTheDocument();
  });

  it('never shows the monthly-hours warning for FullTime/PartTime employees, even with a very high total', async () => {
    selectBranch();
    const fullTimer = makeEmployee({ id: 'e1' as EmployeeId, employmentType: { type: 'FullTime', weeklyHours: 40 } });
    employeeForBranch.mockResolvedValue([fullTimer]);
    const weeks = calendarWeeksInMonth(currentYear, currentMonth);
    const schedule = scheduleWithWeekdayShifts(
      fullTimer.id,
      weeks[0],
      ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag'],
      9,
    );
    scheduleForBranch.mockResolvedValue([schedule]);

    renderView();
    await screen.findByText(fullName(fullTimer));

    const row = screen.getByText(fullName(fullTimer)).closest('tr')!;
    expect(within(row).queryByRole('button', { name: 'Monatsgrenze überschritten anzeigen' })).not.toBeInTheDocument();
  });

  it('shows no warning for a Minijob employee without maxMonthlyHours set, even over a high total (not set = no check)', async () => {
    selectBranch();
    const minijobber = makeEmployee({
      id: 'e1' as EmployeeId,
      employmentType: { type: 'Minijob', minHours: 5, maxHours: 10 },
    });
    employeeForBranch.mockResolvedValue([minijobber]);
    const weeks = calendarWeeksInMonth(currentYear, currentMonth);
    const schedule = scheduleWithWeekdayShifts(
      minijobber.id,
      weeks[0],
      ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag'],
      9,
    );
    scheduleForBranch.mockResolvedValue([schedule]);

    renderView();
    await screen.findByText(fullName(minijobber));

    const row = screen.getByText(fullName(minijobber)).closest('tr')!;
    expect(within(row).queryByRole('button', { name: 'Monatsgrenze überschritten anzeigen' })).not.toBeInTheDocument();
  });

  it('shows an ArbZG warning icon in exactly the violating week\'s cell, with a tooltip and an info footnote about the missing rest-period check', async () => {
    selectBranch();
    const user = userEvent.setup();
    const employee = makeEmployee();
    employeeForBranch.mockResolvedValue([employee]);
    const weeks = calendarWeeksInMonth(currentYear, currentMonth);
    expect(weeks.length).toBeGreaterThan(1);
    const violatingSchedule = withDayEntry(
      createWeeklySchedule(branch.id, weeks[0], [employee.id]),
      employee.id,
      'Montag',
      { type: 'Shift', shifts: [createShift(clockTime('06:00'), clockTime('20:00'))] }, // 14h, over the 10h daily max
    );
    scheduleForBranch.mockResolvedValue([violatingSchedule]);

    renderView();
    await screen.findByText(currentMonthLabel);

    // The footnote sits behind the info button next to the heading since Teil 5.
    await user.click(screen.getByRole('button', { name: 'Hinweis zur Prüfung' }));
    expect(await screen.findByText(/Ruhezeit/)).toBeInTheDocument();

    const violatingRow = (await screen.findByText(fullName(employee))).closest('tr')!;
    const violatingCell = weekCellInRow(violatingRow, 0);
    const warningIcon = within(violatingCell).getByRole('button', { name: 'Fehler anzeigen' });
    await user.click(warningIcon);

    expect(
      screen.getByText('Tägliche Arbeitszeit von 14 Std. überschreitet die gesetzlich zulässige Höchstgrenze von 10 Std.'),
    ).toBeInTheDocument();
    // Clicking the icon must not also trigger the cell's own "jump to week" navigation.
    expect(screen.queryByText('schedule-route-landed')).not.toBeInTheDocument();

    const cleanCell = weekCellInRow(violatingRow, 1);
    expect(within(cleanCell).queryByRole('button', { name: 'Fehler anzeigen' })).not.toBeInTheDocument();
  });

  // Teil 8, Package 8: a failed load showed every employee with 0 hours, which looked real.
  it('shows a load error with a retry instead of a table of zeros', async () => {
    selectBranch();
    const user = userEvent.setup();
    const employee = makeEmployee();
    employeeForBranch.mockResolvedValue([employee]);
    scheduleForBranch.mockRejectedValueOnce(new Error('boom')).mockResolvedValue([]);

    renderView();

    expect(await screen.findByText('Daten konnten nicht geladen werden.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Erneut versuchen' }));
    expect(await screen.findByRole('table')).toBeInTheDocument();
  });

  // Teil 8, Package 6: error and warning used the same icon and label, only the colour differed.
  it('tells an error from a warning by icon and label, not by colour alone', async () => {
    selectBranch();
    const employee = makeEmployee();
    employeeForBranch.mockResolvedValue([employee]);
    const weeks = calendarWeeksInMonth(currentYear, currentMonth);
    const errorWeek = withDayEntry(
      createWeeklySchedule(branch.id, weeks[0], [employee.id]),
      employee.id,
      'Montag',
      { type: 'Shift', shifts: [createShift(clockTime('06:00'), clockTime('20:00'))] }, // over 10h: error
    );
    const warningWeek = withDayEntry(
      createWeeklySchedule(branch.id, weeks[1], [employee.id]),
      employee.id,
      'Sonntag',
      { type: 'Shift', shifts: [createShift(clockTime('08:00'), clockTime('12:00'))] }, // Sunday work: warning only
    );
    scheduleForBranch.mockResolvedValue([errorWeek, warningWeek]);

    renderView();
    const row = (await screen.findByText(fullName(employee))).closest('tr')!;

    const errorButton = within(weekCellInRow(row, 0)).getByRole('button', { name: 'Fehler anzeigen' });
    expect(within(errorButton).getByTestId('ErrorOutlineIcon')).toBeInTheDocument();
    const warningButton = within(weekCellInRow(row, 1)).getByRole('button', { name: 'Warnung anzeigen' });
    expect(within(warningButton).getByTestId('WarningAmberIcon')).toBeInTheDocument();
  });

  it('der Wochenwert-Hinweis-Button hat eine 44x44-Trefffläche', async () => {
    selectBranch();
    const employee = makeEmployee();
    employeeForBranch.mockResolvedValue([employee]);
    const weeks = calendarWeeksInMonth(currentYear, currentMonth);
    const violatingSchedule = withDayEntry(
      createWeeklySchedule(branch.id, weeks[0], [employee.id]),
      employee.id,
      'Montag',
      { type: 'Shift', shifts: [createShift(clockTime('06:00'), clockTime('20:00'))] },
    );
    scheduleForBranch.mockResolvedValue([violatingSchedule]);

    renderView();
    const violatingRow = (await screen.findByText(fullName(employee))).closest('tr')!;
    const violatingCell = weekCellInRow(violatingRow, 0);
    const warningIcon = within(violatingCell).getByRole('button', { name: 'Fehler anzeigen' });
    expect(warningIcon).toHaveStyle({ minWidth: '44px', minHeight: '44px' });
  });

  it('shows the week-cell warning tooltip on hover from tablet width up', async () => {
    mockViewportWidth(1025);
    selectBranch();
    const user = userEvent.setup();
    const employee = makeEmployee();
    employeeForBranch.mockResolvedValue([employee]);
    const weeks = calendarWeeksInMonth(currentYear, currentMonth);
    const violatingSchedule = withDayEntry(
      createWeeklySchedule(branch.id, weeks[0], [employee.id]),
      employee.id,
      'Montag',
      { type: 'Shift', shifts: [createShift(clockTime('06:00'), clockTime('20:00'))] }, // 14h, over the 10h daily max
    );
    scheduleForBranch.mockResolvedValue([violatingSchedule]);

    renderView();
    const violatingRow = (await screen.findByText(fullName(employee))).closest('tr')!;
    const violatingCell = weekCellInRow(violatingRow, 0);
    const warningIcon = within(violatingCell).getByRole('button', { name: 'Fehler anzeigen' });

    await user.hover(warningIcon);
    expect(await screen.findByText(/überschreitet die gesetzlich zulässige Höchstgrenze/)).toBeInTheDocument();

    await user.unhover(warningIcon);
    await waitFor(() => expect(screen.queryByText(/überschreitet die gesetzlich zulässige Höchstgrenze/)).not.toBeInTheDocument());
  });

  it('does nothing on hover at mobile width - tap still opens the warning tooltip', async () => {
    selectBranch();
    const user = userEvent.setup();
    const employee = makeEmployee();
    employeeForBranch.mockResolvedValue([employee]);
    const weeks = calendarWeeksInMonth(currentYear, currentMonth);
    const violatingSchedule = withDayEntry(
      createWeeklySchedule(branch.id, weeks[0], [employee.id]),
      employee.id,
      'Montag',
      { type: 'Shift', shifts: [createShift(clockTime('06:00'), clockTime('20:00'))] },
    );
    scheduleForBranch.mockResolvedValue([violatingSchedule]);

    renderView();
    const violatingRow = (await screen.findByText(fullName(employee))).closest('tr')!;
    const violatingCell = weekCellInRow(violatingRow, 0);
    const warningIcon = within(violatingCell).getByRole('button', { name: 'Fehler anzeigen' });

    await user.hover(warningIcon);
    expect(screen.queryByText(/überschreitet die gesetzlich zulässige Höchstgrenze/)).not.toBeInTheDocument();

    await user.click(warningIcon);
    expect(await screen.findByText(/überschreitet die gesetzlich zulässige Höchstgrenze/)).toBeInTheDocument();
  });

  it('a second click on the same warning icon closes the tooltip again', async () => {
    selectBranch();
    const user = userEvent.setup();
    const employee = makeEmployee();
    employeeForBranch.mockResolvedValue([employee]);
    const weeks = calendarWeeksInMonth(currentYear, currentMonth);
    const violatingSchedule = withDayEntry(
      createWeeklySchedule(branch.id, weeks[0], [employee.id]),
      employee.id,
      'Montag',
      { type: 'Shift', shifts: [createShift(clockTime('06:00'), clockTime('20:00'))] },
    );
    scheduleForBranch.mockResolvedValue([violatingSchedule]);

    renderView();
    const violatingRow = (await screen.findByText(fullName(employee))).closest('tr')!;
    const violatingCell = weekCellInRow(violatingRow, 0);
    const warningIcon = within(violatingCell).getByRole('button', { name: 'Fehler anzeigen' });

    await user.click(warningIcon);
    expect(await screen.findByText(/überschreitet die gesetzlich zulässige Höchstgrenze/)).toBeInTheDocument();

    await user.click(warningIcon);
    await waitFor(() => expect(screen.queryByText(/überschreitet die gesetzlich zulässige Höchstgrenze/)).not.toBeInTheDocument());
  });

  it('closes the week-cell warning tooltip when clicking a different, unrelated element (click-away)', async () => {
    selectBranch();
    const user = userEvent.setup();
    const employee = makeEmployee();
    employeeForBranch.mockResolvedValue([employee]);
    const weeks = calendarWeeksInMonth(currentYear, currentMonth);
    const violatingSchedule = withDayEntry(
      createWeeklySchedule(branch.id, weeks[0], [employee.id]),
      employee.id,
      'Montag',
      { type: 'Shift', shifts: [createShift(clockTime('06:00'), clockTime('20:00'))] },
    );
    scheduleForBranch.mockResolvedValue([violatingSchedule]);

    renderView();
    const violatingRow = (await screen.findByText(fullName(employee))).closest('tr')!;
    const violatingCell = weekCellInRow(violatingRow, 0);
    const warningIcon = within(violatingCell).getByRole('button', { name: 'Fehler anzeigen' });

    await user.click(warningIcon);
    expect(await screen.findByText(/überschreitet die gesetzlich zulässige Höchstgrenze/)).toBeInTheDocument();

    await user.click(screen.getByText(currentMonthLabel));
    await waitFor(() => expect(screen.queryByText(/überschreitet die gesetzlich zulässige Höchstgrenze/)).not.toBeInTheDocument());
  });

  describe('CSV-Export', () => {
    it('opens a preview instead of downloading immediately, showing the CSV that will be downloaded', async () => {
      selectBranch();
      const employee = makeEmployee();
      employeeForBranch.mockResolvedValue([employee]);
      const weeks = calendarWeeksInMonth(currentYear, currentMonth);
      scheduleForBranch.mockResolvedValue([createWeeklySchedule(branch.id, weeks[0], [employee.id])]);
      const user = userEvent.setup();
      renderView();
      await screen.findByText(currentMonthLabel);

      await user.click(screen.getByRole('button', { name: 'Exportieren' }));

      expect(downloadTextFileMock).not.toHaveBeenCalled();
      const dialog = await screen.findByRole('dialog', { name: 'Vorschau des CSV-Exports' });
      expect(within(dialog).getByText(/Mitarbeiter;Soll-Woche/)).toBeInTheDocument();
      expect(within(dialog).getByText(new RegExp(fullName(employee)))).toBeInTheDocument();
    });

    it('downloads with the built filename/content/mimeType only after confirming in the preview dialog', async () => {
      selectBranch();
      const employee = makeEmployee();
      employeeForBranch.mockResolvedValue([employee]);
      const weeks = calendarWeeksInMonth(currentYear, currentMonth);
      scheduleForBranch.mockResolvedValue([createWeeklySchedule(branch.id, weeks[0], [employee.id])]);
      const user = userEvent.setup();
      renderView();
      await screen.findByText(currentMonthLabel);

      await user.click(screen.getByRole('button', { name: 'Exportieren' }));
      await screen.findByRole('dialog', { name: 'Vorschau des CSV-Exports' });
      await user.click(screen.getByRole('button', { name: 'Herunterladen' }));

      const monthPadded = String(currentMonth).padStart(2, '0');
      expect(downloadTextFileMock).toHaveBeenCalledTimes(1);
      const [filename, content, mimeType] = downloadTextFileMock.mock.calls[0];
      expect(filename).toBe(`monatsuebersicht-${currentYear}-${monthPadded}.csv`);
      expect(content).toContain('Mitarbeiter;Soll-Woche');
      expect(content).toContain(fullName(employee));
      expect(mimeType).toContain('text/csv');
      // MUI's Dialog keeps the element mounted through its exit transition - waitFor, not a bare
      // assertion right after the click, same pattern used elsewhere for closing MUI dialogs.
      await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Vorschau des CSV-Exports' })).not.toBeInTheDocument());
    });

    it('closes without downloading when Abbrechen is clicked', async () => {
      selectBranch();
      employeeForBranch.mockResolvedValue([]);
      scheduleForBranch.mockResolvedValue([]);
      const user = userEvent.setup();
      renderView();
      await screen.findByText(currentMonthLabel);

      await user.click(screen.getByRole('button', { name: 'Exportieren' }));
      await screen.findByRole('dialog', { name: 'Vorschau des CSV-Exports' });
      await user.click(screen.getByRole('button', { name: 'Abbrechen' }));

      await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Vorschau des CSV-Exports' })).not.toBeInTheDocument());
      expect(downloadTextFileMock).not.toHaveBeenCalled();
    });

    it('shows an error notification instead of throwing when the download itself fails', async () => {
      selectBranch();
      employeeForBranch.mockResolvedValue([]);
      scheduleForBranch.mockResolvedValue([]);
      downloadTextFileMock.mockImplementationOnce(() => {
        throw new Error('Download blockiert');
      });
      const user = userEvent.setup();
      renderView();
      await screen.findByText(currentMonthLabel);

      await user.click(screen.getByRole('button', { name: 'Exportieren' }));
      await screen.findByRole('dialog', { name: 'Vorschau des CSV-Exports' });
      await user.click(screen.getByRole('button', { name: 'Herunterladen' }));

      expect(await screen.findByText(/Die Monatsübersicht konnte nicht exportiert werden/)).toBeInTheDocument();
    });
  });
});
