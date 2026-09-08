import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { BranchId, EmployeeId, AbsenceId } from '@domain/shared/ids';
import type { Employee } from '@domain/employee/Employee';
import { TO_BEFORE_FROM_MESSAGE } from '@domain/absence/absenceValidation';
import { services } from '@infrastructure/services';
import { AbsenceDialog } from './AbsenceDialog';

vi.mock('@infrastructure/services', () => ({
  services: { absence: { create: vi.fn() } },
}));

const createMock = vi.mocked(services.absence.create);
const m1 = 'm1' as EmployeeId;

function employee(id: EmployeeId, lastName: string): Employee {
  return {
    id,
    branchId: 'b1' as BranchId,
    lastName,
    firstName: 'Anna',
    jobTitle: 'Verkauf',
    employmentType: { type: 'FullTime', weeklyHours: 40 },
    vacationEntitlementPerYear: 30,
    active: true,
    createdAt: '',
    updatedAt: '',
  };
}

const employees = [employee(m1, 'Müller'), employee('m2' as EmployeeId, 'Schulz')];
const today = new Date().toISOString().slice(0, 10);

function renderDialog() {
  const onClose = vi.fn();
  const onSaved = vi.fn();
  const onError = vi.fn();
  render(<AbsenceDialog employees={employees} onClose={onClose} onSaved={onSaved} onError={onError} />);
  return { onClose, onSaved, onError };
}

const save = () => screen.getByRole('button', { name: 'Speichern' });
/** Required labels carry MUI's asterisk, so match on the start of the label text. */
const dateField = (label: string) => screen.getByLabelText((text) => text.startsWith(label));
const setDate = (label: string, value: string) => fireEvent.change(dateField(label), { target: { value } });

async function chooseType(user: ReturnType<typeof userEvent.setup>, option: string) {
  await user.click(screen.getByRole('combobox', { name: 'Art' }));
  await user.click(screen.getByRole('option', { name: option }));
}

describe('AbsenceDialog', () => {
  beforeEach(() => {
    createMock.mockReset();
    createMock.mockImplementation(async (input) => ({ ...input, id: 'a1' as AbsenceId, createdAt: '' }));
  });

  it('marks the fields, preselects the first employee and saves a vacation for today', async () => {
    const user = userEvent.setup();
    const { onClose, onSaved } = renderDialog();

    expect(screen.getByText('* Pflichtfeld')).toBeInTheDocument();
    expect(dateField('Von')).toBeRequired();
    expect(dateField('Bis')).toBeRequired();
    expect(screen.getByRole('combobox', { name: 'Mitarbeiter' })).toHaveTextContent('Müller, Anna');

    await user.click(save());

    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(createMock).toHaveBeenCalledWith({ employeeId: m1, type: 'Vacation', from: today, to: today, halfDay: undefined, note: undefined });
    expect(onClose).toHaveBeenCalled();
  });

  it('requires a Bezeichnung for Sonstige and saves it trimmed instead of a placeholder', async () => {
    const user = userEvent.setup();
    renderDialog();

    await chooseType(user, 'Sonstige');
    await user.click(save());

    expect(screen.getByText('Bitte Bezeichnung eingeben.')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Bezeichnung' })).toHaveFocus();
    expect(createMock).not.toHaveBeenCalled();

    await user.type(screen.getByRole('textbox', { name: 'Bezeichnung' }), '  Fortbildung ');
    expect(screen.queryByText('Bitte Bezeichnung eingeben.')).not.toBeInTheDocument();

    await user.click(save());
    await waitFor(() => expect(createMock).toHaveBeenCalledTimes(1));
    expect(createMock).toHaveBeenCalledWith(expect.objectContaining({ type: 'Other', label: 'Fortbildung' }));
  });

  it('shows "Bis vor Von" on the Bis field and clears it once corrected', async () => {
    const user = userEvent.setup();
    renderDialog();

    setDate('Von', '2026-09-11');
    setDate('Bis', '2026-09-07');
    await user.click(save());

    expect(screen.getByText(TO_BEFORE_FROM_MESSAGE)).toBeInTheDocument();
    expect(dateField('Bis')).toHaveAttribute('aria-invalid', 'true');
    expect(createMock).not.toHaveBeenCalled();

    setDate('Bis', '2026-09-12');
    expect(screen.queryByText(TO_BEFORE_FROM_MESSAGE)).not.toBeInTheDocument();
  });

  it('requires both dates', async () => {
    const user = userEvent.setup();
    renderDialog();

    setDate('Von', '');
    await user.click(save());

    expect(screen.getByText('Bitte Startdatum wählen.')).toBeInTheDocument();
    expect(dateField('Von')).toHaveFocus();
  });
});
