import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import type { BranchId, EmployeeId } from '@domain/shared/ids';
import type { Branch } from '@domain/branch/Branch';
import type { Employee } from '@domain/employee/Employee';
import { fullName } from '@domain/employee/Employee';
import type { CalendarWeek, Weekday } from '@domain/shared/CalendarWeek';
import { WEEKDAYS, dateForWeekday } from '@domain/shared/CalendarWeek';
import type { PrintRowMinijob, PrintDayCell } from '@application/export/printDataPreparation';
import { formatDateShort, formatHours } from './printFormat';
import { MinijobForm } from './MinijobForm';

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

const calendarWeek: CalendarWeek = { year: 2026, week: 37 };

function emptyDayCell(): PrintDayCell {
  return {
    date: '2026-09-07',
    timeText: '',
    hoursText: '',
    breaks: [
      { timeText: '', hoursText: '' },
      { timeText: '', hoursText: '' },
    ],
    isAbsent: false,
  };
}

function emptyDays(): Record<Weekday, PrintDayCell> {
  return Object.fromEntries(WEEKDAYS.map((day) => [day, emptyDayCell()])) as Record<Weekday, PrintDayCell>;
}

function zeroDayTotals(): Record<Weekday, number> {
  return Object.fromEntries(WEEKDAYS.map((day) => [day, 0])) as Record<Weekday, number>;
}

let employeeCounter = 0;
function makeEmployee(overrides: Partial<Employee> = {}): Employee {
  employeeCounter += 1;
  return {
    id: `e${employeeCounter}` as EmployeeId,
    branchId: branch.id,
    lastName: 'Bauer',
    firstName: 'Petra',
    jobTitle: 'Verkäuferin',
    employmentType: { type: 'Minijob', minHours: 5, maxHours: 10 },
    vacationEntitlementPerYear: 28,
    holidayVacationHours: 1.5,
    active: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeRow(overrides: Partial<PrintRowMinijob> = {}): PrintRowMinijob {
  return {
    employee: makeEmployee(),
    days: emptyDays(),
    totalHoursWeek: '',
    minHours: 5,
    maxHours: 10,
    ...overrides,
  };
}

function nameHeaderCells(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll('th.employee-header:not(.column-branch)'));
}

function tbodyRows(container: HTMLElement): HTMLTableRowElement[] {
  return Array.from(container.querySelectorAll('table.print-table > tbody > tr'));
}

describe('MinijobForm', () => {
  it('always renders exactly 9 employee columns, ignoring any row beyond the 9th', () => {
    const rows = Array.from({ length: 11 }, (_, i) =>
      makeRow({ employee: makeEmployee({ lastName: `Name${i}` }) }),
    );
    const { container } = render(
      <MinijobForm branch={branch} calendarWeek={calendarWeek} rows={rows} dayTotals={zeroDayTotals()} />,
    );

    const headers = nameHeaderCells(container);
    expect(headers).toHaveLength(9);
    headers.forEach((th, i) => expect(th).toHaveTextContent(fullName(rows[i].employee)));
    expect(screen.queryByText(fullName(rows[9].employee))).not.toBeInTheDocument();
    expect(screen.queryByText(fullName(rows[10].employee))).not.toBeInTheDocument();
  });

  it('pads unused employee columns blank when fewer than 9 rows are given', () => {
    const rows = [
      makeRow({ employee: makeEmployee({ lastName: 'Bauer' }) }),
      makeRow({ employee: makeEmployee({ lastName: 'Klein' }) }),
    ];
    const { container } = render(
      <MinijobForm branch={branch} calendarWeek={calendarWeek} rows={rows} dayTotals={zeroDayTotals()} />,
    );

    const headers = nameHeaderCells(container);
    expect(headers).toHaveLength(9);
    expect(headers[0]).toHaveTextContent(fullName(rows[0].employee));
    expect(headers[1]).toHaveTextContent(fullName(rows[1].employee));
    for (let i = 2; i < 9; i++) {
      expect(headers[i]).toHaveTextContent('');
    }
  });

  it('keeps the 9-column widths identical regardless of row count', () => {
    const colWidths = (container: HTMLElement) =>
      Array.from(container.querySelectorAll('colgroup col')).map((col) => (col as HTMLElement).style.width);

    const { container: sparse } = render(
      <MinijobForm branch={branch} calendarWeek={calendarWeek} rows={[makeRow()]} dayTotals={zeroDayTotals()} />,
    );
    const { container: full } = render(
      <MinijobForm
        branch={branch}
        calendarWeek={calendarWeek}
        rows={Array.from({ length: 9 }, () => makeRow({ employee: makeEmployee() }))}
        dayTotals={zeroDayTotals()}
      />,
    );

    expect(colWidths(sparse)).toEqual(colWidths(full));
    expect(colWidths(sparse)).toHaveLength(2 + 9 * 2);
    const expectedEmployeeColWidth = `${92 / (9 * 2)}%`;
    expect(colWidths(sparse)[2]).toBe(expectedEmployeeColWidth);
    expect(colWidths(sparse)[colWidths(sparse).length - 1]).toBe(expectedEmployeeColWidth);
  });

  it('wraps a job title containing "/" with a <wbr> before the slash', () => {
    const row = makeRow({ employee: makeEmployee({ jobTitle: 'Filialverantwortliche/-r' }) });
    render(<MinijobForm branch={branch} calendarWeek={calendarWeek} rows={[row]} dayTotals={zeroDayTotals()} />);

    const jobTitleRow = screen.getByText('Tätigkeit').closest('tr')!;
    expect(jobTitleRow.querySelector('wbr')).not.toBeNull();
    expect(jobTitleRow).toHaveTextContent('Filialverantwortliche/-r');
    const html = jobTitleRow.innerHTML;
    expect(html.indexOf('<wbr')).toBeLessThan(html.indexOf('/-r'));
  });

  it('renders the week/year and branch header labels', () => {
    render(<MinijobForm branch={branch} calendarWeek={calendarWeek} rows={[]} dayTotals={zeroDayTotals()} />);

    expect(screen.getByText(`Woche: ${calendarWeek.week} / ${calendarWeek.year}`)).toBeInTheDocument();
    expect(screen.getByText(`Filiale: ${branch.branchNumber} ${branch.name}`)).toBeInTheDocument();
  });

  it('renders Min. Std. and Max. Std. header rows per employee, blank for padding slots, and never a Wochen-Std. row', () => {
    const rows = [
      makeRow({ employee: makeEmployee({ lastName: 'Bauer' }), minHours: 5, maxHours: 10 }),
      makeRow({ employee: makeEmployee({ lastName: 'Klein' }), minHours: 8, maxHours: 15 }),
    ];
    render(<MinijobForm branch={branch} calendarWeek={calendarWeek} rows={rows} dayTotals={zeroDayTotals()} />);

    const minCells = Array.from(screen.getByText('Min. Std.').closest('tr')!.querySelectorAll('th')).slice(1);
    expect(minCells).toHaveLength(9);
    expect(minCells[0]).toHaveTextContent(formatHours(5));
    expect(minCells[1]).toHaveTextContent(formatHours(8));
    expect(minCells[2]).toHaveTextContent('');

    const maxCells = Array.from(screen.getByText('Max. Std.').closest('tr')!.querySelectorAll('th')).slice(1);
    expect(maxCells).toHaveLength(9);
    expect(maxCells[0]).toHaveTextContent(formatHours(10));
    expect(maxCells[1]).toHaveTextContent(formatHours(15));
    expect(maxCells[2]).toHaveTextContent('');

    expect(screen.queryByText('Wochen-Std.')).not.toBeInTheDocument();
  });

  it('renders the branch logo image when present', () => {
    const branchWithLogo: Branch = { ...branch, logoBase64: 'data:image/png;base64,abc123' };
    render(<MinijobForm branch={branchWithLogo} calendarWeek={calendarWeek} rows={[]} dayTotals={zeroDayTotals()} />);

    const img = screen.getByRole('img', { name: `Logo ${branchWithLogo.name}` });
    expect(img).toHaveAttribute('src', branchWithLogo.logoBase64);
  });

  it('renders an empty placeholder div in place of the logo when the branch has none', () => {
    const { container } = render(
      <MinijobForm branch={branch} calendarWeek={calendarWeek} rows={[]} dayTotals={zeroDayTotals()} />,
    );

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    const placeholder = container.querySelector('.print-header-logo');
    expect(placeholder).not.toBeNull();
    expect(placeholder!.tagName).toBe('DIV');
    expect(placeholder).toBeEmptyDOMElement();
  });

  it('keeps the header meta section an empty placeholder (Minijob has no planned revenue/hours), with no stray "undefined"', () => {
    const { container } = render(
      <MinijobForm branch={branch} calendarWeek={calendarWeek} rows={[makeRow()]} dayTotals={zeroDayTotals()} />,
    );

    const meta = container.querySelector('.print-header-meta');
    expect(meta).not.toBeNull();
    expect(meta).toBeEmptyDOMElement();
    expect(container.textContent).not.toMatch(/undefined/);
  });

  it('pins the exact Minijob title/retention string, distinct from the Voll-/Teilzeit form', () => {
    render(<MinijobForm branch={branch} calendarWeek={calendarWeek} rows={[]} dayTotals={zeroDayTotals()} />);

    expect(
      screen.getByText('Personaleinsatzplanung (PEP): geringfügig Beschäftigte (Aufbewahrungsfrist: 2 Jahre)'),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('Personaleinsatzplanung (PEP): Voll- und Teilzeitkräfte (Aufbewahrungsfrist: nur aktueller Monat)'),
    ).not.toBeInTheDocument();
  });

  it('renders the Soll-Std./Ist-Std. labels and one Zeit/Std. sub-header pair per employee slot', () => {
    render(
      <MinijobForm branch={branch} calendarWeek={calendarWeek} rows={[makeRow()]} dayTotals={zeroDayTotals()} />,
    );

    expect(screen.getByText('Soll-Std.')).toBeInTheDocument();
    expect(screen.getByText('Ist-Std.')).toBeInTheDocument();
    expect(screen.getAllByText('Zeit')).toHaveLength(9);
    expect(screen.getAllByText('Std.')).toHaveLength(9);
  });

  it('renders each weekday as exactly 4 physical rows and always exactly 2 break rows, each carrying its own break data, with blank Ist-Std when the day total is 0', () => {
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
    const row = makeRow({ days });
    const dayTotals = zeroDayTotals();
    dayTotals.Montag = 7.5;

    const { container } = render(
      <MinijobForm branch={branch} calendarWeek={calendarWeek} rows={[row]} dayTotals={dayTotals} />,
    );

    const rows = tbodyRows(container);
    expect(rows).toHaveLength(WEEKDAYS.length * 4 + 1);

    const [summaryRow, weekdayRow, breakRow1, breakRow2] = rows;

    expect(summaryRow.classList.contains('break-row')).toBe(false);
    expect(summaryRow).toHaveTextContent(formatDateShort(dateForWeekday(calendarWeek, 'Montag')));
    expect(summaryRow).toHaveTextContent(formatHours(7.5));
    expect(summaryRow.querySelector('.weekday-label')).toBeNull();
    const summarySlotCells = Array.from(summaryRow.querySelectorAll('td')).slice(2);
    expect(summarySlotCells).toHaveLength(18);
    summarySlotCells.forEach((td) => expect(td).toBeEmptyDOMElement());

    expect(weekdayRow.classList.contains('break-row')).toBe(false);
    expect(weekdayRow).toHaveTextContent('Montag');
    expect(within(weekdayRow).getByText('08:00-16:00')).toBeInTheDocument();
    expect(within(weekdayRow).getByText('7,50')).toBeInTheDocument();

    expect(breakRow1.classList.contains('break-row')).toBe(true);
    expect(breakRow1.querySelector('.pause-label')).toHaveTextContent('Pause');
    expect(within(breakRow1).getByText('12:00')).toBeInTheDocument();
    expect(within(breakRow1).getByText('0,50')).toBeInTheDocument();

    expect(breakRow2.classList.contains('break-row')).toBe(true);
    expect(breakRow2.querySelector('.pause-label')).toHaveTextContent('Pause');
    const breakRow2DataCells = Array.from(breakRow2.querySelectorAll('td')).slice(1);
    expect(breakRow2DataCells).toHaveLength(18);
    expect(breakRow2DataCells[0]).toHaveTextContent('');
    expect(breakRow2DataCells[1]).toHaveTextContent('0,25');
    breakRow2DataCells.slice(2).forEach((td) => expect(td).toHaveTextContent(''));

    const dienstagSummary = rows[4];
    const dienstagLabelCells = Array.from(dienstagSummary.querySelectorAll('td.column-label'));
    expect(dienstagLabelCells).toHaveLength(2);
    expect(dienstagLabelCells[1]).toHaveTextContent('');
  });

  it('shows the weekly total per employee in the Gesamtstunden row, blank for padding slots', () => {
    const rows = [
      makeRow({ employee: makeEmployee({ lastName: 'Bauer' }), totalHoursWeek: '12,50' }),
      makeRow({ employee: makeEmployee({ lastName: 'Klein' }), totalHoursWeek: '9,00' }),
    ];
    render(<MinijobForm branch={branch} calendarWeek={calendarWeek} rows={rows} dayTotals={zeroDayTotals()} />);

    const totalsRow = screen.getByText('Gesamtstunden (gearbeitet)').closest('tr')!;
    const totalCells = Array.from(totalsRow.querySelectorAll('td')).slice(1);
    expect(totalCells).toHaveLength(9);
    expect(totalCells[0]).toHaveTextContent('12,50');
    expect(totalCells[1]).toHaveTextContent('9,00');
    expect(totalCells[2]).toHaveTextContent('');
  });

  it('renders the ML/VL signature fields', () => {
    render(<MinijobForm branch={branch} calendarWeek={calendarWeek} rows={[]} dayTotals={zeroDayTotals()} />);

    expect(screen.getByText('Unterschrift ML')).toBeInTheDocument();
    expect(screen.getByText('Unterschrift VL')).toBeInTheDocument();
  });
});
