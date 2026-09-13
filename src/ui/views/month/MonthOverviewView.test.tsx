import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import type { BranchId, EmployeeId } from '@domain/shared/ids';
import type { Branch } from '@domain/branch/Branch';
import type { Employee } from '@domain/employee/Employee';
import { fullName } from '@domain/employee/Employee';
import { targetWeeklyHoursRange } from '@domain/employee/EmploymentType';
import { formatHoursRangeGerman } from '@domain/schedule/scheduleCalculation';
import type { CalendarWeek, Weekday } from '@domain/shared/CalendarWeek';
import { calendarWeeksInMonth } from '@domain/shared/CalendarWeek';
import { createWeeklySchedule, withDayEntry } from '@domain/schedule/WeeklySchedule';
import { createShift } from '@domain/schedule/Shift';
import { clockTime } from '@domain/shared/ClockTime';
import { services } from '@infrastructure/services';
import { useBranchesStore } from '@ui/app/store/branchesStore';
import { useBranchSelectionStore } from '@ui/app/store/branchSelectionStore';
import { useCalendarWeekStore } from '@ui/app/store/calendarWeekStore';
import { AppNotifications } from '@ui/app/AppNotifications';
import { useNotificationStore } from '@ui/app/store/notificationStore';
import { MonthOverviewView } from './MonthOverviewView';

vi.mock('@infrastructure/services', () => ({
  services: {
    branch: { all: vi.fn() },
    employee: { forBranch: vi.fn() },
    absence: { forEmployees: vi.fn() },
    schedule: { forBranch: vi.fn() },
  },
}));

const employeeForBranch = vi.mocked(services.employee.forBranch);
const absenceForBranch = vi.mocked(services.absence.forEmployees);
const scheduleForBranch = vi.mocked(services.schedule.forBranch);

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

function selectBranch() {
  useBranchesStore.setState({ branches: [branch], loading: false, loaded: true });
  useBranchSelectionStore.setState({ selectedBranchId: branch.id });
}

const renderView = () =>
  render(
    <MemoryRouter initialEntries={['/month']}>
      <Routes>
        <Route
          path="/month"
          element={
            <>
              <MonthOverviewView />
              <AppNotifications />
            </>
          }
        />
        <Route path="/schedule" element={<div>schedule-route-landed</div>} />
      </Routes>
    </MemoryRouter>,
  );

const now = new Date();
const currentYear = now.getFullYear();
const currentMonth = now.getMonth() + 1;
const currentMonthLabel = `${MONTH_NAMES[currentMonth - 1]} ${currentYear}`;

describe('MonthOverviewView', () => {
  beforeEach(() => {
    employeeForBranch.mockReset();
    absenceForBranch.mockReset();
    scheduleForBranch.mockReset();
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

    expect(await screen.findByText('Bitte zuerst oben eine Filiale auswählen oder anlegen.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(scheduleForBranch).not.toHaveBeenCalled();
  });

  it('renders the current month/year and one row per employee with no schedule data loaded', async () => {
    selectBranch();
    const employee = makeEmployee();
    employeeForBranch.mockResolvedValue([employee]);
    scheduleForBranch.mockResolvedValue([]);

    renderView();

    expect(await screen.findByText(currentMonthLabel)).toBeInTheDocument();
    const row = screen.getByText(fullName(employee)).closest('tr');
    expect(row).not.toBeNull();
    expect(within(row!).getByText(sollWocheText(employee))).toBeInTheDocument();
    // No schedule loaded for any week of the month -> createMonthOverview finds nothing to
    // report, so there are no "KW" week columns to show a dash in at all.
    expect(screen.queryByText(/^KW /)).not.toBeInTheDocument();
    const cells = within(row!).getAllByRole('cell');
    expect(cells[cells.length - 1]).toHaveTextContent('0');
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

    const assignedCell = await screen.findByRole('button', {
      name: `${fullName(assigned)}, KW ${week1.week} bearbeiten`,
    });
    expect(assignedCell).toHaveTextContent('0');

    const unassignedCell = screen.getByRole('button', {
      name: `${fullName(unassigned)}, KW ${week1.week} bearbeiten`,
    });
    expect(unassignedCell).toHaveTextContent('–');
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

  it('jumping the Jahr-Select to a different year shows that year\'s weeks for the same month', async () => {
    selectBranch();
    const employee = makeEmployee();
    employeeForBranch.mockResolvedValue([employee]);
    const weeksNextYear = calendarWeeksInMonth(currentYear + 1, currentMonth);
    scheduleForBranch.mockResolvedValue([createWeeklySchedule(branch.id, weeksNextYear[0], [employee.id])]);
    const user = userEvent.setup();
    renderView();
    await screen.findByText(currentMonthLabel);

    await user.click(screen.getByRole('combobox', { name: 'Jahr' }));
    await user.click(screen.getByRole('option', { name: String(currentYear + 1) }));

    expect(screen.getByRole('combobox', { name: 'Jahr' })).toHaveTextContent(String(currentYear + 1));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: `Zu Kalenderwoche ${weeksNextYear[0].week} springen` })).toBeInTheDocument(),
    );
  });

  it('jumping the Monat-Select to a different month works independently of the Jahr-Select', async () => {
    selectBranch();
    const employee = makeEmployee();
    employeeForBranch.mockResolvedValue([employee]);
    const marchWeeks = calendarWeeksInMonth(currentYear, 3);
    scheduleForBranch.mockResolvedValue([createWeeklySchedule(branch.id, marchWeeks[0], [employee.id])]);
    const user = userEvent.setup();
    renderView();
    await screen.findByText(currentMonthLabel);

    await user.click(screen.getByRole('combobox', { name: 'Monat' }));
    await user.click(screen.getByRole('option', { name: 'März' }));

    expect(screen.getByRole('combobox', { name: 'Monat' })).toHaveTextContent('März');
    // The year field is untouched by a month-only jump.
    expect(screen.getByRole('combobox', { name: 'Jahr' })).toHaveTextContent(String(currentYear));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: `Zu Kalenderwoche ${marchWeeks[0].week} springen` })).toBeInTheDocument(),
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

    await user.click(screen.getByRole('combobox', { name: 'Jahr' }));
    await user.click(screen.getByRole('option', { name: String(targetYear) }));

    const header = await screen.findByRole('button', { name: `Zu Kalenderwoche ${week1.week} springen` });
    await user.click(header);

    await waitFor(() => expect(screen.getByText('schedule-route-landed')).toBeInTheDocument());
    expect(useCalendarWeekStore.getState().selectedWeek).toEqual(week1);
  });

  it('jumps to the schedule and selects the clicked calendar week', async () => {
    selectBranch();
    const employee = makeEmployee();
    employeeForBranch.mockResolvedValue([employee]);
    const weeks = calendarWeeksInMonth(currentYear, currentMonth);
    const week1 = weeks[0];
    const schedule = createWeeklySchedule(branch.id, week1, [employee.id]);
    scheduleForBranch.mockResolvedValue([schedule]);
    const user = userEvent.setup();
    renderView();

    const header = await screen.findByRole('button', { name: `Zu Kalenderwoche ${week1.week} springen` });
    await user.click(header);

    await waitFor(() => expect(screen.getByText('schedule-route-landed')).toBeInTheDocument());
    expect(useCalendarWeekStore.getState().selectedWeek).toEqual(week1);
  });

  it('also jumps to the schedule on Enter when the week header is focused', async () => {
    selectBranch();
    const employee = makeEmployee();
    employeeForBranch.mockResolvedValue([employee]);
    const weeks = calendarWeeksInMonth(currentYear, currentMonth);
    const week1 = weeks[0];
    const schedule = createWeeklySchedule(branch.id, week1, [employee.id]);
    scheduleForBranch.mockResolvedValue([schedule]);
    const user = userEvent.setup();
    renderView();

    const header = await screen.findByRole('button', { name: `Zu Kalenderwoche ${week1.week} springen` });
    header.focus();
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
    const [week1, week2] = weeks;
    const schedule = createWeeklySchedule(branch.id, week1, [employee.id]);
    scheduleForBranch.mockResolvedValue([schedule]);

    renderView();

    const week2Cell = await screen.findByRole('button', {
      name: `${fullName(employee)}, KW ${week2.week} bearbeiten`,
    });
    expect(week2Cell).toHaveTextContent('0');
  });

  it('dims an inactive employee\'s row and marks it with an "Inaktiv" chip, matching the Stammdaten convention', async () => {
    selectBranch();
    const inactive = makeEmployee({ id: 'e2' as EmployeeId, lastName: 'Alt', active: false });
    employeeForBranch.mockResolvedValue([inactive]);
    scheduleForBranch.mockResolvedValue([]);

    renderView();

    const nameCell = await screen.findByText(fullName(inactive));
    const row = nameCell.closest('tr')!;
    expect(within(row).getByText('Inaktiv')).toBeInTheDocument();
    expect(row).toHaveStyle({ opacity: '0.55' });
  });

  it('gives only the first week cell of each row a tab stop, not every individual cell', async () => {
    selectBranch();
    const employee = makeEmployee();
    employeeForBranch.mockResolvedValue([employee]);
    const weeks = calendarWeeksInMonth(currentYear, currentMonth);
    expect(weeks.length).toBeGreaterThan(1);
    const schedule = createWeeklySchedule(branch.id, weeks[0], [employee.id]);
    scheduleForBranch.mockResolvedValue([schedule]);

    renderView();
    await screen.findByText(fullName(employee));

    const row = screen.getByText(fullName(employee)).closest('tr')!;
    const weekButtons = within(row).getAllByRole('button');
    expect(weekButtons).toHaveLength(weeks.length);
    expect(weekButtons[0].tabIndex).toBe(0);
    for (const button of weekButtons.slice(1)) {
      expect(button.tabIndex).toBe(-1);
    }
  });

  it('moves focus between a row\'s week cells with ArrowRight/ArrowLeft', async () => {
    selectBranch();
    const employee = makeEmployee();
    employeeForBranch.mockResolvedValue([employee]);
    const weeks = calendarWeeksInMonth(currentYear, currentMonth);
    const schedule = createWeeklySchedule(branch.id, weeks[0], [employee.id]);
    scheduleForBranch.mockResolvedValue([schedule]);
    const user = userEvent.setup();

    renderView();
    await screen.findByText(fullName(employee));

    const row = screen.getByText(fullName(employee)).closest('tr')!;
    const weekButtons = within(row).getAllByRole('button');
    weekButtons[0].focus();
    expect(weekButtons[0]).toHaveFocus();

    await user.keyboard('{ArrowRight}');
    expect(weekButtons[1]).toHaveFocus();

    await user.keyboard('{ArrowLeft}');
    expect(weekButtons[0]).toHaveFocus();
  });

  it('also jumps to the schedule on Enter when a data cell within a row is focused', async () => {
    selectBranch();
    const employee = makeEmployee();
    employeeForBranch.mockResolvedValue([employee]);
    const weeks = calendarWeeksInMonth(currentYear, currentMonth);
    const week1 = weeks[0];
    const schedule = createWeeklySchedule(branch.id, week1, [employee.id]);
    scheduleForBranch.mockResolvedValue([schedule]);
    const user = userEvent.setup();
    renderView();

    const cell = await screen.findByRole('button', { name: `${fullName(employee)}, KW ${week1.week} bearbeiten` });
    cell.focus();
    await user.keyboard('{Enter}');

    await waitFor(() => expect(screen.getByText('schedule-route-landed')).toBeInTheDocument());
    expect(useCalendarWeekStore.getState().selectedWeek).toEqual(week1);
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

    expect(screen.getByText(/Ruhezeit/)).toBeInTheDocument();

    const violatingCell = await screen.findByRole('button', {
      name: `${fullName(employee)}, KW ${weeks[0].week} bearbeiten`,
    });
    const warningIcon = within(violatingCell).getByRole('button', { name: 'Hinweis anzeigen' });
    await user.click(warningIcon);

    expect(
      screen.getByText('Tägliche Arbeitszeit von 14 Std. überschreitet die gesetzlich zulässige Höchstgrenze von 10 Std.'),
    ).toBeInTheDocument();
    // Clicking the icon must not also trigger the cell's own "jump to week" navigation.
    expect(screen.queryByText('schedule-route-landed')).not.toBeInTheDocument();

    const cleanCell = screen.getByRole('button', { name: `${fullName(employee)}, KW ${weeks[1].week} bearbeiten` });
    expect(within(cleanCell).queryByRole('button', { name: 'Hinweis anzeigen' })).not.toBeInTheDocument();
  });
});
