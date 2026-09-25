import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { BranchId, EmployeeId } from '@domain/shared/ids';
import type { Employee } from '@domain/employee/Employee';
import { services } from '@infrastructure/services';
import { toISODate } from '@domain/shared/DateFormat';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
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

// Teil 8, Package 12: with a changed form, "Deaktivieren" opened "Änderungen verwerfen?" and the
// deactivate confirm on top of each other.
describe('EmployeeDialog, secondary actions', () => {
  it('locks them while the form has unsaved changes, and says why', async () => {
    const user = userEvent.setup();
    const deactivate = { key: 'deactivate', label: 'Deaktivieren', icon: EditOutlinedIcon, onSelect: vi.fn() };
    render(
      <EmployeeDialog
        branchId={branchId}
        employee={null}
        onClose={vi.fn()}
        onSaved={vi.fn()}
        onError={vi.fn()}
        secondaryActions={[deactivate]}
      />,
    );
    expect(screen.getByRole('button', { name: 'Deaktivieren' })).toBeEnabled();

    await user.type(textbox('Vorname'), 'A');

    expect(screen.getByRole('button', { name: 'Deaktivieren' })).toBeDisabled();
    expect(screen.getByText('Erst speichern oder Änderungen verwerfen.')).toBeInTheDocument();
  });
});
const save = () => screen.getByRole('button', { name: 'Speichern' });
const abbrechen = () => screen.getByRole('button', { name: 'Abbrechen' });

async function chooseEmploymentType(user: ReturnType<typeof userEvent.setup>, option: string) {
  await user.click(screen.getByRole('combobox', { name: 'Beschäftigungsart' }));
  await user.click(screen.getByRole('option', { name: option }));
}

/** The Stack a field sits in: its FormControl's parent. */
const rowOf = (input: HTMLElement) => input.closest('.MuiFormControl-root')!.parentElement!;

describe('EmployeeDialog', () => {
  // Teil 7, Package 3: Escape with a typed name used to close the dialog and drop the input.
  describe('discard confirmation', () => {
    it('asks before Escape drops a typed name, and closes only after Verwerfen', async () => {
      const user = userEvent.setup();
      const { onClose } = renderDialog();

      await user.type(textbox('Vorname'), 'Test');
      await user.keyboard('{Escape}');

      expect(await screen.findByText('Änderungen verwerfen?')).toBeInTheDocument();
      expect(onClose).not.toHaveBeenCalled();

      await user.click(screen.getByRole('button', { name: 'Verwerfen' }));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('asks on Abbrechen after a change, but not without one', async () => {
      const user = userEvent.setup();
      const { onClose } = renderDialog();

      await user.click(abbrechen());
      expect(onClose).toHaveBeenCalledTimes(1);

      await user.type(textbox('Vorname'), 'Test');
      await user.click(abbrechen());
      expect(await screen.findByText('Änderungen verwerfen?')).toBeInTheDocument();
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does not count input that was typed and deleted again as a change', async () => {
      const user = userEvent.setup();
      const { onClose } = renderDialog();

      await user.type(textbox('Vorname'), 'Te');
      await user.clear(textbox('Vorname'));
      await user.keyboard('{Escape}');

      expect(screen.queryByText('Änderungen verwerfen?')).not.toBeInTheDocument();
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('two-field rows (Teil 5, Package 9)', () => {
    afterEach(() => {
      // @ts-expect-error -- undo the per-test stub, jsdom has no matchMedia of its own to restore
      delete window.matchMedia;
    });

    it('stacks the long-label pairs on a phone, where "Urlaubsanspruch/Jahr…" and "Austrittsdatum (option…" were cut off', () => {
      // jsdom has no matchMedia of its own, so MUI's media queries answer false: the phone layout.
      renderDialog();

      expect(rowOf(textbox('Urlaubsanspruch/Jahr (Tage)'))).toHaveStyle({ flexDirection: 'column' });
      expect(rowOf(textbox('Urlaubsanspruch/Jahr (Tage)'))).toContainElement(textbox('Std. je Feier-/Urlaubstag'));
      expect(rowOf(screen.getByLabelText('Eintrittsdatum (optional)'))).toHaveStyle({ flexDirection: 'column' });
      // Short labels still fit side by side.
      expect(rowOf(textbox('Vorname'))).toHaveStyle({ flexDirection: 'row' });
    });

    it('keeps both pairs side by side on desktop', () => {
      window.matchMedia = ((query: string) => ({
        matches: /min-width/.test(query),
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      })) as unknown as typeof window.matchMedia;
      renderDialog();

      expect(rowOf(textbox('Urlaubsanspruch/Jahr (Tage)'))).toHaveStyle({ flexDirection: 'row' });
      expect(rowOf(screen.getByLabelText('Eintrittsdatum (optional)'))).toHaveStyle({ flexDirection: 'row' });
    });
  });

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

    await chooseEmploymentType(user, 'Geringfügig beschäftigt');
    await user.type(textbox('Min. Std./Woche'), '12');
    await user.type(textbox('Max. Std./Woche'), '10');
    expect(screen.getByText('Min. Std. darf nicht über Max. Std. liegen.')).toBeInTheDocument();
  });

  it('zeigt einen Fehler bei einem Geburtsdatum in der Zukunft', async () => {
    const user = userEvent.setup();
    renderDialog();

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    fireEvent.change(screen.getByLabelText('Geburtsdatum (optional)'), {
      // Local date, not toISOString(): that is UTC and still today between 00:00 and 02:00 in Germany.
      target: { value: toISODate(tomorrow) },
    });
    await user.click(save());

    expect(screen.getByText('Geburtsdatum darf nicht in der Zukunft liegen.')).toBeInTheDocument();
  });

  it('zeigt einen Fehler bei unplausiblem Alter', async () => {
    const user = userEvent.setup();
    renderDialog();

    fireEvent.change(screen.getByLabelText('Geburtsdatum (optional)'), { target: { value: '1900-01-01' } });
    await user.click(save());

    expect(screen.getByText('Geburtsdatum ist unplausibel.')).toBeInTheDocument();
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

  it('offers an optional monthly-hours cap for Minijob, omitted when blank and included once entered', async () => {
    const user = userEvent.setup();
    renderDialog();

    await chooseEmploymentType(user, 'Geringfügig beschäftigt');
    expect(textbox('Max. Std./Monat (optional)')).not.toBeRequired();

    await user.type(textbox('Vorname'), 'Anna');
    await user.type(textbox('Nachname'), 'Müller');
    await user.type(screen.getByRole('combobox', { name: 'Tätigkeit' }), 'Verkauf');
    await user.type(textbox('Min. Std./Woche'), '5');
    await user.type(textbox('Max. Std./Woche'), '10');
    await user.type(textbox('Std. je Feier-/Urlaubstag'), '2');
    await user.click(save());

    await waitFor(() => expect(createMock).toHaveBeenCalledTimes(1));
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({ employmentType: { type: 'Minijob', minHours: 5, maxHours: 10, maxMonthlyHours: undefined } }),
    );

    createMock.mockClear();
    await user.type(textbox('Max. Std./Monat (optional)'), '43');
    await user.click(save());

    await waitFor(() => expect(createMock).toHaveBeenCalledTimes(1));
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({ employmentType: { type: 'Minijob', minHours: 5, maxHours: 10, maxMonthlyHours: 43 } }),
    );
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

  it('disables Abbrechen and shows a busy Speichern while saving, and Abbrechen has no effect meanwhile', async () => {
    const user = userEvent.setup();
    let resolveCreate!: (value: Employee) => void;
    createMock.mockReturnValue(
      new Promise<Employee>((res) => {
        resolveCreate = res;
      }),
    );
    const { onClose } = renderDialog();

    await user.type(textbox('Vorname'), 'Anna');
    await user.type(textbox('Nachname'), 'Müller');
    await user.type(screen.getByRole('combobox', { name: 'Tätigkeit' }), 'Verkauf');
    await user.type(textbox('Wochenstunden'), '20');
    await user.type(textbox('Std. je Feier-/Urlaubstag'), '5');
    await user.click(save());

    const savingButton = save();
    expect(savingButton).toBeDisabled();
    expect(within(savingButton).getByRole('progressbar')).toBeInTheDocument();
    // A genuinely disabled button already proves a click can have no effect - userEvent (unlike
    // fireEvent) simulates real pointer-events and throws rather than clicking it anyway.
    expect(abbrechen()).toBeDisabled();
    expect(onClose).not.toHaveBeenCalled();

    resolveCreate({
      id: 'new' as EmployeeId,
      branchId,
      firstName: 'Anna',
      lastName: 'Müller',
      jobTitle: 'Verkauf',
      employmentType: { type: 'PartTime', weeklyHours: 20 },
      vacationEntitlementPerYear: 28,
      holidayVacationHours: 5,
      active: true,
      createdAt: '',
      updatedAt: '',
    });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });
});
