import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import type { BranchId, EmployeeId } from '@domain/shared/ids';
import type { Branch } from '@domain/branch/Branch';
import { emptyAddress } from '@domain/branch/Address';
import type { Employee } from '@domain/employee/Employee';
import { WEEKDAYS, dateForWeekday } from '@domain/shared/CalendarWeek';
import type { CalendarWeek, Weekday } from '@domain/shared/CalendarWeek';
import type { PrintRowFullPartTime, PrintDayCell, PrintBreakCell } from '@application/export/printDataPreparation';
import { fullName } from '@domain/employee/Employee';
import { FullPartTimeForm } from './FullPartTimeForm';
import { formatDateShort } from './printFormat';

const calendarWeek: CalendarWeek = { year: 2026, week: 37 };

const EMPTY_BREAK: PrintBreakCell = { timeText: '', hoursText: '' };

function branch(overrides: Partial<Branch> = {}): Branch {
  return {
    id: 'b1' as BranchId,
    name: 'Filiale Mitte',
    branchNumber: '123',
    address: emptyAddress(),
    logoBase64: null,
    federalState: 'Bayern',
    allowedOpenSundays: [],
    active: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function employee(overrides: Partial<Employee> = {}): Employee {
  return {
    id: 'e1' as EmployeeId,
    branchId: 'b1' as BranchId,
    lastName: 'Mustermann',
    firstName: 'Max',
    jobTitle: 'Verkäufer',
    employmentType: { type: 'FullTime', weeklyHours: 40 },
    vacationEntitlementPerYear: 24,
    holidayVacationHours: 8,
    active: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function emptyDayCell(overrides: Partial<PrintDayCell> = {}): PrintDayCell {
  return {
    date: '2026-09-07',
    timeText: '',
    hoursText: '',
    breaks: [EMPTY_BREAK, EMPTY_BREAK],
    isAbsent: false,
    ...overrides,
  };
}

function emptyDays(): Record<Weekday, PrintDayCell> {
  return Object.fromEntries(WEEKDAYS.map((d) => [d, emptyDayCell()])) as Record<Weekday, PrintDayCell>;
}

function row(overrides: Partial<PrintRowFullPartTime> = {}): PrintRowFullPartTime {
  return {
    employee: employee(),
    days: emptyDays(),
    totalHoursWeek: '0,00',
    weeklyHours: 40,
    ...overrides,
  };
}

function zeroDayTotals(): Record<Weekday, number> {
  return Object.fromEntries(WEEKDAYS.map((d) => [d, 0])) as Record<Weekday, number>;
}

describe('FullPartTimeForm', () => {
  it('always renders exactly 9 employee column headers, padding empty slots regardless of row count', () => {
    const rows = [
      row({ employee: employee({ lastName: 'Bauer', firstName: 'Anna' }) }),
      row({ employee: employee({ lastName: 'Krause', firstName: 'Tom' }) }),
      row({ employee: employee({ lastName: 'Schmidt', firstName: 'Eva' }) }),
    ];
    render(<FullPartTimeForm branch={branch()} calendarWeek={calendarWeek} rows={rows} dayTotals={zeroDayTotals()} />);

    const nameRow = screen.getByText('Name').closest('tr')!;
    const employeeHeaders = nameRow.querySelectorAll('th.employee-header');
    expect(employeeHeaders).toHaveLength(9);
    expect(Array.from(employeeHeaders).map((th) => th.textContent)).toEqual([
      'Bauer, Anna',
      'Krause, Tom',
      'Schmidt, Eva',
      '',
      '',
      '',
      '',
      '',
      '',
    ]);
  });

  it('always renders exactly 9 employee columns, ignoring any row beyond the 9th', () => {
    const rows = Array.from({ length: 11 }, (_, i) => row({ employee: employee({ lastName: `Name${i}` }) }));
    render(<FullPartTimeForm branch={branch()} calendarWeek={calendarWeek} rows={rows} dayTotals={zeroDayTotals()} />);

    const nameRow = screen.getByText('Name').closest('tr')!;
    const employeeHeaders = nameRow.querySelectorAll('th.employee-header');
    expect(employeeHeaders).toHaveLength(9);
    expect(Array.from(employeeHeaders).map((th) => th.textContent)).toEqual(
      rows.slice(0, 9).map((r) => fullName(r.employee)),
    );
    expect(screen.queryByText(fullName(rows[9].employee))).not.toBeInTheDocument();
    expect(screen.queryByText(fullName(rows[10].employee))).not.toBeInTheDocument();
  });

  it('keeps the 9-column widths identical regardless of row count', () => {
    const colWidths = (container: HTMLElement) =>
      Array.from(container.querySelectorAll('colgroup col')).map((col) => (col as HTMLElement).style.width);

    const { container: sparse } = render(
      <FullPartTimeForm branch={branch()} calendarWeek={calendarWeek} rows={[row()]} dayTotals={zeroDayTotals()} />,
    );
    const { container: full } = render(
      <FullPartTimeForm
        branch={branch()}
        calendarWeek={calendarWeek}
        rows={Array.from({ length: 9 }, () => row({ employee: employee() }))}
        dayTotals={zeroDayTotals()}
      />,
    );

    expect(colWidths(sparse)).toEqual(colWidths(full));
    expect(colWidths(sparse)).toHaveLength(2 + 9 * 2);
    const expectedEmployeeColWidth = `${92 / (9 * 2)}%`;
    expect(colWidths(sparse)[2]).toBe(expectedEmployeeColWidth);
    expect(colWidths(sparse)[colWidths(sparse).length - 1]).toBe(expectedEmployeeColWidth);
  });

  it('renders Wochen-Std. per employee, blank for padding slots beyond the given rows', () => {
    const rows = [
      row({ employee: employee({ lastName: 'Bauer' }), weeklyHours: 32 }),
      row({ employee: employee({ lastName: 'Klein' }), weeklyHours: 20 }),
    ];
    render(<FullPartTimeForm branch={branch()} calendarWeek={calendarWeek} rows={rows} dayTotals={zeroDayTotals()} />);

    const weeklyHoursCells = Array.from(screen.getByText('Wochen-Std.').closest('tr')!.querySelectorAll('th')).slice(1);
    expect(weeklyHoursCells).toHaveLength(9);
    expect(weeklyHoursCells[0]).toHaveTextContent('32,00');
    expect(weeklyHoursCells[1]).toHaveTextContent('20,00');
    for (let i = 2; i < 9; i++) {
      expect(weeklyHoursCells[i]).toHaveTextContent('');
    }
  });

  it('lays out one weekday as 4 rows: a date/total row, the weekday-name row, then exactly two break rows, each carrying its own break data', () => {
    const days = emptyDays();
    days.Montag = {
      date: '2026-09-07',
      timeText: '08:00-16:00',
      hoursText: '7,50',
      breaks: [
        { timeText: '12:00', hoursText: '0,50' },
        { timeText: '', hoursText: '0,25' },
      ],
      isAbsent: false,
    };
    const dayTotals = zeroDayTotals();
    dayTotals.Montag = 8;

    render(<FullPartTimeForm branch={branch()} calendarWeek={calendarWeek} rows={[row({ days })]} dayTotals={dayTotals} />);

    const weekdayRow = screen.getByText('Montag').closest('tr')!;
    const dateRow = weekdayRow.previousElementSibling as HTMLTableRowElement;
    const breakRow1 = weekdayRow.nextElementSibling as HTMLTableRowElement;
    const breakRow2 = breakRow1.nextElementSibling as HTMLTableRowElement;

    expect(dateRow.className).not.toContain('break-row');
    expect(within(dateRow).getByText(formatDateShort(dateForWeekday(calendarWeek, 'Montag')))).toBeInTheDocument();
    expect(within(dateRow).getByText('8,00')).toBeInTheDocument();
    const dateRowSlotCells = Array.from(dateRow.cells).slice(2);
    expect(dateRowSlotCells).toHaveLength(18);
    expect(dateRowSlotCells.every((c) => c.textContent === '')).toBe(true);

    expect(within(weekdayRow).getByText('08:00-16:00')).toBeInTheDocument();
    expect(within(weekdayRow).getByText('7,50')).toBeInTheDocument();

    expect(breakRow1.className).toContain('break-row');
    expect(breakRow2.className).toContain('break-row');
    expect(within(breakRow1).getByText('Pause')).toBeInTheDocument();
    expect(within(breakRow2).getByText('Pause')).toBeInTheDocument();

    expect(within(breakRow1).getByText('12:00')).toBeInTheDocument();
    expect(within(breakRow1).getByText('0,50')).toBeInTheDocument();

    expect(breakRow2.cells).toHaveLength(19);
    expect(breakRow2.cells[1].textContent).toBe('');
    expect(breakRow2.cells[2].textContent).toBe('0,25');
    for (let i = 3; i < breakRow2.cells.length; i++) {
      expect(breakRow2.cells[i].textContent).toBe('');
    }
  });

  it('renders an empty day-total cell for a weekday with zero total hours, not "0,00"', () => {
    render(<FullPartTimeForm branch={branch()} calendarWeek={calendarWeek} rows={[row()]} dayTotals={zeroDayTotals()} />);

    const weekdayRow = screen.getByText('Dienstag').closest('tr')!;
    const dateRow = weekdayRow.previousElementSibling as HTMLTableRowElement;
    expect(dateRow.cells[1].textContent).toBe('');
  });

  it('shows the weekly total per employee in the Gesamtstunden row, blank for padding slots', () => {
    const rows = [
      row({ employee: employee({ lastName: 'Bauer' }), totalHoursWeek: '38,25' }),
      row({ employee: employee({ lastName: 'Klein' }), totalHoursWeek: '19,00' }),
    ];
    render(<FullPartTimeForm branch={branch()} calendarWeek={calendarWeek} rows={rows} dayTotals={zeroDayTotals()} />);

    const totalsRow = screen.getByText('Gesamtstunden (gearbeitet)').closest('tr')!;
    const totalCells = Array.from(totalsRow.querySelectorAll('td')).slice(1);
    expect(totalCells).toHaveLength(9);
    expect(totalCells[0]).toHaveTextContent('38,25');
    expect(totalCells[1]).toHaveTextContent('19,00');
    for (let i = 2; i < 9; i++) {
      expect(totalCells[i]).toHaveTextContent('');
    }
  });

  it('inserts a <wbr> right before "/" in a job title so it wraps at a controlled point', () => {
    const rows = [row({ employee: employee({ jobTitle: 'Filialverantwortliche/-r' }) })];
    render(<FullPartTimeForm branch={branch()} calendarWeek={calendarWeek} rows={rows} dayTotals={zeroDayTotals()} />);

    const jobTitleRow = screen.getByText('Tätigkeit').closest('tr')!;
    const jobTitleCell = jobTitleRow.cells[1];

    expect(jobTitleCell.querySelector('wbr')).not.toBeNull();
    expect(jobTitleCell.textContent).toBe('Filialverantwortliche/-r');

    const childNodes = Array.from(jobTitleCell.childNodes);
    expect(childNodes[0].textContent).toBe('Filialverantwortliche');
    expect((childNodes[1] as Element).tagName.toLowerCase()).toBe('wbr');
    expect(childNodes[2].textContent).toBe('/-r');
  });

  it('renders the branch logo image when logoBase64 is set', () => {
    render(
      <FullPartTimeForm
        branch={branch({ logoBase64: 'data:image/png;base64,abc123', name: 'Filiale Nord' })}
        calendarWeek={calendarWeek}
        rows={[]}
        dayTotals={zeroDayTotals()}
      />,
    );

    const img = screen.getByRole('img', { name: 'Logo Filiale Nord' });
    expect(img).toHaveAttribute('src', 'data:image/png;base64,abc123');
  });

  it('renders an empty placeholder div instead of an image when there is no logo', () => {
    const { container } = render(
      <FullPartTimeForm branch={branch({ logoBase64: null })} calendarWeek={calendarWeek} rows={[]} dayTotals={zeroDayTotals()} />,
    );

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    const placeholder = container.querySelector('.print-header-logo');
    expect(placeholder).toBeInTheDocument();
    expect(placeholder?.tagName).toBe('DIV');
  });

  it('renders empty meta values when plannedWeeklyRevenue/plannedWeeklyHours are undefined', () => {
    const { container } = render(
      <FullPartTimeForm branch={branch()} calendarWeek={calendarWeek} rows={[]} dayTotals={zeroDayTotals()} />,
    );

    const metaLines = container.querySelectorAll('.print-meta');
    expect(metaLines[0].textContent).toBe('geplanter Wochenumsatz: ');
    expect(metaLines[1].textContent).toBe('geplante Wochenstunden: ');
  });

  it('renders German-formatted revenue and hours when planned values are set', () => {
    const { container } = render(
      <FullPartTimeForm
        branch={branch()}
        calendarWeek={calendarWeek}
        rows={[]}
        dayTotals={zeroDayTotals()}
        plannedWeeklyRevenue={25000}
        plannedWeeklyHours={37.5}
      />,
    );

    const metaLines = container.querySelectorAll('.print-meta');
    expect(metaLines[0].textContent).toBe('geplanter Wochenumsatz: 25.000 €');
    expect(metaLines[1].textContent).toBe('geplante Wochenstunden: 37,50');
  });
});
