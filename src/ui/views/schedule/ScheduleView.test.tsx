import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import { theme } from '@ui/app/theme';

import type { BranchId, EmployeeId, ShiftTemplateId } from '@domain/shared/ids';
import type { Branch } from '@domain/branch/Branch';
import type { Employee } from '@domain/employee/Employee';
import { fullName } from '@domain/employee/Employee';
import type { CalendarWeek } from '@domain/shared/CalendarWeek';
import {
  dateForWeekday,
  formatCalendarWeekRange,
  calendarWeekFromDate,
  calendarWeeksEqual,
  calendarWeeksInMonth,
  mondayOfWeek,
  nextCalendarWeek,
  previousCalendarWeek,
} from '@domain/shared/CalendarWeek';
import { toISODate } from '@domain/shared/DateFormat';
import { clockTime } from '@domain/shared/ClockTime';
import { createShift } from '@domain/schedule/Shift';
import { createWeeklySchedule, withDayEntry, withDayEntries, withTargetAdjustment } from '@domain/schedule/WeeklySchedule';
import type { WeeklySchedule } from '@domain/schedule/WeeklySchedule';
import { createAbsence } from '@domain/absence/Absence';
import type { Absence } from '@domain/absence/Absence';
import type { ShiftTemplate } from '@domain/schedule/ShiftTemplate';
import { formatHoursRangeGerman, minutesToDecimalHours } from '@domain/schedule/scheduleCalculation';
import { effectiveTargetMinutesRange } from '@application/schedule/scheduleAssessment';
import { services } from '@infrastructure/services';
import { useBranchesStore } from '@ui/app/store/branchesStore';
import { useBranchSelectionStore } from '@ui/app/store/branchSelectionStore';
import { useCalendarWeekStore } from '@ui/app/store/calendarWeekStore';
import { AppNotifications } from '@ui/app/AppNotifications';
import { useNotificationStore } from '@ui/app/store/notificationStore';
import { ScheduleView } from './ScheduleView';

vi.mock('@infrastructure/services', () => ({
  services: {
    branch: { all: vi.fn() },
    employee: { forBranch: vi.fn() },
    schedule: {
      getOrCreate: vi.fn(),
      save: vi.fn(),
      setDayEntryAndSave: vi.fn(),
      setDayEntriesAndSave: vi.fn(),
      findForWeek: vi.fn(),
      applyTargetAdjustments: vi.fn(),
      overwriteWithPreviousWeek: vi.fn(),
      forBranch: vi.fn(),
    },
    absence: { forEmployees: vi.fn(), create: vi.fn(), delete: vi.fn(), restore: vi.fn() },
    shiftTemplate: { forBranch: vi.fn(), delete: vi.fn() },
    restPeriodCheck: { checkWeek: vi.fn(async () => []) },
  },
}));

const branchAll = vi.mocked(services.branch.all);
const employeeForBranch = vi.mocked(services.employee.forBranch);
const scheduleGetOrCreate = vi.mocked(services.schedule.getOrCreate);
const scheduleSave = vi.mocked(services.schedule.save);
const scheduleSetDayEntryAndSave = vi.mocked(services.schedule.setDayEntryAndSave);
const scheduleSetDayEntriesAndSave = vi.mocked(services.schedule.setDayEntriesAndSave);
const scheduleFindForWeek = vi.mocked(services.schedule.findForWeek);
const scheduleApplyTargetAdjustments = vi.mocked(services.schedule.applyTargetAdjustments);
const scheduleOverwriteWithPreviousWeek = vi.mocked(services.schedule.overwriteWithPreviousWeek);
const scheduleForBranch = vi.mocked(services.schedule.forBranch);
const absenceForBranch = vi.mocked(services.absence.forEmployees);
const absenceCreate = vi.mocked(services.absence.create);
const absenceDelete = vi.mocked(services.absence.delete);
const absenceRestore = vi.mocked(services.absence.restore);
const shiftTemplateForBranch = vi.mocked(services.shiftTemplate.forBranch);
const shiftTemplateDelete = vi.mocked(services.shiftTemplate.delete);
const restPeriodCheckWeek = vi.mocked(services.restPeriodCheck.checkWeek);

/** jsdom has no real layout engine, so `window.matchMedia` is mocked per test to answer as if the
 * viewport were `width` x `height` - MUI's `theme.breakpoints.up(key)` produces a `(min-width:...px)`
 * query and useIsShortViewport a `(max-height:...px)` one, which this parses back out. Copied from
 * useBreakpoint.test.tsx. */
function mockViewportWidth(width: number, height = 900) {
  window.matchMedia = ((query: string) => {
    const minWidth = /min-width:\s*(\d+(?:\.\d+)?)px/.exec(query);
    const maxHeight = /max-height:\s*(\d+(?:\.\d+)?)px/.exec(query);
    return {
      matches: (!minWidth || width >= Number(minWidth[1])) && (!maxHeight || height <= Number(maxHeight[1])),
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

const TABLET = 1100;
const MOBILE = 500;

const branchId = 'b1' as BranchId;

// Deliberately far from any real "today" the sandbox clock could show, so tests that don't
// specifically control system time (most of them) can never accidentally collide with the real
// current week and confound the "Heute" button's disabled state.
const SELECTED_WEEK: CalendarWeek = { year: 2020, week: 3 };

function isoFor(day: Parameters<typeof dateForWeekday>[1]): string {
  return toISODate(dateForWeekday(SELECTED_WEEK, day));
}

const MONTAG = isoFor('Montag');
const DIENSTAG = isoFor('Dienstag');
const MITTWOCH = isoFor('Mittwoch');
const DONNERSTAG = isoFor('Donnerstag');
const FREITAG = isoFor('Freitag');

const branch: Branch = {
  id: branchId,
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
    branchId,
    lastName: 'Müller',
    firstName: 'Anna',
    jobTitle: 'Verkäuferin',
    employmentType: { type: 'FullTime', weeklyHours: 40 },
    vacationEntitlementPerYear: 28,
    holidayVacationHours: 6.25,
    active: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

// FullTime 40h and PartTime 20h - deliberately different contract hours so the KPI's Soll figure
// is a real sum (60), not two identical numbers that could pass by accident.
const employeeA: Employee = makeEmployee({
  id: 'e1' as EmployeeId,
  lastName: 'Müller',
  firstName: 'Anna',
  employmentType: { type: 'FullTime', weeklyHours: 40 },
});
const employeeB: Employee = makeEmployee({
  id: 'e2' as EmployeeId,
  lastName: 'Schulz',
  firstName: 'Bernd',
  employmentType: { type: 'PartTime', weeklyHours: 20 },
});
// Employed only from Donnerstag onward this week - Montag/Dienstag/Mittwoch are locked cells
// inside an otherwise editable row (scheduleRows.isCellLocked).
const employeeLocked: Employee = makeEmployee({
  id: 'e3' as EmployeeId,
  lastName: 'Klein',
  firstName: 'Carla',
  entryDate: DONNERSTAG,
});

function makeTemplate(id: string, name: string, shift = createShift(clockTime('06:00'), clockTime('14:00'))): ShiftTemplate {
  return {
    id: id as ShiftTemplateId,
    branchId,
    name,
    kind: 'Shift',
    shifts: [shift],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

function makeOtherTemplate(id: string, name: string, label: string, hoursPerDay?: number): ShiftTemplate {
  return {
    id: id as ShiftTemplateId,
    branchId,
    name,
    kind: 'Other',
    label,
    hoursPerDay,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

const templateA = makeTemplate('t1', 'Frühschicht', createShift(clockTime('06:00'), clockTime('14:00')));
const templateOther = makeOtherTemplate('t2', 'Inventur', 'Inventur', 4);

// ThemeProvider wraps the real app theme - ScheduleView/ScheduleToolbar/ScheduleTable's styles now
// read the custom theme.palette.accentSurface key, absent on MUI's own default theme.
function scheduleTree() {
  return (
    <ThemeProvider theme={theme}>
      <MemoryRouter initialEntries={['/schedule']}>
        <Routes>
          <Route
            path="/schedule"
            element={
              <>
                <ScheduleView />
                <AppNotifications />
              </>
            }
          />
          <Route path="/de/print/:scheduleId" element={<div>print-route-landed</div>} />
        </Routes>
      </MemoryRouter>
    </ThemeProvider>
  );
}

function renderScheduleView(width: number = TABLET, height = 900) {
  mockViewportWidth(width, height);
  return render(scheduleTree());
}

/** ScheduleTable stamps every cell with `data-employeeid`/`data-day` directly on the interactive
 * Box - the same technique the document-level contextmenu handler relies on. */
function cellEl(container: HTMLElement, employeeId: string, day: string): HTMLElement {
  const el = container.querySelector(`[data-employeeid="${employeeId}"][data-day="${day}"]`);
  if (!el) {
    throw new Error(`cell not found for ${employeeId}/${day}`);
  }
  return el as HTMLElement;
}

/** Stubs `document.elementsFromPoint` to return exactly the given stack, then fires a real
 * `contextmenu` MouseEvent directly on `document` - matching ScheduleView's own document-level
 * listener (see views/schedule/CLAUDE.md's "Copy/Paste/Frei" section). */
function openContextMenuVia(stack: Element[]) {
  document.elementsFromPoint = vi.fn(() => stack) as unknown as typeof document.elementsFromPoint;
  fireEvent.contextMenu(document, { clientX: 100, clientY: 100 });
}

function openContextMenu(cell: HTMLElement) {
  openContextMenuVia([cell]);
}

function menuItem(name: string): HTMLElement {
  return screen.getByRole('menuitem', { name });
}

function expectMenuItemDisabled(name: string) {
  // MUI's MenuItem is an <li role="menuitem">, which has no native `disabled` attribute (jest-dom's
  // toBeDisabled only understands form-associated elements) - aria-disabled is the real signal.
  expect(menuItem(name)).toHaveAttribute('aria-disabled', 'true');
}

function expectMenuItemEnabled(name: string) {
  expect(menuItem(name).getAttribute('aria-disabled')).not.toBe('true');
}

beforeEach(() => {
  vi.clearAllMocks();
  useNotificationStore.getState().clear();
  useBranchesStore.setState({ branches: [branch], loading: false, loaded: true });
  useBranchSelectionStore.setState({ selectedBranchId: branch.id });
  useCalendarWeekStore.setState({ selectedWeek: SELECTED_WEEK });

  branchAll.mockResolvedValue([branch]);
  employeeForBranch.mockResolvedValue([employeeA, employeeB]);
  scheduleGetOrCreate.mockImplementation(async (bId, cw) => createWeeklySchedule(bId, cw, [employeeA.id, employeeB.id]));
  scheduleSave.mockImplementation(async (s) => s);
  scheduleSetDayEntryAndSave.mockImplementation(async (s, employeeId, day, entry) => withDayEntry(s, employeeId, day, entry));
  scheduleSetDayEntriesAndSave.mockImplementation(async (s, writes) => withDayEntries(s, writes));
  scheduleFindForWeek.mockResolvedValue(null);
  scheduleApplyTargetAdjustments.mockImplementation(async (s, adjustments) =>
    adjustments.reduce((acc, { employeeId, minutes }) => withTargetAdjustment(acc, employeeId, minutes), s),
  );
  scheduleOverwriteWithPreviousWeek.mockImplementation(async (s) => s);
  scheduleForBranch.mockResolvedValue([]);
  absenceForBranch.mockResolvedValue([]);
  absenceCreate.mockImplementation(async (input) => createAbsence(input));
  absenceDelete.mockResolvedValue(undefined);
  absenceRestore.mockResolvedValue(undefined);
  shiftTemplateForBranch.mockResolvedValue([]);
  shiftTemplateDelete.mockResolvedValue(undefined);
  restPeriodCheckWeek.mockResolvedValue([]);
});

afterEach(() => {
  vi.useRealTimers();
  // @ts-expect-error -- undo the per-test stub, jsdom has no matchMedia of its own to restore
  delete window.matchMedia;
  // @ts-expect-error -- undo the per-test stub, jsdom has no elementsFromPoint of its own to restore
  delete document.elementsFromPoint;
});

describe('ScheduleView', () => {
  describe('loading and empty states', () => {
    it('shows an info alert and nothing else when no branch is selected', async () => {
      useBranchesStore.setState({ branches: [], loading: false, loaded: true });
      useBranchSelectionStore.setState({ selectedBranchId: null });

      renderScheduleView();
      // Every hook (useEmployeeList, useAbsences, ...) still runs even though branch is null and
      // the component returns early - flushes their trivial empty-default resolutions so they
      // don't land as an unwrapped update after this test's assertions.
      await act(async () => {});

      expect(screen.getByText('Lege zuerst eine Filiale an.')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Filiale anlegen' })).toHaveAttribute('href', '/de/branches');
      expect(screen.queryByRole('table')).not.toBeInTheDocument();
      expect(scheduleGetOrCreate).not.toHaveBeenCalled();
    });

    it('zeigt eine h1-Überschrift mit dem Seitentitel', async () => {
      renderScheduleView();
      await act(async () => {});

      expect(screen.getByRole('heading', { level: 1, name: 'Wochenplanung' })).toBeInTheDocument();
    });

    it('shows one loading overlay covering the whole multi-hook fetch window, then hides it once everything has resolved', async () => {
      let resolveSchedule!: (s: WeeklySchedule) => void;
      let resolveEmployees!: (e: Employee[]) => void;
      scheduleGetOrCreate.mockReturnValueOnce(
        new Promise<WeeklySchedule>((res) => {
          resolveSchedule = res;
        }),
      );
      employeeForBranch.mockReturnValueOnce(
        new Promise<Employee[]>((res) => {
          resolveEmployees = res;
        }),
      );

      renderScheduleView();

      expect(screen.getByRole('progressbar')).toBeInTheDocument();

      resolveEmployees([employeeA, employeeB]);
      resolveSchedule(createWeeklySchedule(branchId, SELECTED_WEEK, [employeeA.id, employeeB.id]));

      await waitFor(() => expect(screen.queryByRole('progressbar')).not.toBeInTheDocument());
      expect(await screen.findByText(fullName(employeeA))).toBeInTheDocument();
    });

    it('shows an alert when the branch has no employees', async () => {
      employeeForBranch.mockResolvedValueOnce([]);
      scheduleGetOrCreate.mockResolvedValueOnce(createWeeklySchedule(branchId, SELECTED_WEEK, []));

      renderScheduleView();

      expect(
        await screen.findByText('Für diese Filiale sind noch keine Mitarbeiter angelegt. Lege zuerst Mitarbeiter unter „Mitarbeiter“ an.'),
      ).toBeInTheDocument();
      expect(screen.queryByRole('table')).not.toBeInTheDocument();
    });

    it('shows "Kein Mitarbeiter gefunden." when a search term matches nobody, even though rows exist', async () => {
      renderScheduleView();
      await screen.findByText(fullName(employeeA));

      await userEvent.setup().type(screen.getByLabelText('Mitarbeiter suchen'), 'zzz-nobody');

      expect(await screen.findByText('Kein Mitarbeiter gefunden.')).toBeInTheDocument();
      expect(screen.queryByText(fullName(employeeA))).not.toBeInTheDocument();
    });
  });

  describe('KPI totals', () => {
    function buildKpiSchedule(): WeeklySchedule {
      let schedule = createWeeklySchedule(branchId, SELECTED_WEEK, [employeeA.id, employeeB.id]);
      // 8h for employeeA, 4h for employeeB - both have at least one shift, so neither counts as
      // "noch nicht eingeplant".
      schedule = withDayEntry(schedule, employeeA.id, 'Montag', {
        type: 'Shift',
        shifts: [createShift(clockTime('06:00'), clockTime('14:00'))],
      });
      schedule = withDayEntry(schedule, employeeB.id, 'Dienstag', {
        type: 'Shift',
        shifts: [createShift(clockTime('09:00'), clockTime('13:00'))],
      });
      return schedule;
    }

    const expectedIst = minutesToDecimalHours(480 + 240).toLocaleString('de-DE');
    const expectedSoll = formatHoursRangeGerman(60 * 60, 60 * 60);
    const expectedIstSoll = `${expectedIst} / ${expectedSoll}`;

    // The chip is a "Nicht eingeplant" title with the count as a separate value underneath (not a
    // sentence), so it needs its own subtree scoped via `within` rather than a `container.textContent`
    // substring check - a bare count like "0"/"1" would otherwise also match unrelated numbers
    // elsewhere on the page (e.g. "20 Soll").
    function notYetScheduledChip(): HTMLElement {
      return screen.getByText('Nicht eingeplant').closest('div') as HTMLElement;
    }

    it('shows the correct Ist/Soll and noch-nicht-eingeplant totals', async () => {
      scheduleGetOrCreate.mockResolvedValueOnce(buildKpiSchedule());

      const { container } = renderScheduleView();
      await screen.findByText(fullName(employeeA));

      expect(container.textContent).toContain(expectedIstSoll);
      expect(within(notYetScheduledChip()).getByText('0')).toBeInTheDocument();
    });

    it('includes a carried-over targetAdjustmentMinutes in the Soll figure, matching the table column below it (H2)', async () => {
      // employeeA was behind by 3h last week - carried into this week's target the same way
      // ScheduleTable.tsx's own "Soll" column already does via effectiveTargetMinutesRange.
      const schedule = withTargetAdjustment(buildKpiSchedule(), employeeA.id, 180);
      scheduleGetOrCreate.mockResolvedValueOnce(schedule);

      const { container } = renderScheduleView();
      await screen.findByText(fullName(employeeA));

      const expectedSollWithAdjustment = formatHoursRangeGerman(60 * 60 + 180, 60 * 60 + 180);
      expect(container.textContent).toContain(`${expectedIst} / ${expectedSollWithAdjustment}`);
    });

    it('keeps KPI totals summing every row, unaffected by a search term that filters one row out', async () => {
      scheduleGetOrCreate.mockResolvedValueOnce(buildKpiSchedule());

      const { container } = renderScheduleView();
      await screen.findByText(fullName(employeeA));
      expect(container.textContent).toContain(expectedIstSoll);
      expect(within(notYetScheduledChip()).getByText('0')).toBeInTheDocument();

      // Filters employeeB (Schulz) out of the visible rows...
      await userEvent.setup().type(screen.getByLabelText('Mitarbeiter suchen'), 'Müller');
      await waitFor(() => expect(screen.queryByText(fullName(employeeB))).not.toBeInTheDocument());
      expect(screen.getByText(fullName(employeeA))).toBeInTheDocument();

      // ...but the KPI header must still sum both rows, not just the visible one.
      expect(container.textContent).toContain(expectedIstSoll);
      expect(within(notYetScheduledChip()).getByText('0')).toBeInTheDocument();
    });

    it('keeps "noch nicht eingeplant" counting every row (computed from `rows`), not just the search-filtered visible ones', async () => {
      let schedule = createWeeklySchedule(branchId, SELECTED_WEEK, [employeeA.id, employeeB.id]);
      // employeeA is scheduled; employeeB gets no shift on any day, so exactly one row still
      // counts as "noch nicht eingeplant".
      schedule = withDayEntry(schedule, employeeA.id, 'Montag', {
        type: 'Shift',
        shifts: [createShift(clockTime('06:00'), clockTime('14:00'))],
      });
      scheduleGetOrCreate.mockResolvedValueOnce(schedule);

      renderScheduleView();
      await screen.findByText(fullName(employeeA));

      expect(within(notYetScheduledChip()).getByText('1')).toBeInTheDocument();

      // Filters employeeB (the unplanned one) out of the visible rows entirely.
      await userEvent.setup().type(screen.getByLabelText('Mitarbeiter suchen'), 'Müller');
      await waitFor(() => expect(screen.queryByText(fullName(employeeB))).not.toBeInTheDocument());

      // A `visibleRows`-based bug would now show 0 here - it must stay 1.
      expect(within(notYetScheduledChip()).getByText('1')).toBeInTheDocument();
    });

    it('sums totalWorkedMinutes over EVERY row (including an inactive employee who still carries entries), while totalTarget only sums editable rows', async () => {
      const inactiveEmployee: Employee = makeEmployee({
        id: 'e4' as EmployeeId,
        lastName: 'Alt',
        firstName: 'Werner',
        employmentType: { type: 'FullTime', weeklyHours: 40 },
        active: false,
      });

      let schedule = createWeeklySchedule(branchId, SELECTED_WEEK, [employeeA.id, inactiveEmployee.id]);
      schedule = withDayEntry(schedule, employeeA.id, 'Montag', {
        type: 'Shift',
        shifts: [createShift(clockTime('06:00'), clockTime('14:00'))], // 8h = 480min
      });
      // Left behind from before this employee was deactivated - scheduleRows still shows (and
      // keeps) this row, read-only, because it still carries an entry.
      schedule = withDayEntry(schedule, inactiveEmployee.id, 'Montag', {
        type: 'Shift',
        shifts: [createShift(clockTime('09:00'), clockTime('13:00'))], // 4h = 240min
      });
      scheduleGetOrCreate.mockResolvedValueOnce(schedule);
      employeeForBranch.mockResolvedValueOnce([employeeA, inactiveEmployee]);

      const { container } = renderScheduleView();
      await screen.findByText(fullName(employeeA));
      expect(await screen.findByText('Inaktiv')).toBeInTheDocument();

      // Ist includes the inactive employee's 4h; Soll only counts employeeA's 40h contract target.
      const expectedIst = minutesToDecimalHours(480 + 240).toLocaleString('de-DE');
      const expectedSoll = formatHoursRangeGerman(40 * 60, 40 * 60);
      expect(container.textContent).toContain(`${expectedIst} / ${expectedSoll}`);
    });
  });

  describe('search', () => {
    it('narrows visible rows case-insensitively by full name, and clearing the term restores them', async () => {
      renderScheduleView();
      await screen.findByText(fullName(employeeA));
      expect(screen.getByText(fullName(employeeB))).toBeInTheDocument();

      const user = userEvent.setup();
      const search = screen.getByLabelText('Mitarbeiter suchen');
      await user.type(search, 'MÜLLER');

      expect(screen.getByText(fullName(employeeA))).toBeInTheDocument();
      expect(screen.queryByText(fullName(employeeB))).not.toBeInTheDocument();

      await user.clear(search);

      expect(screen.getByText(fullName(employeeA))).toBeInTheDocument();
      expect(screen.getByText(fullName(employeeB))).toBeInTheDocument();
    });
  });

  describe('combined header row (Suche, Umsatz, Stunden)', () => {
    it('puts the search field in the same row as the revenue/hours fields on tablet/desktop', async () => {
      renderScheduleView(TABLET);
      await screen.findByText(fullName(employeeA));

      const headerRow = screen.getByTestId('schedule-header-row');
      expect(within(headerRow).getByLabelText('Mitarbeiter suchen')).toBeInTheDocument();
      expect(within(headerRow).getByLabelText('Geplanter Wochenumsatz')).toBeInTheDocument();
      expect(within(headerRow).getByLabelText('Geplante Wochenstunden')).toBeInTheDocument();
    });

    it('does not render the combined header row on mobile', async () => {
      renderScheduleView(MOBILE);
      await screen.findByText(fullName(employeeA));

      expect(screen.queryByTestId('schedule-header-row')).not.toBeInTheDocument();
    });

    it('gives the search field a floating label instead of only a placeholder', async () => {
      renderScheduleView();
      await screen.findByText(fullName(employeeA));

      const search = screen.getByLabelText('Mitarbeiter suchen');
      expect(search).not.toHaveAttribute('placeholder');
    });
  });

  // Package 5 (Teil 5): on a phone the header used to take 61% of the height, leaving the table 291
  // of 740px. Everything here keeps the header to two short rows.
  describe('compact mobile header', () => {
    const searchBox = () => screen.queryByRole('textbox', { name: 'Mitarbeiter suchen' });

    it('keeps the h1 for screen readers but hides it visually on mobile only', async () => {
      renderScheduleView(MOBILE);
      await screen.findByText(fullName(employeeA));

      const h1 = screen.getByRole('heading', { level: 1, name: 'Wochenplanung' });
      expect(getComputedStyle(h1).position).toBe('absolute');
      expect(getComputedStyle(h1).width).toBe('1px');
    });

    it('keeps the visible h1 on tablet/desktop', async () => {
      renderScheduleView(TABLET);
      await screen.findByText(fullName(employeeA));

      expect(getComputedStyle(screen.getByRole('heading', { level: 1, name: 'Wochenplanung' })).position).not.toBe('absolute');
    });

    it('puts the week label, Heute and Rückgängig into one non-wrapping row on mobile', async () => {
      renderScheduleView(MOBILE);
      await screen.findByText(fullName(employeeA));

      const row = screen.getByTestId('schedule-nav-row');
      expect(getComputedStyle(row).flexWrap).toBe('nowrap');
      expect(within(row).getByRole('button', { name: /andere Woche auswählen/ })).toBeInTheDocument();
      expect(within(row).getByRole('button', { name: 'Heute' })).toBeInTheDocument();
      expect(within(row).getByRole('button', { name: 'Rückgängig' })).toBeInTheDocument();
    });

    it('shortens the week label on mobile to the week number and the days without year', async () => {
      renderScheduleView(MOBILE);
      await screen.findByText(fullName(employeeA));

      const label = screen.getByRole('button', { name: /andere Woche auswählen/ });
      expect(label).toHaveTextContent(`KW ${SELECTED_WEEK.week}`);
      expect(label).not.toHaveTextContent(String(SELECTED_WEEK.year));
      // The accessible name still carries the full range.
      expect(label).toHaveAccessibleName(expect.stringContaining(formatCalendarWeekRange(SELECTED_WEEK)));
    });

    it('collapses the search field behind a magnifier button on mobile', async () => {
      renderScheduleView(MOBILE);
      await screen.findByText(fullName(employeeA));

      expect(searchBox()).not.toBeInTheDocument();

      await userEvent.setup().click(screen.getByRole('button', { name: 'Mitarbeiter suchen' }));

      expect(searchBox()).toBeInTheDocument();
      expect(searchBox()).toHaveFocus();
    });

    it('keeps the mobile search open while it holds a term, and closes an empty one on blur', async () => {
      renderScheduleView(MOBILE);
      await screen.findByText(fullName(employeeA));
      const user = userEvent.setup();

      await user.click(screen.getByRole('button', { name: 'Mitarbeiter suchen' }));
      await user.type(searchBox()!, 'Mül');
      await user.click(document.body);
      expect(searchBox()).toHaveValue('Mül');

      await user.clear(searchBox()!);
      await user.click(document.body);
      expect(searchBox()).not.toBeInTheDocument();
    });
  });

  // Package 6 (Teil 5): at 780x360 the fixed chrome alone takes half the height and the bounded
  // table got 6px. Sideways, AppShell lets the document scroll instead (see AppShell.test); the
  // one thing this view must add is keeping its action bar reachable.
  describe('phone held sideways', () => {
    const bar = () => screen.getByRole('region', { name: 'Weitere Aktionen' });

    it('keeps "Weitere Aktionen" docked above the tab bar while the page scrolls', async () => {
      renderScheduleView(780, 360);
      await screen.findByText(fullName(employeeA));

      expect(getComputedStyle(bar().parentElement!).position).toBe('sticky');
    });

    it('leaves the bar in normal flow on an upright phone, where the table scrolls instead', async () => {
      renderScheduleView(MOBILE, 844);
      await screen.findByText(fullName(employeeA));

      expect(getComputedStyle(bar().parentElement!).position).not.toBe('sticky');
    });
  });

  describe('context menu', () => {
    function buildContextMenuSchedule(): WeeklySchedule {
      let schedule = createWeeklySchedule(branchId, SELECTED_WEEK, [employeeA.id, employeeB.id, employeeLocked.id]);
      schedule = withDayEntry(schedule, employeeA.id, 'Montag', {
        type: 'Shift',
        shifts: [createShift(clockTime('06:00'), clockTime('14:00'))],
      });
      return schedule;
    }

    const singleDayAbsence: Absence = createAbsence({ employeeId: employeeA.id, type: 'Vacation', from: MITTWOCH, to: MITTWOCH });
    const multiDayAbsence: Absence = createAbsence({ employeeId: employeeA.id, type: 'Vacation', from: DONNERSTAG, to: FREITAG });

    async function renderWithFixtures() {
      scheduleGetOrCreate.mockResolvedValueOnce(buildContextMenuSchedule());
      employeeForBranch.mockResolvedValueOnce([employeeA, employeeB, employeeLocked]);
      absenceForBranch.mockResolvedValueOnce([singleDayAbsence, multiDayAbsence]);
      const result = renderScheduleView();
      await screen.findByText(fullName(employeeA));
      return result;
    }

    it('opens the menu on a writable cell with a real shift: Kopieren and Frei enabled, "Als Vorlage speichern" enabled, Einfügen disabled with no clipboard tool yet', async () => {
      const { container } = await renderWithFixtures();

      openContextMenu(cellEl(container, employeeA.id, 'Montag'));

      expect(screen.getByRole('menu')).toBeInTheDocument();
      expectMenuItemEnabled('Kopieren');
      expectMenuItemDisabled('Einfügen');
      expectMenuItemEnabled('Frei');
      expectMenuItemEnabled('Als Vorlage speichern');
    });

    it('walks past a non-matching topmost element in the elementsFromPoint stack to find the real cell underneath (the whole reason elementsFromPoint was chosen over e.target)', async () => {
      const { container } = await renderWithFixtures();
      // Simulates MUI's full-viewport Menu backdrop (or any other unrelated topmost element) sitting
      // above the real cell in the stack - detached, no data-employeeid ancestor, so .closest()
      // returns null for it and the handler must walk on to the next stack entry.
      const decoy = document.createElement('div');

      openContextMenuVia([decoy, cellEl(container, employeeA.id, 'Montag')]);

      expect(screen.getByRole('menu')).toBeInTheDocument();
      expectMenuItemEnabled('Als Vorlage speichern');
    });

    it('right-clicking a DIFFERENT cell while the menu is already open reopens it reflecting the new cell, without requiring it to be closed first', async () => {
      const { container } = await renderWithFixtures();

      openContextMenu(cellEl(container, employeeA.id, 'Montag'));
      expect(screen.getByRole('menu')).toBeInTheDocument();
      expectMenuItemEnabled('Als Vorlage speichern');
      expectMenuItemEnabled('Frei');

      // Still open - no menu-item click, no explicit close - right-click a second, differently
      // stated cell (plain Off, no shift): this is the exact scenario the document-level listener
      // exists to fix (see views/schedule/CLAUDE.md).
      openContextMenu(cellEl(container, employeeB.id, 'Dienstag'));

      expect(screen.getByRole('menu')).toBeInTheDocument();
      expectMenuItemDisabled('Als Vorlage speichern');
      expectMenuItemDisabled('Frei');
    });

    it('arms Einfügen via Kopieren, and on an already-off cell with no absence Frei stays disabled while Einfügen becomes enabled', async () => {
      const { container } = await renderWithFixtures();
      const user = userEvent.setup();

      openContextMenu(cellEl(container, employeeA.id, 'Montag'));
      await user.click(menuItem('Kopieren'));
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();

      openContextMenu(cellEl(container, employeeA.id, 'Dienstag'));
      expectMenuItemEnabled('Einfügen');
      expectMenuItemDisabled('Frei');
      expectMenuItemDisabled('Als Vorlage speichern');
    });

    it('on a cell covered by a single-day absence: Frei is enabled and "Als Vorlage speichern" is disabled', async () => {
      const { container } = await renderWithFixtures();

      openContextMenu(cellEl(container, employeeA.id, 'Mittwoch'));

      expectMenuItemEnabled('Frei');
      expectMenuItemDisabled('Als Vorlage speichern');
    });

    it('"Als Vorlage speichern" is disabled by absenceCoversWholeDay even though the entry itself is still type Shift (stale shift data left behind before the absence was added)', async () => {
      let schedule = buildContextMenuSchedule();
      schedule = withDayEntry(schedule, employeeA.id, 'Mittwoch', {
        type: 'Shift',
        shifts: [createShift(clockTime('09:00'), clockTime('13:00'))],
      });
      scheduleGetOrCreate.mockResolvedValueOnce(schedule);
      employeeForBranch.mockResolvedValueOnce([employeeA, employeeB, employeeLocked]);
      // singleDayAbsence is a same-day (from === to), non-half-day Vacation on MITTWOCH, so
      // absenceCoversWholeDay is true here despite entry.type === 'Shift'.
      absenceForBranch.mockResolvedValueOnce([singleDayAbsence]);

      const { container } = renderScheduleView();
      await screen.findByText(fullName(employeeA));

      openContextMenu(cellEl(container, employeeA.id, 'Mittwoch'));

      expectMenuItemDisabled('Als Vorlage speichern');
      // cellWritable stays true for a same-day absence, so Frei is not disabled by this.
      expectMenuItemEnabled('Frei');
    });

    it('"Als Vorlage speichern" stays disabled for a Shift-type entry whose shifts array is empty', async () => {
      let schedule = buildContextMenuSchedule();
      schedule = withDayEntry(schedule, employeeA.id, 'Freitag', { type: 'Shift', shifts: [] });
      scheduleGetOrCreate.mockResolvedValueOnce(schedule);
      employeeForBranch.mockResolvedValueOnce([employeeA, employeeB, employeeLocked]);
      absenceForBranch.mockResolvedValueOnce([]);

      const { container } = renderScheduleView();
      await screen.findByText(fullName(employeeA));

      openContextMenu(cellEl(container, employeeA.id, 'Freitag'));

      expectMenuItemDisabled('Als Vorlage speichern');
    });

    it('on a cell covered by a multi-day absence: Kopieren stays enabled while Einfügen and Frei stay disabled even with an active clipboard tool', async () => {
      const { container } = await renderWithFixtures();
      const user = userEvent.setup();

      openContextMenu(cellEl(container, employeeA.id, 'Montag'));
      await user.click(menuItem('Kopieren'));

      openContextMenu(cellEl(container, employeeA.id, 'Donnerstag'));
      expectMenuItemEnabled('Kopieren');
      expectMenuItemDisabled('Einfügen');
      expectMenuItemDisabled('Frei');
    });

    it('opens no menu at all when right-clicking a cell locked by the employee\'s employment period', async () => {
      const { container } = await renderWithFixtures();

      openContextMenu(cellEl(container, employeeLocked.id, 'Montag'));

      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });

    it('right-clicking the open menu itself blocks the native menu without closing or reopening the custom one', async () => {
      const { container } = await renderWithFixtures();

      openContextMenu(cellEl(container, employeeA.id, 'Montag'));
      const menuEl = screen.getByRole('menu');

      openContextMenuVia([menuEl]);

      expect(screen.getByRole('menu')).toBeInTheDocument();
      expect(menuItem('Kopieren')).toBeInTheDocument();
    });
  });

  describe('Copy/Paste/Frei end-to-end', () => {
    function buildSchedule(): WeeklySchedule {
      let schedule = createWeeklySchedule(branchId, SELECTED_WEEK, [employeeA.id, employeeB.id]);
      schedule = withDayEntry(schedule, employeeA.id, 'Montag', {
        type: 'Shift',
        shifts: [createShift(clockTime('06:00'), clockTime('14:00'))],
      });
      return schedule;
    }

    it('Kopieren then Einfügen writes the copied shift onto a different cell, with fresh (not shared) ids', async () => {
      const schedule = buildSchedule();
      const sourceShiftId = (schedule.employeeAssignments[0].days.Montag as { type: 'Shift'; shifts: { id: string }[] }).shifts[0].id;
      scheduleGetOrCreate.mockResolvedValueOnce(schedule);

      const { container } = renderScheduleView();
      await screen.findByText(fullName(employeeA));
      const user = userEvent.setup();

      openContextMenu(cellEl(container, employeeA.id, 'Montag'));
      await user.click(menuItem('Kopieren'));

      openContextMenu(cellEl(container, employeeB.id, 'Dienstag'));
      await user.click(menuItem('Einfügen'));

      await waitFor(() => expect(scheduleSetDayEntryAndSave).toHaveBeenCalled());
      const [, empId, day, entry] = scheduleSetDayEntryAndSave.mock.calls.at(-1)!;
      expect(empId).toBe(employeeB.id);
      expect(day).toBe('Dienstag');
      expect(entry.type).toBe('Shift');
      const pastedShift = (entry as { type: 'Shift'; shifts: { id: string; start: string; end: string }[] }).shifts[0];
      expect(pastedShift.start).toBe('06:00');
      expect(pastedShift.end).toBe('14:00');
      expect(pastedShift.id).not.toBe(sourceShiftId);
    });

    it('Frei on a cell with an existing shift writes an Off entry', async () => {
      scheduleGetOrCreate.mockResolvedValueOnce(buildSchedule());

      const { container } = renderScheduleView();
      await screen.findByText(fullName(employeeA));
      const user = userEvent.setup();

      openContextMenu(cellEl(container, employeeA.id, 'Montag'));
      await user.click(menuItem('Frei'));

      await waitFor(() =>
        expect(scheduleSetDayEntryAndSave).toHaveBeenCalledWith(expect.anything(), employeeA.id, 'Montag', { type: 'Off' }),
      );
    });
  });

  describe('absence-clearing on write', () => {
    const singleDayAbsence: Absence = createAbsence({ employeeId: employeeA.id, type: 'Vacation', from: MITTWOCH, to: MITTWOCH });

    it('Frei deletes a same-day absence on that cell before/alongside the schedule save', async () => {
      scheduleGetOrCreate.mockResolvedValueOnce(createWeeklySchedule(branchId, SELECTED_WEEK, [employeeA.id, employeeB.id]));
      absenceForBranch.mockResolvedValueOnce([singleDayAbsence]);

      const { container } = renderScheduleView();
      await screen.findByText(fullName(employeeA));
      const user = userEvent.setup();

      openContextMenu(cellEl(container, employeeA.id, 'Mittwoch'));
      await user.click(menuItem('Frei'));

      await waitFor(() => expect(absenceDelete).toHaveBeenCalledWith(singleDayAbsence.id));
      await waitFor(() =>
        expect(scheduleSetDayEntryAndSave).toHaveBeenCalledWith(expect.anything(), employeeA.id, 'Mittwoch', { type: 'Off' }),
      );
      expect(absenceDelete.mock.invocationCallOrder[0]).toBeLessThan(scheduleSetDayEntryAndSave.mock.invocationCallOrder[0]);
    });

    it('Einfügen also deletes a same-day absence on the target cell before/alongside the schedule save', async () => {
      let schedule = createWeeklySchedule(branchId, SELECTED_WEEK, [employeeA.id, employeeB.id]);
      schedule = withDayEntry(schedule, employeeA.id, 'Montag', {
        type: 'Shift',
        shifts: [createShift(clockTime('06:00'), clockTime('14:00'))],
      });
      scheduleGetOrCreate.mockResolvedValueOnce(schedule);
      absenceForBranch.mockResolvedValueOnce([singleDayAbsence]);

      const { container } = renderScheduleView();
      await screen.findByText(fullName(employeeA));
      const user = userEvent.setup();

      openContextMenu(cellEl(container, employeeA.id, 'Montag'));
      await user.click(menuItem('Kopieren'));

      openContextMenu(cellEl(container, employeeA.id, 'Mittwoch'));
      await user.click(menuItem('Einfügen'));

      await waitFor(() => expect(absenceDelete).toHaveBeenCalledWith(singleDayAbsence.id));
      await waitFor(() => expect(scheduleSetDayEntryAndSave).toHaveBeenCalled());
      const lastCall = scheduleSetDayEntryAndSave.mock.calls.at(-1)!;
      expect(lastCall[1]).toBe(employeeA.id);
      expect(lastCall[2]).toBe('Mittwoch');
      expect(lastCall[3].type).toBe('Shift');
      expect(absenceDelete.mock.invocationCallOrder[0]).toBeLessThan(
        scheduleSetDayEntryAndSave.mock.invocationCallOrder[scheduleSetDayEntryAndSave.mock.invocationCallOrder.length - 1],
      );
    });
  });

  describe('undo/redo integration', () => {
    function buildSchedule(): WeeklySchedule {
      let schedule = createWeeklySchedule(branchId, SELECTED_WEEK, [employeeA.id, employeeB.id]);
      schedule = withDayEntry(schedule, employeeA.id, 'Montag', {
        type: 'Shift',
        shifts: [createShift(clockTime('06:00'), clockTime('14:00'))],
      });
      return schedule;
    }

    it('enables Rückgängig after a successful edit; clicking it calls schedule.save with the pre-edit schedule and the table reflects the old state', async () => {
      scheduleGetOrCreate.mockResolvedValueOnce(buildSchedule());

      const { container } = renderScheduleView();
      await screen.findByText(fullName(employeeA));
      const user = userEvent.setup();

      const undoButton = screen.getByRole('button', { name: 'Rückgängig' });
      expect(undoButton).toBeDisabled();

      openContextMenu(cellEl(container, employeeA.id, 'Montag'));
      await user.click(menuItem('Frei'));

      await waitFor(() => expect(undoButton).toBeEnabled());
      await waitFor(() => expect(cellEl(container, employeeA.id, 'Montag')).toHaveTextContent('frei'));

      await user.click(undoButton);

      await waitFor(() => expect(scheduleSave).toHaveBeenCalledTimes(1));
      const savedSchedule = scheduleSave.mock.calls[0][0];
      expect(savedSchedule.employeeAssignments.find((a) => a.employeeId === employeeA.id)?.days.Montag).toEqual({
        type: 'Shift',
        shifts: expect.arrayContaining([expect.objectContaining({ start: '06:00', end: '14:00' })]),
      });

      await waitFor(() => expect(cellEl(container, employeeA.id, 'Montag')).toHaveTextContent('06:00-14:00'));
      expect(undoButton).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Wiederholen' })).toBeEnabled();
    });

    it('Strg+Z on document performs the same undo as clicking the Rückgängig button', async () => {
      scheduleGetOrCreate.mockResolvedValueOnce(buildSchedule());

      const { container } = renderScheduleView();
      await screen.findByText(fullName(employeeA));
      const user = userEvent.setup();

      openContextMenu(cellEl(container, employeeA.id, 'Montag'));
      await user.click(menuItem('Frei'));
      await waitFor(() => expect(screen.getByRole('button', { name: 'Rückgängig' })).toBeEnabled());

      act(() => {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }));
      });

      await waitFor(() => expect(scheduleSave).toHaveBeenCalledTimes(1));
      // Lets the rest of applyStep's async chain (reloadAbsences) settle before the test ends.
      await waitFor(() => expect(screen.getByRole('button', { name: 'Wiederholen' })).toBeEnabled());
    });

    it('disables the undo shortcut while the context menu is open, and re-enables it once the menu closes', async () => {
      scheduleGetOrCreate.mockResolvedValueOnce(buildSchedule());

      const { container } = renderScheduleView();
      await screen.findByText(fullName(employeeA));
      const user = userEvent.setup();

      openContextMenu(cellEl(container, employeeA.id, 'Montag'));
      await user.click(menuItem('Frei'));
      await waitFor(() => expect(screen.getByRole('button', { name: 'Rückgängig' })).toBeEnabled());

      openContextMenu(cellEl(container, employeeB.id, 'Dienstag'));
      act(() => {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }));
      });
      expect(scheduleSave).not.toHaveBeenCalled();

      // Closes the menu (also arms the clipboard, which is irrelevant to this assertion).
      await user.click(menuItem('Kopieren'));
      await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());

      act(() => {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }));
      });
      await waitFor(() => expect(scheduleSave).toHaveBeenCalledTimes(1));
      // Lets the rest of applyStep's async chain (reloadAbsences) settle before the test ends.
      await waitFor(() => expect(screen.getByRole('button', { name: 'Wiederholen' })).toBeEnabled());
    });

    it('disables the undo shortcut while DayEditor is open (editorState), and re-enables it once it closes', async () => {
      scheduleGetOrCreate.mockResolvedValueOnce(buildSchedule());

      const { container } = renderScheduleView();
      await screen.findByText(fullName(employeeA));
      const user = userEvent.setup();

      openContextMenu(cellEl(container, employeeA.id, 'Montag'));
      await user.click(menuItem('Frei'));
      await waitFor(() => expect(screen.getByRole('button', { name: 'Rückgängig' })).toBeEnabled());

      await user.click(cellEl(container, employeeB.id, 'Dienstag'));
      await screen.findByText(`${employeeB.firstName} ${employeeB.lastName} · Dienstag`);

      act(() => {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }));
      });
      expect(scheduleSave).not.toHaveBeenCalled();

      await user.click(screen.getByRole('button', { name: 'Abbrechen' }));
      await waitFor(() =>
        expect(screen.queryByText(`${employeeB.firstName} ${employeeB.lastName} · Dienstag`)).not.toBeInTheDocument(),
      );

      act(() => {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }));
      });
      await waitFor(() => expect(scheduleSave).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(screen.getByRole('button', { name: 'Wiederholen' })).toBeEnabled());
    });

    it('disables the undo shortcut while WeekSelectionDialog is open, and re-enables it once it closes', async () => {
      scheduleGetOrCreate.mockResolvedValueOnce(buildSchedule());

      const { container } = renderScheduleView();
      await screen.findByText(fullName(employeeA));
      const user = userEvent.setup();

      openContextMenu(cellEl(container, employeeA.id, 'Montag'));
      await user.click(menuItem('Frei'));
      await waitFor(() => expect(screen.getByRole('button', { name: 'Rückgängig' })).toBeEnabled());

      await user.click(screen.getByText(formatCalendarWeekRange(SELECTED_WEEK)));
      await screen.findByRole('button', { name: 'Schließen' });

      act(() => {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }));
      });
      expect(scheduleSave).not.toHaveBeenCalled();

      await user.click(screen.getByRole('button', { name: 'Schließen' }));
      await waitFor(() => expect(screen.queryByRole('button', { name: 'Schließen' })).not.toBeInTheDocument());

      act(() => {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }));
      });
      await waitFor(() => expect(scheduleSave).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(screen.getByRole('button', { name: 'Wiederholen' })).toBeEnabled());
    });

    it('disables the undo shortcut while CarryOverPreviousWeekDialog is open, and re-enables it once it closes', async () => {
      scheduleGetOrCreate.mockResolvedValueOnce(buildSchedule());

      const { container } = renderScheduleView();
      await screen.findByText(fullName(employeeA));
      const user = userEvent.setup();

      openContextMenu(cellEl(container, employeeA.id, 'Montag'));
      await user.click(menuItem('Frei'));
      await waitFor(() => expect(screen.getByRole('button', { name: 'Rückgängig' })).toBeEnabled());

      await user.click(screen.getByRole('button', { name: 'Vorwoche übertragen' }));
      await screen.findByText('Mehr-/Minusstunden aus Vorwoche übertragen');

      act(() => {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }));
      });
      expect(scheduleSave).not.toHaveBeenCalled();

      await user.click(screen.getByRole('button', { name: 'Abbrechen' }));
      await waitFor(() =>
        expect(screen.queryByText('Mehr-/Minusstunden aus Vorwoche übertragen')).not.toBeInTheDocument(),
      );

      act(() => {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }));
      });
      await waitFor(() => expect(scheduleSave).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(screen.getByRole('button', { name: 'Wiederholen' })).toBeEnabled());
    });

    it('disables the undo shortcut while the shift-template dialog is open, and re-enables it once it closes', async () => {
      scheduleGetOrCreate.mockResolvedValueOnce(buildSchedule());

      const { container } = renderScheduleView();
      await screen.findByText(fullName(employeeA));
      const user = userEvent.setup();

      openContextMenu(cellEl(container, employeeA.id, 'Montag'));
      await user.click(menuItem('Frei'));
      await waitFor(() => expect(screen.getByRole('button', { name: 'Rückgängig' })).toBeEnabled());

      await user.click(screen.getByRole('button', { name: 'Vorlage' }));
      await screen.findByText('Neue Vorlage');

      act(() => {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }));
      });
      // A synchronous check right after dispatch would pass even if the guard were missing - undo's
      // own applyStep call is chained through a microtask queue, so it needs a real turn of the
      // event loop before a leaked call would show up here.
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(scheduleSave).not.toHaveBeenCalled();

      await user.click(screen.getByRole('button', { name: 'Abbrechen' }));
      await waitFor(() => expect(screen.queryByText('Neue Vorlage')).not.toBeInTheDocument());

      act(() => {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }));
      });
      await waitFor(() => expect(scheduleSave).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(screen.getByRole('button', { name: 'Wiederholen' })).toBeEnabled());
    });

    it('disables the undo shortcut while the template-delete confirm dialog is open, and re-enables it once it closes', async () => {
      scheduleGetOrCreate.mockResolvedValueOnce(buildSchedule());
      shiftTemplateForBranch.mockResolvedValueOnce([templateA]);

      const { container } = renderScheduleView();
      await screen.findByText(fullName(employeeA));
      const user = userEvent.setup();

      openContextMenu(cellEl(container, employeeA.id, 'Montag'));
      await user.click(menuItem('Frei'));
      await waitFor(() => expect(screen.getByRole('button', { name: 'Rückgängig' })).toBeEnabled());

      await user.click(screen.getByRole('button', { name: 'Frühschicht bearbeiten oder löschen' }));
      await user.click(screen.getByRole('menuitem', { name: 'Löschen' }));
      await screen.findByText('Vorlage löschen?');

      act(() => {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }));
      });
      // See the sibling shift-template-dialog test above for why this needs a real event-loop turn
      // before the "not called" check is meaningful.
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(scheduleSave).not.toHaveBeenCalled();

      await user.click(screen.getByRole('button', { name: 'Abbrechen' }));
      await waitFor(() => expect(screen.queryByText('Vorlage löschen?')).not.toBeInTheDocument());

      act(() => {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }));
      });
      await waitFor(() => expect(scheduleSave).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(screen.getByRole('button', { name: 'Wiederholen' })).toBeEnabled());
    });

    it('Wiederholen replays the redo direction: after an undo, redoing brings the cell back to the edited state', async () => {
      scheduleGetOrCreate.mockResolvedValueOnce(buildSchedule());

      const { container } = renderScheduleView();
      await screen.findByText(fullName(employeeA));
      const user = userEvent.setup();

      openContextMenu(cellEl(container, employeeA.id, 'Montag'));
      await user.click(menuItem('Frei'));
      await waitFor(() => expect(cellEl(container, employeeA.id, 'Montag')).toHaveTextContent('frei'));

      const undoButton = screen.getByRole('button', { name: 'Rückgängig' });
      await user.click(undoButton);
      await waitFor(() => expect(cellEl(container, employeeA.id, 'Montag')).toHaveTextContent('06:00-14:00'));

      const redoButton = screen.getByRole('button', { name: 'Wiederholen' });
      expect(redoButton).toBeEnabled();
      await user.click(redoButton);

      await waitFor(() => expect(cellEl(container, employeeA.id, 'Montag')).toHaveTextContent('frei'));
      expect(redoButton).toBeDisabled();
      expect(undoButton).toBeEnabled();
    });
  });

  describe('stale write guard on week switch', () => {
    it('does not let a slow save started against the OLD week overwrite the table after switching to a new week', async () => {
      let schedule = createWeeklySchedule(branchId, SELECTED_WEEK, [employeeA.id, employeeB.id]);
      schedule = withDayEntry(schedule, employeeA.id, 'Montag', {
        type: 'Shift',
        shifts: [createShift(clockTime('06:00'), clockTime('14:00'))],
      });
      scheduleGetOrCreate.mockResolvedValueOnce(schedule);

      const nextWeek = nextCalendarWeek(SELECTED_WEEK);
      let nextWeekSchedule = createWeeklySchedule(branchId, nextWeek, [employeeA.id, employeeB.id]);
      nextWeekSchedule = withDayEntry(nextWeekSchedule, employeeA.id, 'Montag', {
        type: 'Shift',
        shifts: [createShift(clockTime('09:00'), clockTime('13:00'))],
      });
      scheduleGetOrCreate.mockResolvedValueOnce(nextWeekSchedule);

      let resolveSave!: (s: WeeklySchedule) => void;
      scheduleSetDayEntryAndSave.mockReturnValueOnce(
        new Promise<WeeklySchedule>((res) => {
          resolveSave = res;
        }),
      );

      const { container } = renderScheduleView();
      await screen.findByText(fullName(employeeA));
      const user = userEvent.setup();

      openContextMenu(cellEl(container, employeeA.id, 'Montag'));
      await user.click(menuItem('Frei'));
      await waitFor(() => expect(scheduleSetDayEntryAndSave).toHaveBeenCalledTimes(1));

      // Switches away from the week the pending save above belongs to.
      await user.click(screen.getByRole('button', { name: 'Nächste Woche' }));
      await waitFor(() => expect(cellEl(container, employeeA.id, 'Montag')).toHaveTextContent('09:00-13:00'));

      // The OLD week's save now finally resolves, well after the switch. The write queue's own
      // busy/stack bookkeeping still updates state at this point regardless of the guard below, so
      // this needs act() even though the guard itself should prevent any visible table change.
      await act(async () => {
        resolveSave(withDayEntry(schedule, employeeA.id, 'Montag', { type: 'Off' }));
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      // Must still show the NEW week's data - the late write must not have overwritten it.
      expect(cellEl(container, employeeA.id, 'Montag')).toHaveTextContent('09:00-13:00');
    });
  });

  describe('saveAbsence (DayEditor -> onAbsenceSave)', () => {
    it('Urlaub: DayEditor Speichern creates a Vacation absence, reloads absences, makes undo available, and undo deletes the just-created absence', async () => {
      const { container } = renderScheduleView();
      await screen.findByText(fullName(employeeA));
      const user = userEvent.setup();

      await user.click(cellEl(container, employeeA.id, 'Montag'));
      await screen.findByText(`${employeeA.firstName} ${employeeA.lastName} · Montag`);

      await user.click(screen.getByRole('button', { name: 'Urlaub' }));
      await user.click(screen.getByRole('button', { name: 'Speichern' }));

      await waitFor(() =>
        expect(absenceCreate).toHaveBeenCalledWith({
          employeeId: employeeA.id,
          type: 'Vacation',
          from: MONTAG,
          to: MONTAG,
          creditedMinutesOverride: undefined,
        }),
      );
      // Reloaded once beyond the initial mount fetch.
      await waitFor(() => expect(absenceForBranch).toHaveBeenCalledTimes(2));
      await waitFor(() => expect(screen.getByRole('button', { name: 'Rückgängig' })).toBeEnabled());

      const createdAbsence = await absenceCreate.mock.results[0].value;

      await user.click(screen.getByRole('button', { name: 'Rückgängig' }));

      await waitFor(() => expect(absenceDelete).toHaveBeenCalledWith(createdAbsence.id));
    });

    it('Sonstige: DayEditor Speichern with a typed Bezeichnung creates an Other absence carrying that label', async () => {
      const { container } = renderScheduleView();
      await screen.findByText(fullName(employeeA));
      const user = userEvent.setup();

      await user.click(cellEl(container, employeeA.id, 'Dienstag'));
      await screen.findByText(`${employeeA.firstName} ${employeeA.lastName} · Dienstag`);

      await user.click(screen.getByRole('button', { name: 'Sonstige' }));
      await user.type(screen.getByRole('textbox', { name: 'Bezeichnung' }), 'Fortbildung');
      await user.click(screen.getByRole('button', { name: 'Speichern' }));

      await waitFor(() =>
        expect(absenceCreate).toHaveBeenCalledWith({
          employeeId: employeeA.id,
          type: 'Other',
          from: DIENSTAG,
          to: DIENSTAG,
          label: 'Fortbildung',
          hoursPerDay: undefined,
        }),
      );
    });
  });

  describe('scheduleReplaced via CarryOverPreviousWeekDialog (record())', () => {
    it('Übernehmen folds an already-saved schedule into both the rendered table AND the undo stack via record()', async () => {
      scheduleGetOrCreate.mockResolvedValueOnce(createWeeklySchedule(branchId, SELECTED_WEEK, [employeeA.id, employeeB.id]));
      const previousWeek = previousCalendarWeek(SELECTED_WEEK);
      let previousSchedule = createWeeklySchedule(branchId, previousWeek, [employeeA.id, employeeB.id]);
      previousSchedule = withDayEntry(previousSchedule, employeeA.id, 'Montag', {
        type: 'Shift',
        shifts: [createShift(clockTime('06:00'), clockTime('10:00'))],
      });
      scheduleFindForWeek.mockResolvedValueOnce(previousSchedule);

      const { container } = renderScheduleView();
      await screen.findByText(fullName(employeeA));
      const user = userEvent.setup();

      const undoButton = screen.getByRole('button', { name: 'Rückgängig' });
      expect(undoButton).toBeDisabled();

      await user.click(screen.getByRole('button', { name: 'Vorwoche übertragen' }));
      await screen.findByText('Mehr-/Minusstunden aus Vorwoche übertragen');
      await waitFor(() => expect(screen.getByRole('button', { name: 'Übernehmen' })).toBeEnabled());

      await user.click(screen.getByRole('button', { name: 'Übernehmen' }));

      await waitFor(() => expect(scheduleApplyTargetAdjustments).toHaveBeenCalledTimes(1));
      await waitFor(() =>
        expect(screen.queryByText('Mehr-/Minusstunden aus Vorwoche übertragen')).not.toBeInTheDocument(),
      );
      await waitFor(() => expect(undoButton).toBeEnabled());

      const [, appliedAdjustments] = scheduleApplyTargetAdjustments.mock.calls[0];
      const employeeAAdjustment = (
        appliedAdjustments as { employeeId: EmployeeId; minutes: number }[]
      ).find((a) => a.employeeId === employeeA.id)!.minutes;
      expect(employeeAAdjustment).not.toBe(0);

      const expectedRange = effectiveTargetMinutesRange(employeeA, { targetAdjustmentMinutes: employeeAAdjustment });
      const expectedRangeText = formatHoursRangeGerman(expectedRange.min, expectedRange.max);
      expect(container.textContent).toContain(expectedRangeText);

      await user.click(undoButton);

      await waitFor(() => expect(scheduleSave).toHaveBeenCalledTimes(1));
      const savedSchedule = scheduleSave.mock.calls[0][0] as WeeklySchedule;
      const savedAssignment = savedSchedule.employeeAssignments.find((a) => a.employeeId === employeeA.id);
      expect(savedAssignment?.targetAdjustmentMinutes ?? 0).toBe(0);
    });
  });

  describe('tap-to-assign', () => {
    it('clicking a toolbar tile arms tap-to-assign: a subsequent cell click applies the tool instead of opening DayEditor', async () => {
      shiftTemplateForBranch.mockResolvedValueOnce([templateA]);
      scheduleGetOrCreate.mockResolvedValueOnce(createWeeklySchedule(branchId, SELECTED_WEEK, [employeeA.id, employeeB.id]));

      const { container } = renderScheduleView(TABLET);
      await screen.findByText(fullName(employeeA));
      const user = userEvent.setup();

      await user.click(screen.getByText('Frühschicht').closest('button') as HTMLButtonElement);
      expect(screen.getByText('Frühschicht zuweisen')).toBeInTheDocument();

      await user.click(cellEl(container, employeeB.id, 'Montag'));

      await waitFor(() =>
        expect(scheduleSetDayEntryAndSave).toHaveBeenCalledWith(
          expect.anything(),
          employeeB.id,
          'Montag',
          expect.objectContaining({
            type: 'Shift',
            shifts: [expect.objectContaining({ start: '06:00', end: '14:00' })],
          }),
        ),
      );
      expect(screen.queryByText(`${employeeB.firstName} ${employeeB.lastName} · Montag`)).not.toBeInTheDocument();
    });

    it('tapping a cell with an armed Other-kind template applies it', async () => {
      shiftTemplateForBranch.mockResolvedValueOnce([templateOther]);
      scheduleGetOrCreate.mockResolvedValueOnce(createWeeklySchedule(branchId, SELECTED_WEEK, [employeeA.id, employeeB.id]));

      const { container } = renderScheduleView(TABLET);
      await screen.findByText(fullName(employeeA));
      const user = userEvent.setup();

      await user.click(screen.getByText('Inventur').closest('button') as HTMLButtonElement);
      expect(screen.getByText('Inventur zuweisen')).toBeInTheDocument();

      await user.click(cellEl(container, employeeB.id, 'Montag'));

      await waitFor(() =>
        expect(absenceCreate).toHaveBeenCalledWith(
          expect.objectContaining({ employeeId: employeeB.id, type: 'Other', label: 'Inventur', hoursPerDay: 4 }),
        ),
      );
      expect(scheduleSetDayEntryAndSave).not.toHaveBeenCalled();
    });

    it('highlights a cell whose entry already matches the armed tool, and not a non-matching cell, with the assign-target style', async () => {
      const matchingShift = createShift(clockTime('06:00'), clockTime('14:00'));
      let schedule = createWeeklySchedule(branchId, SELECTED_WEEK, [employeeA.id, employeeB.id]);
      schedule = withDayEntry(schedule, employeeA.id, 'Montag', { type: 'Shift', shifts: [matchingShift] });
      scheduleGetOrCreate.mockResolvedValueOnce(schedule);
      shiftTemplateForBranch.mockResolvedValueOnce([templateA]);

      const { container } = renderScheduleView(TABLET);
      await screen.findByText(fullName(employeeA));
      const user = userEvent.setup();

      await user.click(screen.getByText('Frühschicht').closest('button') as HTMLButtonElement);

      expect(cellEl(container, employeeA.id, 'Montag')).toHaveStyle({
        backgroundColor: theme.palette.accentSurface.strong,
        border: `1px solid ${theme.palette.primary.main}`,
      });
      expect(cellEl(container, employeeB.id, 'Montag')).not.toHaveStyle({
        backgroundColor: theme.palette.accentSurface.strong,
      });
    });

    it('drops out of tap-to-assign when the branch changes while a tool is still armed', async () => {
      const branch2: Branch = { ...branch, id: 'b2' as BranchId, name: 'Filiale Süd' };
      useBranchesStore.setState({ branches: [branch, branch2], loading: false, loaded: true });
      shiftTemplateForBranch.mockResolvedValueOnce([templateA]);

      renderScheduleView(TABLET);
      await screen.findByText(fullName(employeeA));
      const user = userEvent.setup();

      await user.click(screen.getByText('Frühschicht').closest('button') as HTMLButtonElement);
      expect(screen.getByText('Frühschicht zuweisen')).toBeInTheDocument();

      act(() => {
        useBranchSelectionStore.setState({ selectedBranchId: branch2.id });
      });

      await waitFor(() => expect(screen.queryByText('Frühschicht zuweisen')).not.toBeInTheDocument());
    });

    it('keeps the active tool and assign-mode banner across a week navigation - deliberately not reset by selectedWeek', async () => {
      shiftTemplateForBranch.mockResolvedValueOnce([templateA]);

      renderScheduleView(TABLET);
      await screen.findByText(fullName(employeeA));
      const user = userEvent.setup();

      await user.click(screen.getByText('Frühschicht').closest('button') as HTMLButtonElement);
      expect(screen.getByText('Frühschicht zuweisen')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Nächste Woche' }));
      await waitFor(() =>
        expect(screen.getByText(formatCalendarWeekRange(nextCalendarWeek(SELECTED_WEEK)))).toBeInTheDocument(),
      );

      expect(screen.getByText('Frühschicht zuweisen')).toBeInTheDocument();
    });

    it('tapping a cell that already matches the active tool\'s entry writes {type: "Off"} instead of reapplying it', async () => {
      const matchingShift = createShift(clockTime('06:00'), clockTime('14:00'));
      let schedule = createWeeklySchedule(branchId, SELECTED_WEEK, [employeeA.id, employeeB.id]);
      schedule = withDayEntry(schedule, employeeA.id, 'Montag', { type: 'Shift', shifts: [matchingShift] });
      scheduleGetOrCreate.mockResolvedValueOnce(schedule);
      shiftTemplateForBranch.mockResolvedValueOnce([templateA]);

      const { container } = renderScheduleView(TABLET);
      await screen.findByText(fullName(employeeA));
      const user = userEvent.setup();

      await user.click(screen.getByText('Frühschicht').closest('button') as HTMLButtonElement);
      await user.click(cellEl(container, employeeA.id, 'Montag'));

      await waitFor(() =>
        expect(scheduleSetDayEntryAndSave).toHaveBeenCalledWith(expect.anything(), employeeA.id, 'Montag', { type: 'Off' }),
      );
    });
  });

  describe('bulk selection (Mehrfachauswahl)', () => {
    it('selecting cells across employees/days and applying a template updates all of them via one setDayEntriesAndSave call, undone in one Strg+Z step', async () => {
      shiftTemplateForBranch.mockResolvedValueOnce([templateA]);
      scheduleGetOrCreate.mockResolvedValueOnce(createWeeklySchedule(branchId, SELECTED_WEEK, [employeeA.id, employeeB.id]));

      const { container } = renderScheduleView(TABLET);
      await screen.findByText(fullName(employeeA));
      const user = userEvent.setup();

      await user.click(screen.getByRole('button', { name: 'Mehrfachauswahl' }));
      await user.click(cellEl(container, employeeA.id, 'Montag'));
      await user.click(cellEl(container, employeeA.id, 'Dienstag'));
      await user.click(cellEl(container, employeeB.id, 'Montag'));
      expect(screen.getByText('3 Zellen ausgewählt')).toBeInTheDocument();

      await user.click(screen.getByText('Frühschicht').closest('button') as HTMLButtonElement);

      const shiftEntry = expect.objectContaining({
        type: 'Shift',
        shifts: [expect.objectContaining({ start: '06:00', end: '14:00' })],
      });
      await waitFor(() =>
        expect(scheduleSetDayEntriesAndSave).toHaveBeenCalledWith(expect.anything(), [
          { employeeId: employeeA.id, day: 'Montag', entry: shiftEntry },
          { employeeId: employeeA.id, day: 'Dienstag', entry: shiftEntry },
          { employeeId: employeeB.id, day: 'Montag', entry: shiftEntry },
        ]),
      );
      expect(screen.getByText('3 von 3 aktualisiert.')).toBeInTheDocument();
      // Applying ends selection mode - the banner/toggle-pressed state is gone again.
      expect(screen.queryByText(/Zellen ausgewählt/)).not.toBeInTheDocument();

      await screen.findByRole('button', { name: 'Rückgängig' });
      act(() => {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }));
      });
      await waitFor(() => expect(scheduleSave).toHaveBeenCalledTimes(1));
    });

    it('skips a selected cell whose Other-template write would conflict with an existing absence, applies the rest, and names the count', async () => {
      scheduleGetOrCreate.mockResolvedValueOnce(createWeeklySchedule(branchId, SELECTED_WEEK, [employeeA.id, employeeB.id]));
      shiftTemplateForBranch.mockResolvedValueOnce([templateOther]);
      const existingVacation = createAbsence({ employeeId: employeeA.id, type: 'Vacation', from: MONTAG, to: MONTAG });
      absenceForBranch.mockResolvedValue([existingVacation]);

      const { container } = renderScheduleView(TABLET);
      await screen.findByText(fullName(employeeA));
      const user = userEvent.setup();

      await user.click(screen.getByRole('button', { name: 'Mehrfachauswahl' }));
      await user.click(cellEl(container, employeeA.id, 'Montag'));
      await user.click(cellEl(container, employeeB.id, 'Montag'));

      await user.click(screen.getByText('Inventur').closest('button') as HTMLButtonElement);

      await waitFor(() =>
        expect(absenceCreate).toHaveBeenCalledWith(
          expect.objectContaining({ employeeId: employeeB.id, type: 'Other', label: 'Inventur' }),
        ),
      );
      expect(absenceCreate).not.toHaveBeenCalledWith(expect.objectContaining({ employeeId: employeeA.id }));
      expect(screen.getByText('1 von 2 aktualisiert, 1 übersprungen (gesperrt/nicht anwendbar).')).toBeInTheDocument();
    });

    it('"Frei" on a mixed selection (a Shift cell and a single-day-absence cell) clears both in one step', async () => {
      let schedule = createWeeklySchedule(branchId, SELECTED_WEEK, [employeeA.id, employeeB.id]);
      schedule = withDayEntry(schedule, employeeA.id, 'Montag', {
        type: 'Shift',
        shifts: [createShift(clockTime('06:00'), clockTime('14:00'))],
      });
      scheduleGetOrCreate.mockResolvedValueOnce(schedule);
      const otherAbsence = createAbsence({ employeeId: employeeB.id, type: 'Other', from: MONTAG, to: MONTAG, label: 'Fortbildung' });
      absenceForBranch.mockResolvedValue([otherAbsence]);

      const { container } = renderScheduleView(TABLET);
      await screen.findByText(fullName(employeeA));
      const user = userEvent.setup();

      await user.click(screen.getByRole('button', { name: 'Mehrfachauswahl' }));
      await user.click(cellEl(container, employeeA.id, 'Montag'));
      await user.click(cellEl(container, employeeB.id, 'Montag'));

      await user.click(screen.getByText('Frei').closest('button') as HTMLButtonElement);

      await waitFor(() =>
        expect(scheduleSetDayEntriesAndSave).toHaveBeenCalledWith(expect.anything(), [
          { employeeId: employeeA.id, day: 'Montag', entry: { type: 'Off' } },
          { employeeId: employeeB.id, day: 'Montag', entry: { type: 'Off' } },
        ]),
      );
      expect(absenceDelete).toHaveBeenCalledWith(otherAbsence.id);
      expect(screen.getByText('2 von 2 aktualisiert.')).toBeInTheDocument();
    });

    it('clicking the toggle again while active exits selection mode and clears the picks - re-entering starts empty', async () => {
      scheduleGetOrCreate.mockResolvedValueOnce(createWeeklySchedule(branchId, SELECTED_WEEK, [employeeA.id, employeeB.id]));

      const { container } = renderScheduleView(TABLET);
      await screen.findByText(fullName(employeeA));
      const user = userEvent.setup();

      await user.click(screen.getByRole('button', { name: 'Mehrfachauswahl' }));
      await user.click(cellEl(container, employeeA.id, 'Montag'));
      expect(screen.getByText('1 Zellen ausgewählt')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Mehrfachauswahl' }));
      expect(screen.queryByText(/Zellen ausgewählt/)).not.toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Mehrfachauswahl' }));
      expect(screen.getByText('0 Zellen ausgewählt')).toBeInTheDocument();
    });

    it('entering selection mode cancels an in-progress tap-to-assign', async () => {
      shiftTemplateForBranch.mockResolvedValueOnce([templateA]);

      renderScheduleView(TABLET);
      await screen.findByText(fullName(employeeA));
      const user = userEvent.setup();

      await user.click(screen.getByText('Frühschicht').closest('button') as HTMLButtonElement);
      expect(screen.getByText('Frühschicht zuweisen')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Mehrfachauswahl' }));

      expect(screen.queryByText('Frühschicht zuweisen')).not.toBeInTheDocument();
      expect(screen.getByText('0 Zellen ausgewählt')).toBeInTheDocument();
    });
  });

  describe('week navigation', () => {
    it('Vorherige/Nächste Woche update the displayed week range and trigger a fresh schedule.getOrCreate call', async () => {
      renderScheduleView();
      await screen.findByText(fullName(employeeA));
      expect(scheduleGetOrCreate).toHaveBeenCalledTimes(1);
      expect(screen.getByText(formatCalendarWeekRange(SELECTED_WEEK))).toBeInTheDocument();

      const user = userEvent.setup();
      const nextWeek = nextCalendarWeek(SELECTED_WEEK);
      await user.click(screen.getByRole('button', { name: 'Nächste Woche' }));

      await waitFor(() => expect(screen.getByText(formatCalendarWeekRange(nextWeek))).toBeInTheDocument());
      expect(scheduleGetOrCreate).toHaveBeenCalledTimes(2);
      expect(scheduleGetOrCreate).toHaveBeenLastCalledWith(branch.id, nextWeek);

      const prevWeek = previousCalendarWeek(nextWeek);
      await user.click(screen.getByRole('button', { name: 'Vorherige Woche' }));

      await waitFor(() => expect(screen.getByText(formatCalendarWeekRange(prevWeek))).toBeInTheDocument());
      expect(scheduleGetOrCreate).toHaveBeenCalledTimes(3);
      expect(scheduleGetOrCreate).toHaveBeenLastCalledWith(branch.id, prevWeek);
    });

    it('"Heute" is enabled and jumps to the real current week when it differs from the selected one', async () => {
      const fixedToday = new Date(2026, 8, 11);
      vi.setSystemTime(fixedToday);
      const todayWeek = calendarWeekFromDate(fixedToday);

      renderScheduleView();
      await screen.findByText(fullName(employeeA));

      const heuteButton = screen.getByRole('button', { name: 'Heute' });
      expect(heuteButton).toBeEnabled();

      await userEvent.setup().click(heuteButton);

      await waitFor(() => expect(useCalendarWeekStore.getState().selectedWeek).toEqual(todayWeek));
      expect(screen.getByText(formatCalendarWeekRange(todayWeek))).toBeInTheDocument();
    });

    it('"Heute" is disabled while already viewing the real current week', async () => {
      const fixedToday = new Date(2026, 8, 11);
      vi.setSystemTime(fixedToday);
      const todayWeek = calendarWeekFromDate(fixedToday);
      useCalendarWeekStore.setState({ selectedWeek: todayWeek });

      renderScheduleView();
      await screen.findByText(fullName(employeeA));

      expect(screen.getByRole('button', { name: 'Heute' })).toBeDisabled();
    });
  });

  describe('dialog wiring', () => {
    it('opens DayEditor on a writable cell, titled "Firstname Lastname" (not fullName\'s "Lastname, Firstname")', async () => {
      const { container } = renderScheduleView();
      await screen.findByText(fullName(employeeA));

      await userEvent.setup().click(cellEl(container, employeeA.id, 'Montag'));

      expect(await screen.findByText(`${employeeA.firstName} ${employeeA.lastName} · Montag`)).toBeInTheDocument();
    });

    it('opens WeekSelectionDialog when the week-range text is clicked', async () => {
      renderScheduleView();
      await screen.findByText(fullName(employeeA));

      await userEvent.setup().click(screen.getByText(formatCalendarWeekRange(SELECTED_WEEK)));

      expect(await screen.findByRole('button', { name: 'Schließen' })).toBeInTheDocument();
    });

    it('opens WeekSelectionDialog via the keyboard, focusing the week-range text and pressing Enter (H5)', async () => {
      renderScheduleView();
      await screen.findByText(fullName(employeeA));

      const weekRange = screen.getByText(formatCalendarWeekRange(SELECTED_WEEK));
      act(() => weekRange.focus());
      await userEvent.setup().keyboard('{Enter}');

      expect(await screen.findByRole('button', { name: 'Schließen' })).toBeInTheDocument();
    });

    it('selecting a different week inside WeekSelectionDialog closes it, updates the displayed week and triggers a fresh schedule load', async () => {
      renderScheduleView();
      await screen.findByText(fullName(employeeA));
      expect(scheduleGetOrCreate).toHaveBeenCalledTimes(1);
      const user = userEvent.setup();

      await user.click(screen.getByText(formatCalendarWeekRange(SELECTED_WEEK)));
      await screen.findByRole('button', { name: 'Schließen' });

      // Any week in the same displayed month other than the currently selected one - computed the
      // same way the dialog itself lays out its rows, so this stays correct regardless of which
      // calendar dates SELECTED_WEEK happens to fall on.
      const monday = mondayOfWeek(SELECTED_WEEK);
      const weeksInMonth = calendarWeeksInMonth(monday.getFullYear(), monday.getMonth() + 1);
      const targetWeek = weeksInMonth.find((w) => !calendarWeeksEqual(w, SELECTED_WEEK))!;

      await user.click(screen.getByText(formatCalendarWeekRange(targetWeek)));

      await waitFor(() => expect(screen.queryByRole('button', { name: 'Schließen' })).not.toBeInTheDocument());
      expect(screen.getByText(formatCalendarWeekRange(targetWeek))).toBeInTheDocument();
      expect(scheduleGetOrCreate).toHaveBeenLastCalledWith(branch.id, targetWeek);
    });

    it('"Vorwoche übertragen" opens CarryOverPreviousWeekDialog when a schedule exists', async () => {
      renderScheduleView();
      await screen.findByText(fullName(employeeA));

      await userEvent.setup().click(screen.getByRole('button', { name: 'Vorwoche übertragen' }));

      expect(await screen.findByText('Mehr-/Minusstunden aus Vorwoche übertragen')).toBeInTheDocument();
    });

    it('"Vorwoche übertragen" does not render CarryOverPreviousWeekDialog while no schedule has loaded yet', async () => {
      scheduleGetOrCreate.mockReturnValueOnce(new Promise<WeeklySchedule>(() => {}));

      renderScheduleView();
      await userEvent.setup().click(screen.getByRole('button', { name: 'Vorwoche übertragen' }));

      expect(screen.queryByText('Mehr-/Minusstunden aus Vorwoche übertragen')).not.toBeInTheDocument();
    });

    it('"Vorwoche kopieren" asks for confirmation, then applies the result and shows a success message (H7)', async () => {
      renderScheduleView();
      await screen.findByText(fullName(employeeA));
      const user = userEvent.setup();

      await user.click(screen.getByRole('button', { name: 'Vorwoche kopieren' }));
      const dialog = await screen.findByRole('dialog', { name: 'Vorwoche komplett übernehmen?' });
      expect(scheduleOverwriteWithPreviousWeek).not.toHaveBeenCalled();

      const copiedShift = withDayEntry(
        createWeeklySchedule(branchId, SELECTED_WEEK, [employeeA.id, employeeB.id]),
        employeeA.id,
        'Montag',
        { type: 'Shift', shifts: [createShift(clockTime('08:00'), clockTime('16:00'))] },
      );
      scheduleOverwriteWithPreviousWeek.mockResolvedValue(copiedShift);

      await user.click(within(dialog).getByRole('button', { name: 'Übernehmen' }));

      await waitFor(() => expect(scheduleOverwriteWithPreviousWeek).toHaveBeenCalledTimes(1));
      expect(await screen.findByText('Schichten der Vorwoche wurden übernommen.')).toBeInTheDocument();
      expect(screen.getByText('08:00-16:00')).toBeInTheDocument();
      await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Vorwoche komplett übernehmen?' })).not.toBeInTheDocument());
    });

    it('"Vorwoche kopieren" reports an info message instead of a success one when there is nothing to copy', async () => {
      renderScheduleView();
      await screen.findByText(fullName(employeeA));
      const user = userEvent.setup();

      await user.click(screen.getByRole('button', { name: 'Vorwoche kopieren' }));
      const dialog = await screen.findByRole('dialog', { name: 'Vorwoche komplett übernehmen?' });
      // Default mock: overwriteWithPreviousWeek resolves with the SAME schedule reference it was
      // given, exactly like the real service does when it finds no previous week to copy from.
      await user.click(within(dialog).getByRole('button', { name: 'Übernehmen' }));

      expect(await screen.findByText('Für die Vorwoche wurde kein Dienstplan gefunden.')).toBeInTheDocument();
    });

    it('"Drucken" navigates to /print/:scheduleId and only renders when a schedule exists', async () => {
      renderScheduleView();
      await screen.findByText(fullName(employeeA));

      await userEvent.setup().click(screen.getByRole('button', { name: 'Drucken' }));

      await waitFor(() => expect(screen.getByText('print-route-landed')).toBeInTheDocument());
    });

    it('does not render "Drucken" while no schedule has loaded yet', async () => {
      scheduleGetOrCreate.mockReturnValueOnce(new Promise<WeeklySchedule>(() => {}));

      renderScheduleView();
      await waitFor(() => expect(screen.getByRole('button', { name: 'Vorwoche übertragen' })).toBeInTheDocument());

      expect(screen.queryByRole('button', { name: 'Drucken' })).not.toBeInTheDocument();
    });

    it('opens ShiftTemplateDialog blank via the toolbar\'s "Vorlage" button', async () => {
      renderScheduleView();
      await screen.findByText(fullName(employeeA));

      await userEvent.setup().click(screen.getByRole('button', { name: 'Vorlage' }));

      expect(await screen.findByText('Neue Vorlage')).toBeInTheDocument();
    });

    it('opens ShiftTemplateDialog prefilled with the existing template via the tile\'s edit menu', async () => {
      shiftTemplateForBranch.mockResolvedValueOnce([templateA]);

      renderScheduleView();
      await screen.findByText(fullName(employeeA));
      const user = userEvent.setup();

      await user.click(screen.getByRole('button', { name: 'Frühschicht bearbeiten oder löschen' }));
      await user.click(screen.getByRole('menuitem', { name: 'Bearbeiten' }));

      expect(await screen.findByText('Vorlage bearbeiten')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Frühschicht')).toBeInTheDocument();
      expect(screen.getByDisplayValue('06:00')).toBeInTheDocument();
    });

    it('"Als Vorlage speichern" opens ShiftTemplateDialog prefilled with drafts derived from the cell\'s current shift, not a blank template', async () => {
      const shift = createShift(clockTime('09:00'), clockTime('13:00'));
      let schedule = createWeeklySchedule(branchId, SELECTED_WEEK, [employeeA.id, employeeB.id]);
      schedule = withDayEntry(schedule, employeeA.id, 'Montag', { type: 'Shift', shifts: [shift] });
      scheduleGetOrCreate.mockResolvedValueOnce(schedule);

      const { container } = renderScheduleView();
      await screen.findByText(fullName(employeeA));

      openContextMenu(cellEl(container, employeeA.id, 'Montag'));
      await userEvent.setup().click(menuItem('Als Vorlage speichern'));

      expect(await screen.findByText('Neue Vorlage')).toBeInTheDocument();
      expect(screen.getByDisplayValue('09:00')).toBeInTheDocument();
      expect(screen.getByDisplayValue('13:00')).toBeInTheDocument();
    });

    it('deleting a template that is the active assign tool calls shiftTemplate.delete and exits assign mode (finishAssigning)', async () => {
      shiftTemplateForBranch.mockResolvedValueOnce([templateA]);

      renderScheduleView(TABLET);
      await screen.findByText(fullName(employeeA));
      const user = userEvent.setup();

      await user.click(screen.getByText('Frühschicht').closest('button') as HTMLButtonElement);
      expect(screen.getByText('Frühschicht zuweisen')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Frühschicht bearbeiten oder löschen' }));
      await user.click(screen.getByRole('menuitem', { name: 'Löschen' }));

      const confirmButton = await screen.findByRole('button', { name: 'Löschen' });
      await user.click(confirmButton);

      await waitFor(() => expect(shiftTemplateDelete).toHaveBeenCalledWith(templateA.id));
      await waitFor(() => expect(screen.queryByText('Frühschicht zuweisen')).not.toBeInTheDocument());
    });

    it('deleting a DIFFERENT template than the active one calls shiftTemplate.delete but leaves the active assign tool and its banner untouched', async () => {
      const templateB = makeTemplate('t2', 'Spätschicht', createShift(clockTime('14:00'), clockTime('22:00')));
      shiftTemplateForBranch.mockResolvedValueOnce([templateA, templateB]);

      renderScheduleView(TABLET);
      await screen.findByText(fullName(employeeA));
      const user = userEvent.setup();

      await user.click(screen.getByText('Frühschicht').closest('button') as HTMLButtonElement);
      expect(screen.getByText('Frühschicht zuweisen')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Spätschicht bearbeiten oder löschen' }));
      await user.click(screen.getByRole('menuitem', { name: 'Löschen' }));

      const confirmButton = await screen.findByRole('button', { name: 'Löschen' });
      await user.click(confirmButton);

      await waitFor(() => expect(shiftTemplateDelete).toHaveBeenCalledWith(templateB.id));
      expect(screen.getByText('Frühschicht zuweisen')).toBeInTheDocument();
    });

    it('shows a busy state on the template-delete confirm dialog while shiftTemplate.delete is in flight', async () => {
      shiftTemplateForBranch.mockResolvedValueOnce([templateA]);
      let resolveDelete!: () => void;
      shiftTemplateDelete.mockReturnValueOnce(
        new Promise<void>((res) => {
          resolveDelete = res;
        }),
      );

      renderScheduleView(TABLET);
      await screen.findByText(fullName(employeeA));
      const user = userEvent.setup();

      await user.click(screen.getByRole('button', { name: 'Frühschicht bearbeiten oder löschen' }));
      await user.click(screen.getByRole('menuitem', { name: 'Löschen' }));

      const confirmButton = await screen.findByRole('button', { name: 'Löschen' });
      await user.click(confirmButton);

      await waitFor(() => expect(confirmButton).toBeDisabled());
      expect(screen.getByRole('button', { name: 'Abbrechen' })).toBeDisabled();

      resolveDelete();
      await waitFor(() => expect(screen.queryByRole('button', { name: 'Abbrechen' })).not.toBeInTheDocument());
    });
  });

  describe('mobile "Weitere Aktionen" sheet wiring', () => {
    it('the sheet\'s "Druckansicht" action navigates to the print route, same as the "Drucken" button', async () => {
      renderScheduleView(MOBILE);
      await screen.findByText(fullName(employeeA));
      const user = userEvent.setup();

      const sheetBar = screen.getByRole('region', { name: 'Weitere Aktionen' });
      await user.click(within(sheetBar).getByRole('button'));
      await user.click(await screen.findByRole('button', { name: 'Druckansicht' }));

      await waitFor(() => expect(screen.getByText('print-route-landed')).toBeInTheDocument());
    });

    it('the sheet\'s "Vorwoche übertragen" action opens CarryOverPreviousWeekDialog, same as the header button', async () => {
      renderScheduleView(MOBILE);
      await screen.findByText(fullName(employeeA));
      const user = userEvent.setup();

      const sheetBar = screen.getByRole('region', { name: 'Weitere Aktionen' });
      await user.click(within(sheetBar).getByRole('button'));
      await user.click(await screen.findByRole('button', { name: 'Vorwoche übertragen' }));

      expect(await screen.findByText('Mehr-/Minusstunden aus Vorwoche übertragen')).toBeInTheDocument();
    });

    it('the sheet\'s "Vorwoche kopieren" action opens the same H7 confirmation as the header button', async () => {
      renderScheduleView(MOBILE);
      await screen.findByText(fullName(employeeA));
      const user = userEvent.setup();

      const sheetBar = screen.getByRole('region', { name: 'Weitere Aktionen' });
      await user.click(within(sheetBar).getByRole('button'));
      await user.click(await screen.findByRole('button', { name: 'Vorwoche kopieren' }));

      expect(await screen.findByRole('dialog', { name: 'Vorwoche komplett übernehmen?' })).toBeInTheDocument();
    });
  });

  describe('responsive layout', () => {
    function buildKpiSchedule(): WeeklySchedule {
      let schedule = createWeeklySchedule(branchId, SELECTED_WEEK, [employeeA.id, employeeB.id]);
      schedule = withDayEntry(schedule, employeeA.id, 'Montag', {
        type: 'Shift',
        shifts: [createShift(clockTime('06:00'), clockTime('14:00'))],
      });
      return schedule;
    }

    const ist = minutesToDecimalHours(480).toLocaleString('de-DE');
    const soll = formatHoursRangeGerman(60 * 60, 60 * 60);

    it('shows Ist / Soll as the same caption + value tile at tablet width as on mobile', async () => {
      scheduleGetOrCreate.mockResolvedValueOnce(buildKpiSchedule());
      const { container } = renderScheduleView(TABLET);
      await screen.findByText(fullName(employeeA));

      // Same caption/value shape as "Nicht eingeplant" next to it, so both tiles are equally tall.
      expect(screen.getByText('Ist / Soll')).toBeInTheDocument();
      expect(screen.getByText(`${ist} / ${soll}`)).toBeInTheDocument();
      expect(container.textContent).not.toContain(`Ist ${ist} von`);
    });

    it('shows the KPI summary as a compact chip strip at mobile width', async () => {
      scheduleGetOrCreate.mockResolvedValueOnce(buildKpiSchedule());
      const { container } = renderScheduleView(MOBILE);
      await screen.findByText(fullName(employeeA));

      expect(container.textContent).toContain('Ist / Soll');
      expect(container.textContent).toContain(`${ist} / ${soll}`);
      expect(container.textContent).not.toContain(`Ist ${ist} von`);
      expect(container.textContent).not.toContain(`Ist ${ist} / ${soll} Soll`);
    });

    it('renders the toolbar before the table in the DOM at tablet width', async () => {
      renderScheduleView(TABLET);
      await screen.findByText(fullName(employeeA));

      const toolbar = screen.getByRole('region', { name: 'Werkzeugleiste' });
      const table = screen.getByRole('table');

      expect(!!(toolbar.compareDocumentPosition(table) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
    });

    it('renders the toolbar after the table in the DOM at mobile width', async () => {
      renderScheduleView(MOBILE);
      await screen.findByText(fullName(employeeA));

      const toolbarBar = screen.getByRole('region', { name: 'Weitere Aktionen' });
      const table = screen.getByRole('table');

      expect(!!(table.compareDocumentPosition(toolbarBar) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
    });

    it('hides "Vorwoche übertragen" and "Drucken" from ScheduleView\'s own header row at mobile width', async () => {
      renderScheduleView(MOBILE);
      await screen.findByText(fullName(employeeA));

      expect(screen.queryByRole('button', { name: 'Vorwoche übertragen' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Drucken' })).not.toBeInTheDocument();
    });
  });
});
