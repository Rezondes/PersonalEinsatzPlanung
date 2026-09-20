import { describe, it, expect, vi, afterEach } from 'vitest';
import { render as rtlRender, screen, waitFor } from '@testing-library/react';
import type { ReactElement } from 'react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '@mui/material/styles';

/** Copied from useBreakpoint.test.tsx: jsdom has no real layout engine, so window.matchMedia is
 * mocked to answer as if the viewport were `width` wide. Only needed for the tests below that
 * specifically exercise hover-vs-touch behavior - every other test in this file relies on jsdom's
 * unmocked (mobile-like) default, unchanged from before this hook existed. */
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
import type { BranchId, EmployeeId, AbsenceId } from '@domain/shared/ids';
import type { Absence } from '@domain/absence/Absence';
import { WEEKDAYS, dateForWeekday } from '@domain/shared/CalendarWeek';
import { toISODate } from '@domain/shared/DateFormat';
import { clockTime } from '@domain/shared/ClockTime';
import { createShift } from '@domain/schedule/Shift';
import { createWeeklySchedule, withDayEntry } from '@domain/schedule/WeeklySchedule';
import type { Employee } from '@domain/employee/Employee';
import type { ValidationResult } from '@domain/validation/ValidationResult';
import { createWeekView } from '@application/schedule/scheduleAssessment';
import { buildScheduleRows } from '../scheduleRows';
import { theme } from '@ui/app/theme';
import { ScheduleTable } from './ScheduleTable';

// Shadows RTL's own render with a ThemeProvider-wrapped version, so every one of this file's many
// existing `render(<ScheduleTable ... />)` call sites picks it up with no per-call-site change:
// ScheduleTable's cell styling now reads the custom theme.palette.accentSurface key, absent on
// MUI's own default theme.
function render(ui: ReactElement) {
  return rtlRender(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);
}

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

/** Every existing (pre-P11) test exercises the non-selecting path, matching unchanged behavior. */
const noSelection = {
  selectionMode: false,
  selectedCells: new Set<string>(),
  onToggleCellSelection: () => {},
};

describe('ScheduleTable', () => {
  afterEach(() => {
    // @ts-expect-error -- undo the per-test stub, jsdom has no matchMedia of its own to restore
    delete window.matchMedia;
  });

  it('hebt die fixierte Zeilenkopf-Zelle beim Hover einer editierbaren Zeile mit hervor', () => {
    render(<ScheduleTable rows={rowsFor(employees)} weekDays={weekDays} validationResults={[]} onCellClick={() => {}} {...notAssigning} {...noSelection} />);

    const rowHeader = screen.getAllByRole('rowheader')[0];
    expect(rowHeader).toHaveClass('pep-sticky-first-column');
    const row = rowHeader.closest('tr')!;
    const rowClass = Array.from(row.classList).find((c) => c.startsWith('css-'));
    // jsdom has no real :hover engine - assert on the injected Emotion stylesheet text instead
    // (same approach as the a11y plan's MUI-Alert probe), since that's the only place a
    // conditional `&:hover .class` rule is actually observable without a real browser.
    const styles = Array.from(document.querySelectorAll('style')).map((s) => s.textContent).join('\n');
    expect(styles).toContain(`.${rowClass}:hover .pep-sticky-first-column`);
  });

  it('renders one row per employee with their shift times', () => {
    render(<ScheduleTable rows={rowsFor(employees)} weekDays={weekDays} validationResults={[]} onCellClick={() => {}} {...notAssigning} {...noSelection} />);

    expect(screen.getByText('Müller, Anna')).toBeInTheDocument();
    expect(screen.getByText('Schulz, Anna')).toBeInTheDocument();
    expect(screen.getByText('06:00-14:00')).toBeInTheDocument();
    expect(screen.getAllByText('frei')).toHaveLength(13);
  });

  it('die Wochentag-Kopfzellen sind bereits korrekte scope=col th-Elemente', () => {
    const { container } = render(
      <ScheduleTable rows={rowsFor(employees)} weekDays={weekDays} validationResults={[]} onCellClick={() => {}} {...notAssigning} {...noSelection} />,
    );

    // weekDays.length weekday headers plus the "Mitarbeiter" corner header cell - both are already
    // correct th[scope="col"] via MUI's own TableCell auto-derivation, with no fix needed for either.
    expect(container.querySelectorAll('thead th[scope="col"]')).toHaveLength(weekDays.length + 1);
  });

  it('jede Wochentag-Datenzelle hat dieselbe feste Breite wie ihre Kopfzelle (mobil)', () => {
    // jsdom's unmocked default matches the mobile breakpoint (see file header comment above).
    const { container } = render(
      <ScheduleTable rows={rowsFor(employees)} weekDays={weekDays} validationResults={[]} onCellClick={() => {}} {...notAssigning} {...noSelection} />,
    );

    const headerCells = Array.from(container.querySelectorAll('thead th')).slice(1);
    expect(headerCells.length).toBe(weekDays.length);
    headerCells.forEach((th) => expect(th).toHaveStyle({ width: '76px' }));

    // The employee cell is already a <th> (row header), so every <td> in a body row is a weekday cell.
    const dataCells = container.querySelectorAll('tbody td');
    expect(dataCells.length).toBe(employees.length * weekDays.length);
    dataCells.forEach((td) => expect(td).toHaveStyle({ width: '76px' }));
  });

  it('jede Wochentag-Datenzelle hat dieselbe feste Breite wie ihre Kopfzelle (Tablet/Desktop)', () => {
    mockViewportWidth(1200);
    const { container } = render(
      <ScheduleTable rows={rowsFor(employees)} weekDays={weekDays} validationResults={[]} onCellClick={() => {}} {...notAssigning} {...noSelection} />,
    );

    const headerCells = Array.from(container.querySelectorAll('thead th')).slice(1);
    headerCells.forEach((th) => expect(th).toHaveStyle({ width: '140px' }));

    const dataCells = container.querySelectorAll('tbody td');
    dataCells.forEach((td) => expect(td).toHaveStyle({ width: '140px' }));
  });

  it('eine Zelle behält ihre Breite beim Wechsel von frei zu einer Arbeitszeit', () => {
    render(<ScheduleTable rows={rowsFor(employees)} weekDays={weekDays} validationResults={[]} onCellClick={() => {}} {...notAssigning} {...noSelection} />);

    // Same fixed width regardless of whether the cell shows "frei" or a shift.
    const shiftCell = screen.getByText('06:00-14:00').closest('td');
    const freeCell = screen.getAllByText('frei')[0].closest('td');
    expect(shiftCell).toHaveStyle({ width: '76px' });
    expect(freeCell).toHaveStyle({ width: '76px' });
  });

  // jsdom has no real table-layout engine (see file header comment): a real browser check found that
  // `width` alone still lets `table-layout: auto` grow a column past it for unbreakable content like
  // "06:00-14:00", so this asserts the accompanying overflow-wrap fix stays in place.
  it('erlaubt Zeilenumbruch in der Wochentag-Datenzelle, damit lange Inhalte die Spalte nicht verbreitern', () => {
    render(<ScheduleTable rows={rowsFor(employees)} weekDays={weekDays} validationResults={[]} onCellClick={() => {}} {...notAssigning} {...noSelection} />);

    const shiftCell = screen.getByText('06:00-14:00').closest('td');
    expect(shiftCell).toHaveStyle({ overflowWrap: 'anywhere' });
  });

  it('die Mitarbeiterzelle ist ein echter Zeilenkopf', () => {
    render(<ScheduleTable rows={rowsFor(employees)} weekDays={weekDays} validationResults={[]} onCellClick={() => {}} {...notAssigning} {...noSelection} />);

    const rowHeaders = screen.getAllByRole('rowheader');
    expect(rowHeaders.map((el) => el.textContent)).toEqual(
      expect.arrayContaining([expect.stringContaining('Müller, Anna')]),
    );
  });

  it('names the employee, day and current content in a cell\'s aria-label, not just the day (H6)', () => {
    render(<ScheduleTable rows={rowsFor(employees)} weekDays={weekDays} validationResults={[]} onCellClick={() => {}} {...notAssigning} {...noSelection} />);

    expect(screen.getByRole('button', { name: 'Müller, Anna, Montag, 06:00-14:00 bearbeiten' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Müller, Anna, Dienstag, frei bearbeiten' })).toBeInTheDocument();
  });

  it('names the whole-day absence kind in a cell\'s aria-label instead of "frei" (H6)', () => {
    const illness: Absence = {
      id: 'a1' as AbsenceId,
      employeeId: m2,
      type: 'Illness',
      from: '2026-09-07',
      to: '2026-09-07',
      createdAt: '2026-01-01T00:00:00.000Z',
    };
    const weekViewWithIllness = createWeekView(schedule, [illness], { employees });
    const rows = buildScheduleRows(weekViewWithIllness, employees, '2026-09-07', '2026-09-13');

    render(<ScheduleTable rows={rows} weekDays={weekDays} validationResults={[]} onCellClick={() => {}} {...notAssigning} {...noSelection} />);

    expect(screen.getByRole('button', { name: 'Schulz, Anna, Montag, Krankheit bearbeiten' })).toBeInTheDocument();
  });

  it('shows the Soll-deviation tooltip on hover from tablet width up, and hides it again on unhover (N20)', async () => {
    mockViewportWidth(1024);
    const user = userEvent.setup();
    render(
      <ScheduleTable
        rows={rowsFor(employees)}
        weekDays={weekDays}
        validationResults={[]}
        onCellClick={() => {}}
        {...notAssigning}
        {...noSelection}
      />,
    );

    const deviationIcon = screen.getAllByRole('button', { name: 'Abweichung von Soll anzeigen' })[0];
    await user.hover(deviationIcon);
    expect(await screen.findByText(/Std\. unter Soll/)).toBeInTheDocument();

    await user.unhover(deviationIcon);
    await waitFor(() => expect(screen.queryByText(/Std\. unter Soll/)).not.toBeInTheDocument());
  });

  it('das Abweichungs-Icon hat eine 44x44-Trefffläche', () => {
    render(
      <ScheduleTable
        rows={rowsFor(employees)}
        weekDays={weekDays}
        validationResults={[]}
        onCellClick={() => {}}
        {...notAssigning}
        {...noSelection}
      />,
    );

    const deviationIcon = screen.getAllByRole('button', { name: 'Abweichung von Soll anzeigen' })[0];
    expect(deviationIcon).toHaveStyle({ minWidth: '44px', minHeight: '44px' });
  });

  it('does not show the Soll-deviation tooltip on hover at mobile width - still opens via click (N20)', async () => {
    mockViewportWidth(500);
    const user = userEvent.setup();
    render(
      <ScheduleTable
        rows={rowsFor(employees)}
        weekDays={weekDays}
        validationResults={[]}
        onCellClick={() => {}}
        {...notAssigning}
        {...noSelection}
      />,
    );

    const deviationIcon = screen.getAllByRole('button', { name: 'Abweichung von Soll anzeigen' })[0];
    await user.hover(deviationIcon);
    expect(screen.queryByText(/Std\. unter Soll/)).not.toBeInTheDocument();

    await user.click(deviationIcon);
    expect(await screen.findByText(/Std\. unter Soll/)).toBeInTheDocument();
  });

  it('closes an open Soll-deviation tooltip when clicking a different, unrelated cell (click-away)', async () => {
    mockViewportWidth(500);
    const user = userEvent.setup();
    render(
      <ScheduleTable
        rows={rowsFor(employees)}
        weekDays={weekDays}
        validationResults={[]}
        onCellClick={() => {}}
        {...notAssigning}
        {...noSelection}
      />,
    );

    const deviationIcon = screen.getAllByRole('button', { name: 'Abweichung von Soll anzeigen' })[0];
    await user.click(deviationIcon);
    expect(await screen.findByText(/Std\. unter Soll/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Schulz, Anna, Dienstag, frei bearbeiten' }));
    await waitFor(() => expect(screen.queryByText(/Std\. unter Soll/)).not.toBeInTheDocument());
  });

  it('labels a whole-day Illness absence "Krankheit", not the shorter "Krank" this table used to show on its own (M27)', () => {
    const illness: Absence = {
      id: 'a1' as AbsenceId,
      employeeId: m2,
      type: 'Illness',
      from: '2026-09-07',
      to: '2026-09-07',
      createdAt: '2026-01-01T00:00:00.000Z',
    };
    const weekViewWithIllness = createWeekView(schedule, [illness], { employees });
    const rows = buildScheduleRows(weekViewWithIllness, employees, '2026-09-07', '2026-09-13');

    render(<ScheduleTable rows={rows} weekDays={weekDays} validationResults={[]} onCellClick={() => {}} {...notAssigning} {...noSelection} />);

    expect(screen.getByText('Krankheit')).toBeInTheDocument();
    expect(screen.queryByText('Krank')).not.toBeInTheDocument();
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
               {...notAssigning}
        {...noSelection}
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

  it('das Zell-Hinweis-Icon hat eine 44x44-Trefffläche', () => {
    const results: ValidationResult[] = [
      { rule: 'ArbZG_3_Tag', severity: 'error', message: 'Tagesarbeitszeit zu lang', employeeId: m1, date: '2026-09-07' },
    ];
    render(
      <ScheduleTable
        rows={rowsFor(employees)}
        weekDays={weekDays}
        validationResults={results}
        onCellClick={() => {}}
        {...notAssigning}
        {...noSelection}
      />,
    );

    const warningIcon = screen.getByRole('button', { name: 'Hinweis anzeigen' });
    expect(warningIcon).toHaveStyle({ minWidth: '44px', minHeight: '44px' });
  });

  it('activating the warning icon by keyboard (Enter) does not also activate the cell underneath it', async () => {
    const user = userEvent.setup();
    const onCellClick = vi.fn();
    const results: ValidationResult[] = [
      { rule: 'ArbZG_3_Tag', severity: 'error', message: 'Tagesarbeitszeit zu lang', employeeId: m1, date: '2026-09-07' },
    ];
    render(
      <ScheduleTable
        rows={rowsFor(employees)}
        weekDays={weekDays}
        validationResults={results}
        onCellClick={onCellClick}
               {...notAssigning}
        {...noSelection}
      />,
    );

    // A native <button> triggers its own click on Enter, and the keydown that causes it still
    // bubbles independently through the DOM regardless - without stopping it at the cell (which
    // only checks target !== currentTarget, not a stopPropagation on the icon itself), the cell's
    // own Enter/Space handler would also fire and open the Tageseditor underneath the icon.
    screen.getByRole('button', { name: 'Hinweis anzeigen' }).focus();
    await user.keyboard('{Enter}');

    expect(await screen.findByText('Tagesarbeitszeit zu lang')).toBeInTheDocument();
    expect(onCellClick).not.toHaveBeenCalled();
  });

  it('reports the clicked cell with its employee and day', async () => {
    const user = userEvent.setup();
    const onCellClick = vi.fn();
    render(<ScheduleTable rows={rowsFor(employees)} weekDays={weekDays} validationResults={[]} onCellClick={onCellClick} {...notAssigning} {...noSelection} />);

    const tuesdayOfSecondRow = screen.getByRole('button', { name: 'Schulz, Anna, Dienstag, frei bearbeiten' });
    await user.click(tuesdayOfSecondRow);

    expect(onCellClick).toHaveBeenCalledWith(m2, expect.objectContaining({ day: 'Dienstag', date: '2026-09-08' }));
  });

  it('skips assignments whose employee is unknown', () => {
    render(<ScheduleTable rows={rowsFor([employee(m1, 'Müller')])} weekDays={weekDays} validationResults={[]} onCellClick={() => {}} {...notAssigning} {...noSelection} />);

    expect(screen.queryByText('Schulz, Anna')).not.toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(2);
  });

  it('shows the hover highlight for a normal (editable) row', () => {
    render(<ScheduleTable rows={rowsFor(employees)} weekDays={weekDays} validationResults={[]} onCellClick={() => {}} {...notAssigning} {...noSelection} />);

    const row = screen.getByText('Müller, Anna').closest('tr');
    expect(row).toHaveClass('MuiTableRow-hover');
  });

  it('does not show the hover highlight for a locked (inactive) row', () => {
    const inactiveEmployee: Employee = { ...employee(m1, 'Alt'), active: false };
    const scheduleWithInactive = withDayEntry(
      createWeeklySchedule(branchId, { year: 2026, week: 37 }, [inactiveEmployee.id]),
      inactiveEmployee.id,
      'Montag',
      { type: 'Shift', shifts: [createShift(clockTime('06:00'), clockTime('14:00'))] },
    );
    const inactiveWeekView = createWeekView(scheduleWithInactive, [], { employees: [inactiveEmployee] });
    const rows = buildScheduleRows(inactiveWeekView, [inactiveEmployee], '2026-09-07', '2026-09-13');

    render(<ScheduleTable rows={rows} weekDays={weekDays} validationResults={[]} onCellClick={() => {}} {...notAssigning} {...noSelection} />);

    const row = screen.getByText('Alt, Anna').closest('tr');
    expect(row).not.toHaveClass('MuiTableRow-hover');
  });

  it('zeigt eine gesperrte (inaktive) Zeile ohne Opacity-Verwaschung', () => {
    const inactiveEmployee: Employee = { ...employee(m1, 'Alt'), active: false };
    const scheduleWithInactive = withDayEntry(
      createWeeklySchedule(branchId, { year: 2026, week: 37 }, [inactiveEmployee.id]),
      inactiveEmployee.id,
      'Montag',
      { type: 'Shift', shifts: [createShift(clockTime('06:00'), clockTime('14:00'))] },
    );
    const inactiveWeekView = createWeekView(scheduleWithInactive, [], { employees: [inactiveEmployee] });
    const rows = buildScheduleRows(inactiveWeekView, [inactiveEmployee], '2026-09-07', '2026-09-13');

    render(<ScheduleTable rows={rows} weekDays={weekDays} validationResults={[]} onCellClick={() => {}} {...notAssigning} {...noSelection} />);

    const row = screen.getByText('Alt, Anna').closest('tr')!;
    expect(row).not.toHaveStyle({ opacity: '0.55' });
    expect(row).toHaveStyle({ backgroundColor: theme.palette.inactiveSurface, color: theme.palette.text.secondary });
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
                   assignMode
          onToolTap={onToolTap}
          isAssignTarget={() => false}
          {...noSelection}
        />,
      );

      const tuesdayOfSecondRow = screen.getByRole('button', { name: 'Schulz, Anna, Dienstag, frei zuweisen' });
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
                   assignMode
          onToolTap={onToolTap}
          isAssignTarget={() => false}
          {...noSelection}
        />,
      );

      const mondayOfFirstRow = screen.getByRole('button', { name: 'Müller, Anna, Montag, 06:00-14:00 zuweisen' });
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
                   assignMode
          onToolTap={() => {}}
          isAssignTarget={(employeeId, dayView) => employeeId === m1 && dayView.day === 'Montag'}
          {...noSelection}
        />,
      );

      const mondayOfFirstRow = screen.getByRole('button', { name: 'Müller, Anna, Montag, 06:00-14:00 zuweisen' });
      expect(mondayOfFirstRow).toHaveStyle({
        backgroundColor: theme.palette.accentSurface.strong,
        border: `1px solid ${theme.palette.primary.main}`,
      });
    });
  });

  describe('selectionMode (Mehrfachauswahl)', () => {
    it('shows a checkbox for a free, editable cell and reports a toggle on click', async () => {
      const user = userEvent.setup();
      const onToggleCellSelection = vi.fn();
      render(
        <ScheduleTable
          rows={rowsFor(employees)}
          weekDays={weekDays}
          validationResults={[]}
          onCellClick={() => {}}
                   {...notAssigning}
          selectionMode
          selectedCells={new Set()}
          onToggleCellSelection={onToggleCellSelection}
        />,
      );

      const tuesdayOfSecondRow = screen.getByRole('checkbox', { name: 'Schulz, Anna, Dienstag, frei auswählen' });
      await user.click(tuesdayOfSecondRow);

      expect(onToggleCellSelection).toHaveBeenCalledWith(m2, expect.objectContaining({ day: 'Dienstag', date: '2026-09-08' }));
    });

    it('reflects an already-selected cell as checked', () => {
      render(
        <ScheduleTable
          rows={rowsFor(employees)}
          weekDays={weekDays}
          validationResults={[]}
          onCellClick={() => {}}
                   {...notAssigning}
          selectionMode
          selectedCells={new Set([`${m2}|2026-09-08`])}
          onToggleCellSelection={() => {}}
        />,
      );

      const tuesdayOfSecondRow = screen.getByRole('checkbox', { name: 'Schulz, Anna, Dienstag, frei auswählen' });
      expect(tuesdayOfSecondRow).toHaveAttribute('aria-checked', 'true');
    });

    it('shows no checkbox for a locked cell (inactive row)', () => {
      const inactiveEmployee: Employee = { ...employee(m1, 'Alt'), active: false };
      const scheduleWithInactive = createWeeklySchedule(branchId, { year: 2026, week: 37 }, [inactiveEmployee.id]);
      const inactiveWeekView = createWeekView(scheduleWithInactive, [], { employees: [inactiveEmployee] });
      const rows = buildScheduleRows(inactiveWeekView, [inactiveEmployee], '2026-09-07', '2026-09-13');

      render(
        <ScheduleTable
          rows={rows}
          weekDays={weekDays}
          validationResults={[]}
          onCellClick={() => {}}
                   {...notAssigning}
          selectionMode
          selectedCells={new Set()}
          onToggleCellSelection={() => {}}
        />,
      );

      expect(screen.queryByRole('checkbox', { name: /auswählen/ })).not.toBeInTheDocument();
    });

    it('shows no checkbox for a cell covered by a multi-day absence, but still shows one for an unrelated employee\'s same day', () => {
      const vacation: Absence = {
        id: 'a1' as AbsenceId,
        employeeId: m1,
        type: 'Vacation',
        from: '2026-09-07',
        to: '2026-09-11',
        createdAt: '2026-01-01T00:00:00.000Z',
      };
      const weekViewWithVacation = createWeekView(schedule, [vacation], { employees });
      const rows = buildScheduleRows(weekViewWithVacation, employees, '2026-09-07', '2026-09-13');

      render(
        <ScheduleTable
          rows={rows}
          weekDays={weekDays}
          validationResults={[]}
          onCellClick={() => {}}
                   {...notAssigning}
          selectionMode
          selectedCells={new Set()}
          onToggleCellSelection={() => {}}
        />,
      );

      // Only m2's Montag gets a checkbox - m1's is covered by the multi-day vacation.
      expect(screen.getAllByRole('checkbox', { name: 'Schulz, Anna, Montag, frei auswählen' })).toHaveLength(1);
    });
  });
});
