import { describe, it, expect, vi } from 'vitest';
import type { ComponentProps } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '@mui/material/styles';
import type { BranchId, EmployeeId } from '@domain/shared/ids';
import type { Employee } from '@domain/employee/Employee';
import { createWeeklySchedule } from '@domain/schedule/WeeklySchedule';
import { theme } from '@ui/app/theme';
import { WeekSidePanel, WEEK_SIDE_PANEL_ID } from './WeekSidePanel';

// ScheduleHeaderFields saves through services; nothing here blurs a field, so a stub is enough.
vi.mock('@infrastructure/services', () => ({
  services: { schedule: { save: vi.fn() } },
}));

const employee: Employee = {
  id: 'e1' as EmployeeId,
  branchId: 'b1' as BranchId,
  lastName: 'Muster',
  firstName: 'Erika',
  jobTitle: 'Verkäufer/-in',
  employmentType: { type: 'FullTime', weeklyHours: 37.5 },
  vacationEntitlementPerYear: 24,
  holidayVacationHours: 8,
  active: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

type Props = ComponentProps<typeof WeekSidePanel>;

function renderPanel(overrides: Partial<Props> = {}) {
  const props: Props = {
    istSollText: '30 Std. / 37,5 Std.',
    notYetScheduledText: '2',
    validationResults: [
      { rule: 'r1', severity: 'error', message: 'Ruhezeit unterschritten.', employeeId: employee.id, date: '2026-09-07' },
    ],
    validationSummaryText: '1 Fehler',
    employeeList: [employee],
    schedule: createWeeklySchedule('b1' as BranchId, { year: 2026, week: 37 }, []),
    onScheduleSaved: vi.fn(),
    onError: vi.fn(),
    onCarryOver: vi.fn(),
    onCopyPreviousWeek: vi.fn(),
    onPrint: vi.fn(),
    printAvailable: true,
    ...overrides,
  };
  render(
    <ThemeProvider theme={theme}>
      <WeekSidePanel {...props} />
    </ThemeProvider>,
  );
  return props;
}

describe('WeekSidePanel', () => {
  it('zeigt die drei Abschnitte', async () => {
    const user = userEvent.setup();
    const props = renderPanel();

    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(headings).toEqual(['Kennzahlen', 'Wochenangaben', 'Aktionen']);

    // Kennzahlen: Ist/Soll, ArbZG findings (opening their list), Nicht eingeplant.
    expect(screen.getByText('Ist / Soll')).toBeInTheDocument();
    expect(screen.getByText('30 Std. / 37,5 Std.')).toBeInTheDocument();
    expect(screen.getByText('Nicht eingeplant')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    const findings = screen.getByRole('button', { name: '1 Fehler' });
    expect(findings).toHaveAttribute('aria-expanded', 'false');
    await user.click(findings);
    expect(await screen.findByText('Ruhezeit unterschritten.')).toBeInTheDocument();
    await user.keyboard('{Escape}');

    // Wochenangaben: the two ScheduleHeaderFields inputs.
    expect(screen.getByRole('textbox', { name: 'Geplanter Wochenumsatz' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Geplante Wochenstunden' })).toBeInTheDocument();

    // Aktionen: each button reports through its own callback.
    await user.click(screen.getByRole('button', { name: 'Vorwoche übertragen' }));
    await user.click(screen.getByRole('button', { name: 'Vorwoche kopieren' }));
    await user.click(screen.getByRole('button', { name: 'Drucken' }));
    expect(props.onCarryOver).toHaveBeenCalledTimes(1);
    expect(props.onCopyPreviousWeek).toHaveBeenCalledTimes(1);
    expect(props.onPrint).toHaveBeenCalledTimes(1);
  });

  it('zeigt Drucken nur, wenn ein Plan existiert', () => {
    renderPanel({ printAvailable: false, schedule: null });

    expect(screen.queryByRole('button', { name: 'Drucken' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Vorwoche übertragen' })).toBeInTheDocument();
  });

  it('ist ein benannter complementary-Bereich', () => {
    renderPanel();

    const panel = screen.getByRole('complementary', { name: 'Wochendetails' });
    expect(panel).toHaveAttribute('id', WEEK_SIDE_PANEL_ID);
    expect(panel).toHaveStyle({ width: '280px', overflowY: 'auto' });
    expect(within(panel).getByRole('heading', { name: 'Kennzahlen' })).toBeInTheDocument();
  });
});
