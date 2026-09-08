import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { BranchId, EmployeeId } from '@domain/shared/ids';
import type { Employee } from '@domain/employee/Employee';
import { services } from '@infrastructure/services';
import { EmployeeDialog } from './EmployeeDialog';

vi.mock('@infrastructure/services', () => ({
  services: { employee: { create: vi.fn(), update: vi.fn() } },
}));

const createMock = vi.mocked(services.employee.create);
const updateMock = vi.mocked(services.employee.update);
const branchId = 'b1' as BranchId;

function renderDialog(employee: Employee | null = null) {
  const onClose = vi.fn();
  const onSaved = vi.fn();
  const onError = vi.fn();
  render(<EmployeeDialog branchId={branchId} employee={employee} onClose={onClose} onSaved={onSaved} onError={onError} />);
  return { onClose, onSaved, onError };
}

const textbox = (name: string) => screen.getByRole('textbox', { name });
const save = () => screen.getByRole('button', { name: 'Speichern' });

async function chooseEmploymentType(user: ReturnType<typeof userEvent.setup>, option: string) {
  await user.click(screen.getByRole('combobox', { name: 'Beschäftigungsart' }));
  await user.click(screen.getByRole('option', { name: option }));
}

describe('EmployeeDialog', () => {
  beforeEach(() => {
    createMock.mockReset();
    updateMock.mockReset();
    createMock.mockImplementation(async (details) => ({ ...details, id: 'new' as EmployeeId, active: true, createdAt: '', updatedAt: '' }));
    updateMock.mockImplementation(async (employee) => employee);
  });

  it('marks required fields with the legend and asterisk, optional ones with "(optional)"', () => {
    renderDialog();

    expect(screen.getByText('* Pflichtfeld')).toBeInTheDocument();
    expect(textbox('Vorname')).toBeRequired();
    expect(textbox('Nachname')).toBeRequired();
    expect(screen.getByRole('combobox', { name: 'Tätigkeit' })).toBeRequired();
    expect(textbox('Wochenstunden')).toBeRequired();
    expect(textbox('Urlaubsanspruch/Jahr (Tage)')).toBeRequired();
    expect(textbox('Std. je Feier-/Urlaubstag')).toBeRequired();
    expect(screen.getByLabelText('Geburtsdatum (optional)')).not.toBeRequired();
    expect(screen.getByLabelText('Eintrittsdatum (optional)')).not.toBeRequired();
    expect(screen.getByLabelText('Austrittsdatum (optional)')).not.toBeRequired();
  });

  it('shows every missing field, focuses the first one and saves nothing on an empty form', async () => {
    const user = userEvent.setup();
    const { onClose } = renderDialog();

    await user.click(save());

    expect(screen.getByText('Bitte Vornamen eingeben.')).toBeInTheDocument();
    expect(screen.getByText('Bitte Nachnamen eingeben.')).toBeInTheDocument();
    expect(screen.getByText('Bitte Tätigkeit angeben.')).toBeInTheDocument();
    expect(screen.getByText('Bitte Wochenstunden eingeben.')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Bitte die rot markierten Felder prüfen.');
    expect(textbox('Vorname')).toHaveFocus();
    expect(createMock).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('clears an error as soon as its field is filled, keeping the others', async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(save());
    await user.type(textbox('Vorname'), 'Anna');

    expect(screen.queryByText('Bitte Vornamen eingeben.')).not.toBeInTheDocument();
    expect(screen.getByText('Bitte Nachnamen eingeben.')).toBeInTheDocument();
  });

  it('explains implausible hours and vacation values', async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.type(textbox('Wochenstunden'), '0');
    await user.clear(textbox('Urlaubsanspruch/Jahr (Tage)'));
    await user.click(save());
    expect(screen.getByText('Muss größer als 0 sein.')).toBeInTheDocument();
    expect(screen.getByText('Bitte Urlaubsanspruch eingeben.')).toBeInTheDocument();

    await user.type(textbox('Urlaubsanspruch/Jahr (Tage)'), '-1');
    expect(screen.getByText('Darf nicht negativ sein.')).toBeInTheDocument();

    await chooseEmploymentType(user, 'Geringfügig beschäftigt (Minijob)');
    await user.type(textbox('Min. Std./Woche'), '12');
    await user.type(textbox('Max. Std./Woche'), '10');
    expect(screen.getByText('Min. Std. darf nicht über Max. Std. liegen.')).toBeInTheDocument();
  });

  it('creates the employee with the entered values and closes', async () => {
    const user = userEvent.setup();
    const { onClose, onSaved } = renderDialog();

    await user.type(textbox('Vorname'), 'Anna');
    await user.type(textbox('Nachname'), 'Müller');
    await user.type(screen.getByRole('combobox', { name: 'Tätigkeit' }), 'Verkauf');
    await user.type(textbox('Wochenstunden'), '20');
    await user.type(textbox('Std. je Feier-/Urlaubstag'), '5');
    await user.click(save());

    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(createMock).toHaveBeenCalledWith({
      branchId,
      firstName: 'Anna',
      lastName: 'Müller',
      jobTitle: 'Verkauf',
      employmentType: { type: 'PartTime', weeklyHours: 20 },
      vacationEntitlementPerYear: 28,
      holidayVacationHours: 5,
      birthDate: undefined,
      entryDate: undefined,
      exitDate: undefined,
    });
    expect(onClose).toHaveBeenCalled();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('opens a legacy employee without errors and only complains on save', async () => {
    const user = userEvent.setup();
    const legacy: Employee = {
      id: 'old' as EmployeeId,
      branchId,
      lastName: 'Alt',
      firstName: 'Otto',
      jobTitle: '',
      employmentType: { type: 'FullTime', weeklyHours: 0 },
      vacationEntitlementPerYear: 30,
      holidayVacationHours: 5,
      active: true,
      createdAt: '2020-01-01T00:00:00.000Z',
      updatedAt: '2020-01-01T00:00:00.000Z',
    };
    renderDialog(legacy);

    expect(screen.queryByText('Bitte Tätigkeit angeben.')).not.toBeInTheDocument();

    await user.click(save());
    expect(screen.getByText('Bitte Tätigkeit angeben.')).toBeInTheDocument();
    expect(screen.getByText('Muss größer als 0 sein.')).toBeInTheDocument();
    expect(updateMock).not.toHaveBeenCalled();

    await user.type(screen.getByRole('combobox', { name: 'Tätigkeit' }), 'Kasse');
    await user.clear(textbox('Wochenstunden'));
    await user.type(textbox('Wochenstunden'), '38,5');
    await user.click(save());

    await waitFor(() => expect(updateMock).toHaveBeenCalledTimes(1));
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'old', jobTitle: 'Kasse', employmentType: { type: 'FullTime', weeklyHours: 38.5 } }),
    );
  });

  it('reports a failed save with context and keeps the dialog open', async () => {
    const user = userEvent.setup();
    createMock.mockRejectedValue(new Error('Speicher voll'));
    const { onClose, onError } = renderDialog();

    await user.type(textbox('Vorname'), 'Anna');
    await user.type(textbox('Nachname'), 'Müller');
    await user.type(screen.getByRole('combobox', { name: 'Tätigkeit' }), 'Verkauf');
    await user.type(textbox('Wochenstunden'), '20');
    await user.type(textbox('Std. je Feier-/Urlaubstag'), '5');
    await user.click(save());

    await waitFor(() => expect(onError).toHaveBeenCalledWith(expect.any(Error), 'Mitarbeiter konnte nicht gespeichert werden'));
    expect(onClose).not.toHaveBeenCalled();
  });
});
