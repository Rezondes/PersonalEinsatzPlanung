import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { BranchId, EmployeeId, AbsenceId } from '@domain/shared/ids';
import type { CalendarWeek } from '@domain/shared/CalendarWeek';
import { clockTime } from '@domain/shared/ClockTime';
import { createShift } from '@domain/schedule/Shift';
import { createWeeklySchedule, withDayEntry, withTargetAdjustment } from '@domain/schedule/WeeklySchedule';
import type { WeeklySchedule } from '@domain/schedule/WeeklySchedule';
import type { Employee } from '@domain/employee/Employee';
import type { Absence } from '@domain/absence/Absence';
import { services } from '@infrastructure/services';
import { CarryOverPreviousWeekDialog } from './CarryOverPreviousWeekDialog';

vi.mock('@infrastructure/services', () => ({
  services: { schedule: { findForWeek: vi.fn(), applyTargetAdjustments: vi.fn() } },
}));

const findForWeekMock = vi.mocked(services.schedule.findForWeek);
const applyMock = vi.mocked(services.schedule.applyTargetAdjustments);

const branchId = 'b1' as BranchId;
/** KW 37/2026: Monday 2026-09-07 - Sunday 2026-09-13. */
const currentWeek: CalendarWeek = { year: 2026, week: 37 };
/** KW 36/2026: Monday 2026-08-31 (Dienstag 2026-09-01) - Sunday 2026-09-06. */
const previousWeek: CalendarWeek = { year: 2026, week: 36 };

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function employee(id: EmployeeId, overrides: Partial<Employee> = {}): Employee {
  return {
    id,
    branchId,
    lastName: 'Muster',
    firstName: 'Anna',
    jobTitle: 'Verkäuferin',
    employmentType: { type: 'FullTime', weeklyHours: 38 },
    vacationEntitlementPerYear: 28,
    holidayVacationHours: 7.6,
    active: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

interface RenderOptions {
  schedule: WeeklySchedule;
  employeeList: Employee[];
  absences?: Absence[];
  onApplied?: (updatedSchedule: WeeklySchedule) => void;
  onError?: (e: unknown, context?: string) => void;
  onClose?: () => void;
}

function renderDialog({ schedule, employeeList, absences = [], onApplied = vi.fn(), onError = vi.fn(), onClose = vi.fn() }: RenderOptions) {
  render(
    <CarryOverPreviousWeekDialog
      open
      onClose={onClose}
      branchId={branchId}
      selectedWeek={currentWeek}
      schedule={schedule}
      employeeList={employeeList}
      absences={absences}
      isHoliday={() => false}
      onApplied={onApplied}
      onError={onError}
    />,
  );
  return { onApplied, onError, onClose };
}

function inputFor(fullName: string) {
  return screen.getByRole('textbox', { name: `Übernehmen (Std.) ${fullName}` });
}

describe('CarryOverPreviousWeekDialog', () => {
  beforeEach(() => {
    findForWeekMock.mockReset();
    applyMock.mockReset();
  });

  it('shows a spinner and "Vorwoche wird geladen…" while the previous week is loading', async () => {
    const deferred = createDeferred<WeeklySchedule | null>();
    findForWeekMock.mockReturnValue(deferred.promise);
    const e1 = 'e1' as EmployeeId;

    renderDialog({
      schedule: createWeeklySchedule(branchId, currentWeek, [e1]),
      employeeList: [employee(e1)],
    });

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    expect(screen.getByText('Vorwoche wird geladen…')).toBeInTheDocument();

    deferred.resolve(null);
    await waitFor(() => expect(screen.queryByRole('progressbar')).not.toBeInTheDocument());
  });

  it('shows the empty-state alert and disables Übernehmen when there are no active employees', async () => {
    findForWeekMock.mockResolvedValue(null);

    renderDialog({
      schedule: createWeeklySchedule(branchId, currentWeek, []),
      employeeList: [],
    });

    await waitFor(() => expect(screen.queryByRole('progressbar')).not.toBeInTheDocument());
    expect(screen.getByText('Keine aktiven Mitarbeiter für diese Filiale.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Übernehmen' })).toBeDisabled();
  });

  it('suggests previousTargetMinutes - previousActualMinutes and pre-fills it as decimal hours', async () => {
    const e1 = 'e1' as EmployeeId;
    const emp = employee(e1, { employmentType: { type: 'FullTime', weeklyHours: 10 } });
    // Vorwoche: 1h gearbeitet (08:00-09:00, keine Pause) -> previousActualMinutes = 60.
    // Soll = 10 * 60 = 600. Vorschlag = 600 - 60 = 540 min = 9 Std.
    const previousSchedule = withDayEntry(createWeeklySchedule(branchId, previousWeek, [e1]), e1, 'Montag', {
      type: 'Shift',
      shifts: [createShift(clockTime('08:00'), clockTime('09:00'))],
    });
    findForWeekMock.mockResolvedValue(previousSchedule);

    renderDialog({
      schedule: createWeeklySchedule(branchId, currentWeek, [e1]),
      employeeList: [emp],
    });

    const row = (await screen.findAllByRole('row'))[1];
    const cells = within(row).getAllByRole('cell');
    expect(cells[1].textContent).toBe('1');
    expect(cells[2].textContent).toBe('10');
    expect(cells[3].textContent).toBe('+9');
    expect(inputFor('Muster, Anna')).toHaveValue('9');
  });

  it('suggests a NEGATIVE adjustment (no leading +) when previous-week Ist exceeded Soll', async () => {
    const e7 = 'e7' as EmployeeId;
    const emp = employee(e7, { lastName: 'Sieben', firstName: 'Sonja', employmentType: { type: 'FullTime', weeklyHours: 5 } });
    // Vorwoche: 8h gearbeitet (08:00-16:00, keine Pause) -> previousActualMinutes = 480.
    // Soll = 5 * 60 = 300. Vorschlag = 300 - 480 = -180 min = -3 Std (war der Vorwoche VORAUS).
    const previousSchedule = withDayEntry(createWeeklySchedule(branchId, previousWeek, [e7]), e7, 'Montag', {
      type: 'Shift',
      shifts: [createShift(clockTime('08:00'), clockTime('16:00'))],
    });
    findForWeekMock.mockResolvedValue(previousSchedule);

    renderDialog({
      schedule: createWeeklySchedule(branchId, currentWeek, [e7]),
      employeeList: [emp],
    });

    const row = (await screen.findAllByRole('row'))[1];
    const cells = within(row).getAllByRole('cell');
    expect(cells[1].textContent).toBe('8');
    expect(cells[2].textContent).toBe('5');
    expect(cells[3].textContent).toBe('-3');
    expect(inputFor('Sieben, Sonja')).toHaveValue('-3');
  });

  it('shows "keine Daten"/"–" and defaults the input to 0 when there is no previous-week entry', async () => {
    const e2 = 'e2' as EmployeeId;
    findForWeekMock.mockResolvedValue(null);

    renderDialog({
      schedule: createWeeklySchedule(branchId, currentWeek, [e2]),
      employeeList: [employee(e2, { employmentType: { type: 'FullTime', weeklyHours: 20 } })],
    });

    const row = (await screen.findAllByRole('row'))[1];
    const cells = within(row).getAllByRole('cell');
    expect(cells[1].textContent).toBe('keine Daten');
    expect(cells[2].textContent).toBe('–');
    expect(cells[3].textContent).toBe('–');
    expect(inputFor('Muster, Anna')).toHaveValue('0');
  });

  it('prefills from an already-stored targetAdjustmentMinutes instead of recomputing on reopen', async () => {
    const e5 = 'e5' as EmployeeId;
    const emp = employee(e5, { lastName: 'Fünf', firstName: 'Frida', employmentType: { type: 'FullTime', weeklyHours: 15 } });
    // Vorwoche komplett Off -> previousActualMinutes = 0, Soll = 900, frischer Vorschlag = +15 Std.
    findForWeekMock.mockResolvedValue(createWeeklySchedule(branchId, previousWeek, [e5]));
    const currentSchedule = withTargetAdjustment(createWeeklySchedule(branchId, currentWeek, [e5]), e5, 120);

    renderDialog({
      schedule: currentSchedule,
      employeeList: [emp],
    });

    const row = (await screen.findAllByRole('row'))[1];
    const cells = within(row).getAllByRole('cell');
    expect(cells[1].textContent).toBe('0');
    expect(cells[3].textContent).toBe('+15');
    expect(inputFor('Fünf, Frida')).toHaveValue('2');
  });

  it('excludes an inactive employee (with previous-week data) while still showing an active one', async () => {
    const e3 = 'e3' as EmployeeId;
    const eActive = 'eActive' as EmployeeId;
    const previousSchedule = withDayEntry(createWeeklySchedule(branchId, previousWeek, [e3]), e3, 'Montag', {
      type: 'Shift',
      shifts: [createShift(clockTime('08:00'), clockTime('16:00'))],
    });
    findForWeekMock.mockResolvedValue(previousSchedule);

    renderDialog({
      schedule: createWeeklySchedule(branchId, currentWeek, [eActive]),
      employeeList: [
        employee(e3, { active: false }),
        employee(eActive, { lastName: 'Aktiv', firstName: 'Alina' }),
      ],
    });

    await screen.findAllByRole('row');
    // Proves the exclusion is selective (the active employee is not collaterally dropped too),
    // not just that an all-inactive list collapses to the empty state.
    expect(screen.queryByText('Muster, Anna')).not.toBeInTheDocument();
    expect(screen.getByText('Aktiv, Alina')).toBeInTheDocument();
    expect(screen.queryByText('Keine aktiven Mitarbeiter für diese Filiale.')).not.toBeInTheDocument();
  });

  it('shows the "davon X angerechnet" caption for a previous week partly credited (not worked)', async () => {
    const e4 = 'e4' as EmployeeId;
    const emp = employee(e4, {
      lastName: 'Vier',
      firstName: 'Vera',
      employmentType: { type: 'FullTime', weeklyHours: 35 },
      holidayVacationHours: 7,
    });
    // Montag 4h gearbeitet (08:00-12:00), Dienstag ganztägig Urlaub -> angerechnet 7 Std.
    // previousActualMinutes (totalNetMinutes) = 240 (worked) + 420 (credited) = 660 = 11 Std.
    const previousSchedule = withDayEntry(createWeeklySchedule(branchId, previousWeek, [e4]), e4, 'Montag', {
      type: 'Shift',
      shifts: [createShift(clockTime('08:00'), clockTime('12:00'))],
    });
    findForWeekMock.mockResolvedValue(previousSchedule);
    const absences: Absence[] = [
      {
        id: 'a1' as AbsenceId,
        employeeId: e4,
        type: 'Vacation',
        from: '2026-09-01',
        to: '2026-09-01',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ];

    renderDialog({
      schedule: createWeeklySchedule(branchId, currentWeek, [e4]),
      employeeList: [emp],
      absences,
    });

    const row = (await screen.findAllByRole('row'))[1];
    const cells = within(row).getAllByRole('cell');
    expect(cells[1]).toHaveTextContent('11');
    expect(within(cells[1]).getByText('davon 7 angerechnet')).toBeInTheDocument();
  });

  it('applies all rows, correctly rounded to minutes, not only the edited one', async () => {
    const user = userEvent.setup();
    const e1 = 'e1' as EmployeeId;
    const e6 = 'e6' as EmployeeId;
    const emp1 = employee(e1, { lastName: 'Eins', firstName: 'Erika', employmentType: { type: 'FullTime', weeklyHours: 10 } });
    const emp6 = employee(e6, { lastName: 'Sechs', firstName: 'Sina', employmentType: { type: 'FullTime', weeklyHours: 20 } });
    // e1: Vorschlag +9 Std. (siehe erster Testfall). e6 hat keinen Eintrag in der Vorwoche -> Vorschlag 0.
    const previousSchedule = withDayEntry(createWeeklySchedule(branchId, previousWeek, [e1]), e1, 'Montag', {
      type: 'Shift',
      shifts: [createShift(clockTime('08:00'), clockTime('09:00'))],
    });
    findForWeekMock.mockResolvedValue(previousSchedule);
    const currentSchedule = createWeeklySchedule(branchId, currentWeek, [e1, e6]);
    const updatedSchedule: WeeklySchedule = { ...currentSchedule, updatedAt: '2026-09-11T00:00:00.000Z' };
    applyMock.mockResolvedValue(updatedSchedule);
    const { onApplied, onClose } = renderDialog({
      schedule: currentSchedule,
      employeeList: [emp1, emp6],
    });

    await screen.findAllByRole('row');
    expect(inputFor('Eins, Erika')).toHaveValue('9');

    const e6Input = inputFor('Sechs, Sina');
    await user.clear(e6Input);
    // 2,33 Std * 60 = 139,8 -> rundet auf 140, nicht 139: exercises the Math.round, not just an
    // exact minute value that would pass even without it.
    await user.type(e6Input, '2,33');
    await user.click(screen.getByRole('button', { name: 'Übernehmen' }));

    await waitFor(() => expect(onApplied).toHaveBeenCalledWith(updatedSchedule));
    expect(applyMock).toHaveBeenCalledWith(currentSchedule, [
      { employeeId: e1, minutes: 540 },
      { employeeId: e6, minutes: 140 },
    ]);
    expect(onClose).toHaveBeenCalled();
  });

  it('reports a rejected findForWeek with the pinned context and stops the loading spinner', async () => {
    findForWeekMock.mockRejectedValue(new Error('IndexedDB nicht verfügbar'));
    const e1 = 'e1' as EmployeeId;

    const { onError } = renderDialog({
      schedule: createWeeklySchedule(branchId, currentWeek, [e1]),
      employeeList: [employee(e1)],
    });

    await waitFor(() =>
      expect(onError).toHaveBeenCalledWith(expect.any(Error), 'Die Vorwoche konnte nicht geladen werden'),
    );
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(screen.queryByText('Vorwoche wird geladen…')).not.toBeInTheDocument();
  });

  it('reports a rejected applyTargetAdjustments with the pinned context and leaves the dialog open', async () => {
    const e1 = 'e1' as EmployeeId;
    findForWeekMock.mockResolvedValue(null);
    applyMock.mockRejectedValue(new Error('Speichern fehlgeschlagen'));
    const { onApplied, onError, onClose } = renderDialog({
      schedule: createWeeklySchedule(branchId, currentWeek, [e1]),
      employeeList: [employee(e1)],
    });

    const submitButton = await screen.findByRole('button', { name: 'Übernehmen' });
    await waitFor(() => expect(submitButton).not.toBeDisabled());
    const user = userEvent.setup();
    await user.click(submitButton);

    await waitFor(() =>
      expect(onError).toHaveBeenCalledWith(expect.any(Error), 'Stundenübertrag konnte nicht übernommen werden'),
    );
    expect(onApplied).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });
});
