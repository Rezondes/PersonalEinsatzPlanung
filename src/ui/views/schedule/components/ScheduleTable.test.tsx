import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { BranchId, EmployeeId } from '@domain/shared/ids';
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

describe('ScheduleTable', () => {
  it('renders one row per employee with their shift times', () => {
    render(<ScheduleTable rows={rowsFor(employees)} validationResults={[]} onCellClick={() => {}} />);

    expect(screen.getByText('Müller, Anna')).toBeInTheDocument();
    expect(screen.getByText('Schulz, Anna')).toBeInTheDocument();
    expect(screen.getByText('06:00-14:00')).toBeInTheDocument();
    expect(screen.getAllByText('frei')).toHaveLength(13);
  });

  it('attaches a dated validation result to exactly its cell and ignores week-level ones', async () => {
    const user = userEvent.setup();
    const results: ValidationResult[] = [
      { rule: 'ArbZG_3_Tag', severity: 'error', message: 'Tagesarbeitszeit zu lang', employeeId: m1, date: '2026-09-07' },
      { rule: 'ArbZG_3_Woche', severity: 'warning', message: 'Wochenarbeitszeit hoch', employeeId: m1 },
    ];
    render(<ScheduleTable rows={rowsFor(employees)} validationResults={results} onCellClick={() => {}} />);

    const [mondayOfFirstRow] = screen.getAllByRole('button', { name: 'Montag bearbeiten' });
    await user.hover(mondayOfFirstRow);

    expect(await screen.findByText('Tagesarbeitszeit zu lang')).toBeInTheDocument();
    expect(screen.queryByText('Wochenarbeitszeit hoch')).not.toBeInTheDocument();
  });

  it('reports the clicked cell with its employee and day', async () => {
    const user = userEvent.setup();
    const onCellClick = vi.fn();
    render(<ScheduleTable rows={rowsFor(employees)} validationResults={[]} onCellClick={onCellClick} />);

    const [, tuesdayOfSecondRow] = screen.getAllByRole('button', { name: 'Dienstag bearbeiten' });
    await user.click(tuesdayOfSecondRow);

    expect(onCellClick).toHaveBeenCalledWith(m2, expect.objectContaining({ day: 'Dienstag', date: '2026-09-08' }));
  });

  it('skips assignments whose employee is unknown', () => {
    render(<ScheduleTable rows={rowsFor([employee(m1, 'Müller')])} validationResults={[]} onCellClick={() => {}} />);

    expect(screen.queryByText('Schulz, Anna')).not.toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(2);
  });
});
