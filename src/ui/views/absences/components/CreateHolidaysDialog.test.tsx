import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { BranchId, EmployeeId } from '@domain/shared/ids';
import type { Branch } from '@domain/branch/Branch';
import type { Employee } from '@domain/employee/Employee';
import type { Absence } from '@domain/absence/Absence';
import { holidaysForYearAndFederalState } from '@infrastructure/holidays/germanHolidays';
import { services } from '@infrastructure/services';
import { CreateHolidaysDialog } from './CreateHolidaysDialog';

vi.mock('@infrastructure/services', () => ({
  services: { holidayBulkCreation: { createHolidaysForYear: vi.fn() } },
}));

const createHolidaysForYearMock = vi.mocked(services.holidayBulkCreation.createHolidaysForYear);

const branchId = 'b1' as BranchId;

const branch: Branch = {
  id: branchId,
  name: 'Filiale Nord',
  branchNumber: '001',
  address: { street: 'Hauptstraße', houseNumber: '12', postalCode: '30159', city: 'Hannover' },
  logoBase64: null,
  federalState: 'Bayern',
  allowedOpenSundays: [],
  active: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function employee(id: EmployeeId): Employee {
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
  };
}

const employees = [employee('e1' as EmployeeId)];

function renderDialog(overrides: { employees?: Employee[]; absences?: Absence[]; onClose?: () => void; onApplied?: (r: { created: number; skipped: number }) => void; onError?: (e: unknown, context?: string) => void } = {}) {
  const props = {
    branch,
    employees: overrides.employees ?? employees,
    absences: overrides.absences ?? [],
    onClose: overrides.onClose ?? vi.fn(),
    onApplied: overrides.onApplied ?? vi.fn(),
    onError: overrides.onError ?? vi.fn(),
  };
  render(<CreateHolidaysDialog {...props} />);
  return props;
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('CreateHolidaysDialog', () => {
  it('shows the branch\'s federal state and a Jahr selector defaulting to the current year', () => {
    vi.setSystemTime(new Date('2026-03-01T10:00:00'));
    renderDialog();

    expect(screen.getByText(/Bayern/)).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Jahr' })).toHaveTextContent('2026');
  });

  it('runs createHolidaysForYear with the resolved holiday dates for the selected year and reports the result', async () => {
    vi.setSystemTime(new Date('2026-03-01T10:00:00'));
    const user = userEvent.setup();
    const vacation = { id: 'a1', employeeId: 'e1', type: 'Vacation', from: '2026-01-01', to: '2026-01-01', createdAt: '2026-01-01T00:00:00.000Z' } as unknown as Absence;
    createHolidaysForYearMock.mockResolvedValueOnce({ created: 9, skipped: 3 });
    const { onApplied, onClose } = renderDialog({ absences: [vacation] });

    await user.click(screen.getByRole('button', { name: 'Anlegen' }));

    const expectedDates = holidaysForYearAndFederalState(2026, 'Bayern');
    await waitFor(() =>
      expect(createHolidaysForYearMock).toHaveBeenCalledWith(expectedDates, employees, [vacation]),
    );
    expect(onApplied).toHaveBeenCalledWith({ created: 9, skipped: 3 });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('switching the Jahr selector to a different year runs the bulk creation for that year instead', async () => {
    vi.setSystemTime(new Date('2026-03-01T10:00:00'));
    const user = userEvent.setup();
    createHolidaysForYearMock.mockResolvedValueOnce({ created: 12, skipped: 0 });
    renderDialog();

    await user.click(screen.getByRole('combobox', { name: 'Jahr' }));
    await user.click(screen.getByRole('option', { name: '2027' }));
    await user.click(screen.getByRole('button', { name: 'Anlegen' }));

    const expectedDates2027 = holidaysForYearAndFederalState(2027, 'Bayern');
    await waitFor(() => expect(createHolidaysForYearMock).toHaveBeenCalledWith(expectedDates2027, employees, []));
  });

  it('reports an error and keeps the dialog open (does not call onApplied/onClose) when the service call fails', async () => {
    vi.setSystemTime(new Date('2026-03-01T10:00:00'));
    const user = userEvent.setup();
    createHolidaysForYearMock.mockRejectedValueOnce(new Error('boom'));
    const { onApplied, onClose, onError } = renderDialog();

    await user.click(screen.getByRole('button', { name: 'Anlegen' }));

    await waitFor(() => expect(onError).toHaveBeenCalledWith(expect.any(Error), 'Feiertage konnten nicht angelegt werden'));
    expect(onApplied).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('calls onClose (not onApplied) when Abbrechen is clicked, without calling the service', async () => {
    const user = userEvent.setup();
    const { onClose } = renderDialog();

    await user.click(screen.getByRole('button', { name: 'Abbrechen' }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(createHolidaysForYearMock).not.toHaveBeenCalled();
  });

  it('disables "Anlegen" and shows a hint when there are no employees to create holidays for', () => {
    renderDialog({ employees: [] });

    const button = screen.getByRole('button', { name: 'Anlegen' });
    const hint = screen.getByText('Keine aktiven Mitarbeiter für diese Filiale.');
    expect(button).toBeDisabled();
    expect(hint).toBeInTheDocument();
    expect(button).toHaveAttribute('aria-describedby', hint.id);
  });

  it('does not leave a dangling aria-describedby when employees are present', () => {
    renderDialog();

    expect(screen.getByRole('button', { name: 'Anlegen' })).not.toHaveAttribute('aria-describedby');
  });
});
