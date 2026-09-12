import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { BranchId, EmployeeId } from '@domain/shared/ids';
import type { CalendarWeek } from '@domain/shared/CalendarWeek';
import {
  calendarWeeksInMonth,
  calendarWeeksEqual,
  dateForWeekday,
  mondayOfWeek,
  formatCalendarWeekRange,
} from '@domain/shared/CalendarWeek';
import { toISODate } from '@domain/shared/DateFormat';
import { clockTime } from '@domain/shared/ClockTime';
import { createShift } from '@domain/schedule/Shift';
import { createWeeklySchedule, withDayEntry } from '@domain/schedule/WeeklySchedule';
import type { WeeklySchedule } from '@domain/schedule/WeeklySchedule';
import { minutesToDecimalHours } from '@domain/schedule/scheduleCalculation';
import { createWeekView } from '@application/schedule/scheduleAssessment';
import type { EmployeeHoursInfo } from '@application/schedule/scheduleAssessment';
import { createAbsence } from '@domain/absence/Absence';
import type { Absence } from '@domain/absence/Absence';
import { services } from '@infrastructure/services';
import { WeekSelectionDialog } from './WeekSelectionDialog';

vi.mock('@infrastructure/services', () => ({
  services: { schedule: { forBranch: vi.fn() } },
}));

const forBranchMock = vi.mocked(services.schedule.forBranch);

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** jsdom has no real layout engine, so `window.matchMedia` is mocked per test to answer as if the
 * viewport were `width` wide - MUI's `theme.breakpoints.up(key)` produces a `(min-width:...px)`
 * query, which this parses back out. Copied from useBreakpoint.test.tsx / ScheduleView.test.tsx. */
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

const LAPTOP = 1700;
const MOBILE = 500;

const branchId = 'b1' as BranchId;
const employee: EmployeeHoursInfo = { id: 'e1' as EmployeeId, holidayVacationHours: 6.25 };

const FIXED_YEAR = 2026;
const FIXED_MONTH = 9;
const weeksInFixedMonth = calendarWeeksInMonth(FIXED_YEAR, FIXED_MONTH);
const [selectedWeek, scheduledWeek, unscheduledWeek] = weeksInFixedMonth;

function rowFor(cw: CalendarWeek): HTMLElement {
  return screen.getByText(formatCalendarWeekRange(cw)).closest('[role="button"]') as HTMLElement;
}

function renderDialog(overrides: Partial<{ selectedWeek: CalendarWeek; absences: Absence[] }> = {}) {
  const onClose = vi.fn();
  const onWeekSelect = vi.fn();
  render(
    <WeekSelectionDialog
      open
      onClose={onClose}
      branchId={branchId}
      absences={[]}
      employeeList={[employee]}
      isHoliday={() => false}
      selectedWeek={selectedWeek}
      onWeekSelect={onWeekSelect}
      {...overrides}
    />,
  );
  return { onClose, onWeekSelect };
}

describe('WeekSelectionDialog', () => {
  beforeEach(() => {
    forBranchMock.mockReset();
    // Every existing test below predates ResponsiveDialog and asserts against the centered-dialog
    // shape (a single "Schließen" button); pinning laptop width keeps that true now that the
    // component depends on useBreakpoint - without a mock, MUI's useMediaQuery silently falls back
    // to "no match" for every query (see useMediaQuery's own supportMatchMedia guard), which reads
    // as mobile/full-screen and would add a second, ambiguous "Schließen" close icon.
    mockViewportWidth(LAPTOP);
  });

  afterEach(() => {
    vi.useRealTimers();
    // @ts-expect-error -- undo the per-test stub, jsdom has no matchMedia of its own to restore
    delete window.matchMedia;
  });

  it('renders as a full-screen sheet at a narrow viewport, and as a centered dialog at laptop width', async () => {
    forBranchMock.mockResolvedValue([]);

    // Two independent mounts, not a rerender of one instance: useBreakpoint's useMediaQuery is
    // backed by useSyncExternalStore, which (like every other breakpoint test in this codebase,
    // see useBreakpoint.test.tsx) is only ever exercised via a fresh mount per width, never a
    // mid-mount viewport change. cleanup() removes the first dialog's own portal content from
    // document.body before the second mounts, since MUI's Dialog portals there rather than into
    // RTL's own container.
    mockViewportWidth(MOBILE);
    renderDialog();
    expect(document.querySelector('.MuiDialog-paperFullScreen')).not.toBeNull();
    await waitFor(() => expect(screen.queryByText('…')).not.toBeInTheDocument());
    cleanup();

    mockViewportWidth(LAPTOP);
    renderDialog();
    expect(document.querySelector('.MuiDialog-paperFullScreen')).toBeNull();
    await waitFor(() => expect(screen.queryByText('…')).not.toBeInTheDocument());
  });

  it('shows "…" as every week\'s hours figure while the schedules are still loading', () => {
    const deferred = createDeferred<WeeklySchedule[]>();
    forBranchMock.mockReturnValue(deferred.promise);

    renderDialog();

    expect(screen.getAllByText('…')).toHaveLength(weeksInFixedMonth.length);
  });

  it('shows the computed total worked hours for a week with a saved schedule, and "kein Plan" for one without', async () => {
    const shift = createShift(clockTime('08:00'), clockTime('16:00'));
    let schedule = createWeeklySchedule(branchId, scheduledWeek, [employee.id]);
    schedule = withDayEntry(schedule, employee.id, 'Montag', { type: 'Shift', shifts: [shift] });
    forBranchMock.mockResolvedValue([schedule]);

    renderDialog();
    await waitFor(() => expect(screen.queryByText('…')).not.toBeInTheDocument());

    const expectedMinutes = createWeekView(schedule, [], { employees: [employee], isHoliday: () => false }).reduce(
      (sum, e) => sum + e.workedMinutes,
      0,
    );
    const expectedText = `${minutesToDecimalHours(expectedMinutes).toLocaleString('de-DE')} Std.`;

    expect(within(rowFor(scheduledWeek)).getByText(expectedText)).toBeInTheDocument();
    expect(within(rowFor(unscheduledWeek)).getByText('kein Plan')).toBeInTheDocument();
  });

  it('sums only workedMinutes into a week\'s total, not creditedMinutes from an absence', async () => {
    const shift = createShift(clockTime('08:00'), clockTime('16:00'));
    let schedule = createWeeklySchedule(branchId, scheduledWeek, [employee.id]);
    schedule = withDayEntry(schedule, employee.id, 'Montag', { type: 'Shift', shifts: [shift] });
    const vacationDate = toISODate(dateForWeekday(scheduledWeek, 'Mittwoch'));
    const absence = createAbsence({
      employeeId: employee.id,
      type: 'Vacation',
      from: vacationDate,
      to: vacationDate,
    });
    forBranchMock.mockResolvedValue([schedule]);

    renderDialog({ absences: [absence] });
    await waitFor(() => expect(screen.queryByText('…')).not.toBeInTheDocument());

    const weekView = createWeekView(schedule, [absence], { employees: [employee], isHoliday: () => false })[0];
    // Guards the fixture itself: if creditedMinutes were 0 here, the assertion below would pass
    // whether or not the component actually excludes it.
    expect(weekView.creditedMinutes).toBeGreaterThan(0);

    const workedOnlyText = `${minutesToDecimalHours(weekView.workedMinutes).toLocaleString('de-DE')} Std.`;
    const includingCreditedText = `${minutesToDecimalHours(weekView.totalNetMinutes).toLocaleString('de-DE')} Std.`;
    expect(workedOnlyText).not.toBe(includingCreditedText);

    expect(within(rowFor(scheduledWeek)).getByText(workedOnlyText)).toBeInTheDocument();
    expect(within(rowFor(scheduledWeek)).queryByText(includingCreditedText)).not.toBeInTheDocument();
  });

  it('falls back to "kein Plan" for every week when the fetch rejects, instead of staying on "…"', async () => {
    forBranchMock.mockRejectedValue(new Error('boom'));

    renderDialog();
    await waitFor(() => expect(screen.getAllByText('kein Plan')).toHaveLength(weeksInFixedMonth.length));

    expect(screen.queryByText('…')).not.toBeInTheDocument();
  });

  it('bolds the selected row via isSelected and shows "Heute" via isToday - independently of each other', async () => {
    // Fixes "today" to a week that is NOT the one passed as selectedWeek below, specifically so
    // the two flags can't coincide: fontWeight must track isSelected only and the chip must track
    // isToday only. Rendering with selectedWeek === today (the previous version of this test) would
    // make both true on the same row and pass even if the component bolded on isToday instead.
    const todayWeek = weeksInFixedMonth[0];
    const chosenWeek = weeksInFixedMonth[2];
    expect(calendarWeeksEqual(todayWeek, chosenWeek)).toBe(false);
    vi.setSystemTime(mondayOfWeek(todayWeek));
    forBranchMock.mockResolvedValue([]);

    renderDialog({ selectedWeek: chosenWeek });
    await waitFor(() => expect(screen.queryByText('…')).not.toBeInTheDocument());

    expect(within(rowFor(todayWeek)).getByText('Heute')).toBeInTheDocument();
    expect(screen.getByText(formatCalendarWeekRange(todayWeek))).toHaveStyle({ fontWeight: '400' });

    expect(within(rowFor(chosenWeek)).queryByText('Heute')).not.toBeInTheDocument();
    expect(screen.getByText(formatCalendarWeekRange(chosenWeek))).toHaveStyle({ fontWeight: '600' });
  });

  it('advances month navigation, wrapping into January of the next year, and updates the listed weeks', async () => {
    forBranchMock.mockResolvedValue([]);
    const user = userEvent.setup();
    renderDialog();
    await waitFor(() => expect(screen.queryByText('…')).not.toBeInTheDocument());

    expect(screen.getByText(formatCalendarWeekRange(weeksInFixedMonth[0]))).toBeInTheDocument();

    const next = screen.getByRole('button', { name: 'Nächster Monat' });
    for (let i = 0; i < 12 - FIXED_MONTH; i++) {
      await user.click(next);
    }
    const decemberWeeks = calendarWeeksInMonth(FIXED_YEAR, 12);
    expect(screen.getByText(`Dezember ${FIXED_YEAR}`)).toBeInTheDocument();
    expect(screen.getByText(formatCalendarWeekRange(decemberWeeks[0]))).toBeInTheDocument();
    expect(screen.queryByText(formatCalendarWeekRange(weeksInFixedMonth[0]))).not.toBeInTheDocument();

    await user.click(next);
    const januaryNextYearWeeks = calendarWeeksInMonth(FIXED_YEAR + 1, 1);
    expect(screen.getByText(`Januar ${FIXED_YEAR + 1}`)).toBeInTheDocument();
    expect(screen.getByText(formatCalendarWeekRange(januaryNextYearWeeks[0]))).toBeInTheDocument();
  });

  it('goes back month navigation, wrapping into December of the previous year, and updates the listed weeks', async () => {
    forBranchMock.mockResolvedValue([]);
    const user = userEvent.setup();
    renderDialog();
    await waitFor(() => expect(screen.queryByText('…')).not.toBeInTheDocument());

    const previous = screen.getByRole('button', { name: 'Vorheriger Monat' });
    for (let i = 0; i < FIXED_MONTH - 1; i++) {
      await user.click(previous);
    }
    const januaryWeeks = calendarWeeksInMonth(FIXED_YEAR, 1);
    expect(screen.getByText(`Januar ${FIXED_YEAR}`)).toBeInTheDocument();
    expect(screen.getByText(formatCalendarWeekRange(januaryWeeks[0]))).toBeInTheDocument();

    await user.click(previous);
    const decemberPrevYearWeeks = calendarWeeksInMonth(FIXED_YEAR - 1, 12);
    expect(screen.getByText(`Dezember ${FIXED_YEAR - 1}`)).toBeInTheDocument();
    expect(screen.getByText(formatCalendarWeekRange(decemberPrevYearWeeks[0]))).toBeInTheDocument();
  });

  it('calls onWeekSelect with the clicked week and onClose together when a row is clicked', async () => {
    forBranchMock.mockResolvedValue([]);
    const user = userEvent.setup();
    const { onClose, onWeekSelect } = renderDialog();
    await waitFor(() => expect(screen.queryByText('…')).not.toBeInTheDocument());

    await user.click(rowFor(unscheduledWeek));

    expect(onWeekSelect).toHaveBeenCalledTimes(1);
    expect(onWeekSelect).toHaveBeenCalledWith(unscheduledWeek);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes without selecting a week when "Schließen" is clicked', async () => {
    forBranchMock.mockResolvedValue([]);
    const user = userEvent.setup();
    const { onClose, onWeekSelect } = renderDialog();
    await waitFor(() => expect(screen.queryByText('…')).not.toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Schließen' }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onWeekSelect).not.toHaveBeenCalled();
  });
});
