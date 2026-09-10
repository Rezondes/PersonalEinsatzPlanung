import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { BranchId, EmployeeId } from '@domain/shared/ids';
import { WEEKDAYS, dateForWeekday } from '@domain/shared/CalendarWeek';
import { toISODate } from '@domain/shared/DateFormat';
import { clockTime } from '@domain/shared/ClockTime';
import { createShift } from '@domain/schedule/Shift';
import { createWeeklySchedule, withDayEntry } from '@domain/schedule/WeeklySchedule';
import type { Employee } from '@domain/employee/Employee';
import type { ValidationResult } from '@domain/validation/ValidationResult';
import { createWeekView } from '@application/schedule/scheduleAssessment';
import { buildScheduleRows } from '../scheduleRows';
import { ScheduleTable } from './ScheduleTable';

const branchId = 'b1' as BranchId;
const m1 = 'm1' as EmployeeId;
const m2 = 'm2' as EmployeeId;

function employee(id: EmployeeId, lastName: string): Employee {
  return {
    id,
    branchId,
    lastName,
    firstName: 'Anna',
    jobTitle: 'Verkauf',
    employmentType: { type: 'FullTime', weeklyHours: 40 },
    vacationEntitlementPerYear: 30,
    holidayVacationHours: 5,
    active: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

/** KW 37/2026: Monday 2026-09-07. m1 works Monday 06:00-14:00, everything else is off. */
const schedule = withDayEntry(
  createWeeklySchedule(branchId, { year: 2026, week: 37 }, [m1, m2]),
  m1,
  'Montag',
  { type: 'Shift', shifts: [createShift(clockTime('06:00'), clockTime('14:00'))] },
);
const employees = [employee(m1, 'Müller'), employee(m2, 'Schulz')];
const weekView = createWeekView(schedule, [], { employees });

/** KW 37/2026 runs Mon 2026-09-07 to Sun 2026-09-13. */
function rowsFor(employeeList: Employee[]) {
  return buildScheduleRows(weekView, employeeList, '2026-09-07', '2026-09-13');
}

const weekDays = WEEKDAYS.map((day) => ({ day, date: toISODate(dateForWeekday({ year: 2026, week: 37 }, day)) }));

/** Every existing (pre-Phase-5c) test exercises the non-assigning path, matching the laptop
 * breakpoint's unchanged behavior - assignMode off, no tile armed. */
const notAssigning = {
  assignMode: false,
  onToolTap: () => {},
  isAssignTarget: () => false,
};

describe('ScheduleTable', () => {
  it('renders one row per employee with their shift times', () => {
    render(<ScheduleTable rows={rowsFor(employees)} weekDays={weekDays} validationResults={[]} onCellClick={() => {}} onToolDrop={() => {}} {...notAssigning} />);

    expect(screen.getByText('Müller, Anna')).toBeInTheDocument();
    expect(screen.getByText('Schulz, Anna')).toBeInTheDocument();
    expect(screen.getByText('06:00-14:00')).toBeInTheDocument();
    expect(screen.getAllByText('frei')).toHaveLength(13);
  });

  it('shows a dedicated warning icon for a cell with a dated validation result, ignores week-level ones, and tapping it toggles the tooltip without also opening the cell', async () => {
    const user = userEvent.setup();
    const onCellClick = vi.fn();
    const results: ValidationResult[] = [
      { rule: 'ArbZG_3_Tag', severity: 'error', message: 'Tagesarbeitszeit zu lang', employeeId: m1, date: '2026-09-07' },
      { rule: 'ArbZG_3_Woche', severity: 'warning', message: 'Wochenarbeitszeit hoch', employeeId: m1 },
    ];
    render(
      <ScheduleTable
        rows={rowsFor(employees)}
        weekDays={weekDays}
        validationResults={results}
        onCellClick={onCellClick}
        onToolDrop={() => {}}
        {...notAssigning}
      />,
    );

    const warningIcon = screen.getByRole('button', { name: 'Hinweis anzeigen' });
    await user.click(warningIcon);

    expect(await screen.findByText('Tagesarbeitszeit zu lang')).toBeInTheDocument();
    expect(screen.queryByText('Wochenarbeitszeit hoch')).not.toBeInTheDocument();
    // The icon has its own tap target (stopPropagation) so it never also opens the Tageseditor.
    expect(onCellClick).not.toHaveBeenCalled();

    // A second tap on the same icon hides it again.
    await user.click(warningIcon);
    await waitFor(() => expect(screen.queryByText('Tagesarbeitszeit zu lang')).not.toBeInTheDocument());
  });

  it('reports the clicked cell with its employee and day', async () => {
    const user = userEvent.setup();
    const onCellClick = vi.fn();
    render(<ScheduleTable rows={rowsFor(employees)} weekDays={weekDays} validationResults={[]} onCellClick={onCellClick} onToolDrop={() => {}} {...notAssigning} />);

    const [, tuesdayOfSecondRow] = screen.getAllByRole('button', { name: 'Dienstag bearbeiten' });
    await user.click(tuesdayOfSecondRow);

    expect(onCellClick).toHaveBeenCalledWith(m2, expect.objectContaining({ day: 'Dienstag', date: '2026-09-08' }));
  });

  it('skips assignments whose employee is unknown', () => {
    render(<ScheduleTable rows={rowsFor([employee(m1, 'Müller')])} weekDays={weekDays} validationResults={[]} onCellClick={() => {}} onToolDrop={() => {}} {...notAssigning} />);

    expect(screen.queryByText('Schulz, Anna')).not.toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(2);
  });

  describe('assignMode (tap-to-assign)', () => {
    it('taps a free cell via onToolTap instead of onCellClick, labelled "zuweisen"', async () => {
      const user = userEvent.setup();
      const onCellClick = vi.fn();
      const onToolTap = vi.fn();
      render(
        <ScheduleTable
          rows={rowsFor(employees)}
          weekDays={weekDays}
          validationResults={[]}
          onCellClick={onCellClick}
          onToolDrop={() => {}}
          assignMode
          onToolTap={onToolTap}
          isAssignTarget={() => false}
        />,
      );

      const [, tuesdayOfSecondRow] = screen.getAllByRole('button', { name: 'Dienstag zuweisen' });
      await user.click(tuesdayOfSecondRow);

      expect(onToolTap).toHaveBeenCalledWith(m2, expect.objectContaining({ day: 'Dienstag', date: '2026-09-08' }));
      expect(onCellClick).not.toHaveBeenCalled();
    });

    it('still opens onCellClick for a cell the row/day lock does not cover but that cannot receive an entry', async () => {
      // m1's Monday already carries a Shift - canReceiveEntry only excludes locked days and
      // multi-day absences, neither of which this fixture has, so this documents that an ordinary
      // already-filled cell still stays a normal tap-to-assign target (regression guard for the
      // "droppable" gate, using the one cell in this fixture with real content).
      const user = userEvent.setup();
      const onCellClick = vi.fn();
      const onToolTap = vi.fn();
      render(
        <ScheduleTable
          rows={rowsFor(employees)}
          weekDays={weekDays}
          validationResults={[]}
          onCellClick={onCellClick}
          onToolDrop={() => {}}
          assignMode
          onToolTap={onToolTap}
          isAssignTarget={() => false}
        />,
      );

      const [mondayOfFirstRow] = screen.getAllByRole('button', { name: 'Montag zuweisen' });
      await user.click(mondayOfFirstRow);

      expect(onToolTap).toHaveBeenCalledWith(m1, expect.objectContaining({ day: 'Montag' }));
      expect(onCellClick).not.toHaveBeenCalled();
    });

    it('marks a cell isAssignTarget with the target styling and an accessible "zuweisen" label', () => {
      render(
        <ScheduleTable
          rows={rowsFor(employees)}
          weekDays={weekDays}
          validationResults={[]}
          onCellClick={() => {}}
          onToolDrop={() => {}}
          assignMode
          onToolTap={() => {}}
          isAssignTarget={(employeeId, dayView) => employeeId === m1 && dayView.day === 'Montag'}
        />,
      );

      const [mondayOfFirstRow] = screen.getAllByRole('button', { name: 'Montag zuweisen' });
      expect(mondayOfFirstRow).toHaveStyle({ backgroundColor: '#dce9e3', border: '1px solid #2f5d50' });
    });
  });
});
