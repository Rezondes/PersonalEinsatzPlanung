import { describe, it, expect } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { BranchId, EmployeeId } from '@domain/shared/ids';
import type { ValidationResult } from '@domain/validation/ValidationResult';
import type { Employee } from '@domain/employee/Employee';
import { ValidationNotices } from './ValidationNotices';

const employee1: Employee = {
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

const employee2: Employee = {
  id: 'e2' as EmployeeId,
  branchId: 'b1' as BranchId,
  lastName: 'Beispiel',
  firstName: 'Hans',
  jobTitle: 'Verkäufer/-in',
  employmentType: { type: 'FullTime', weeklyHours: 37.5 },
  vacationEntitlementPerYear: 24,
  holidayVacationHours: 8,
  active: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const employeeList: Employee[] = [employee1, employee2];

function triggerButton() {
  return screen.getByRole('button');
}

describe('ValidationNotices', () => {
  it('renders nothing when there are no results', () => {
    const { container } = render(<ValidationNotices results={[]} employeeList={employeeList} />);

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('shows the pinned trigger label and opens a Popover with employee, date and message on click', async () => {
    const user = userEvent.setup();
    const results: ValidationResult[] = [
      {
        rule: 'r1',
        severity: 'error',
        message: 'Schicht überschneidet sich.',
        employeeId: employee1.id,
        date: '2026-09-07',
      },
      {
        rule: 'r2',
        severity: 'warning',
        message: 'Pause fehlt.',
        employeeId: employee2.id,
        date: '2026-09-08',
      },
    ];
    render(<ValidationNotices results={results} employeeList={employeeList} />);

    const button = triggerButton();
    expect(button).toHaveTextContent('1 Fehler, 1 Warnung(en) anzeigen');

    await user.click(button);

    const alerts = await screen.findAllByRole('alert');
    expect(alerts).toHaveLength(2);

    const errorAlert = alerts.find((a) => a.className.includes('MuiAlert-standardError'));
    const warningAlert = alerts.find((a) => a.className.includes('MuiAlert-standardWarning'));
    expect(errorAlert).toBeDefined();
    expect(warningAlert).toBeDefined();

    const errorTitle = errorAlert!.querySelector('.MuiAlertTitle-root')!;
    expect(errorTitle.textContent).toBe('Muster, Erika · 07.09.2026');
    expect(errorAlert).toHaveTextContent('Schicht überschneidet sich.');

    const warningTitle = warningAlert!.querySelector('.MuiAlertTitle-root')!;
    expect(warningTitle.textContent).toBe('Beispiel, Hans · 08.09.2026');
    expect(warningAlert).toHaveTextContent('Pause fehlt.');

    expect(button).toHaveTextContent('1 Fehler, 1 Warnung(en) ausblenden');
  });

  it('renders an empty employee name instead of crashing for an unmatched employeeId', async () => {
    const user = userEvent.setup();
    const results: ValidationResult[] = [
      {
        rule: 'r1',
        severity: 'error',
        message: 'Etwas stimmt nicht.',
        employeeId: 'unknown' as EmployeeId,
        date: '2026-09-07',
      },
    ];
    render(<ValidationNotices results={results} employeeList={employeeList} />);

    await user.click(triggerButton());

    const alert = await screen.findByRole('alert');
    const title = alert.querySelector('.MuiAlertTitle-root')!;
    expect(title.textContent).toBe(' · 07.09.2026');
    expect(alert).toHaveTextContent('Etwas stimmt nicht.');
  });

  it('omits the date suffix entirely when a result has no date', async () => {
    const user = userEvent.setup();
    const results: ValidationResult[] = [
      {
        rule: 'r1',
        severity: 'warning',
        message: 'Ohne Datum.',
        employeeId: employee1.id,
      },
    ];
    render(<ValidationNotices results={results} employeeList={employeeList} />);

    await user.click(triggerButton());

    const alert = await screen.findByRole('alert');
    const title = within(alert).getByText('Muster, Erika');
    expect(title).toHaveTextContent('Muster, Erika');
    expect(title.textContent).toBe('Muster, Erika');
    expect(alert.textContent).not.toContain('·');
  });

  it('calls renderTrigger instead of rendering the default Button, and the custom trigger opens the same Popover', async () => {
    const user = userEvent.setup();
    const results: ValidationResult[] = [
      { rule: 'r1', severity: 'error', message: 'Fehler A.', employeeId: employee1.id, date: '2026-09-07' },
      { rule: 'r2', severity: 'warning', message: 'Warnung B.', employeeId: employee2.id, date: '2026-09-08' },
    ];
    render(
      <ValidationNotices
        results={results}
        employeeList={employeeList}
        renderTrigger={({ errorCount, warningCount, onClick }) => (
          <button type="button" data-testid="custom-trigger" onClick={onClick}>
            {errorCount}/{warningCount}
          </button>
        )}
      />,
    );

    expect(screen.getByTestId('custom-trigger')).toHaveTextContent('1/1');
    expect(screen.queryByRole('button', { name: /Fehler, .* Warnung/ })).not.toBeInTheDocument();

    await user.click(screen.getByTestId('custom-trigger'));

    const alerts = await screen.findAllByRole('alert');
    expect(alerts).toHaveLength(2);
    expect(screen.getByText('Fehler A.')).toBeInTheDocument();
    expect(screen.getByText('Warnung B.')).toBeInTheDocument();
  });

  it('closes the Popover on Escape and reverts the trigger label back to anzeigen', async () => {
    const user = userEvent.setup();
    const results: ValidationResult[] = [
      { rule: 'r1', severity: 'error', message: 'Fehler A.', employeeId: employee1.id, date: '2026-09-07' },
    ];
    render(<ValidationNotices results={results} employeeList={employeeList} />);

    const button = triggerButton();
    await user.click(button);
    await screen.findByRole('alert');
    expect(button).toHaveTextContent('1 Fehler, 0 Warnung(en) ausblenden');

    await user.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
    expect(button).toHaveTextContent('1 Fehler, 0 Warnung(en) anzeigen');
  });
});
