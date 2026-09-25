import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { BranchId, EmployeeId, AbsenceId } from '@domain/shared/ids';
import type { Employee } from '@domain/employee/Employee';
import type { Absence } from '@domain/absence/Absence';
import { toISODate } from '@domain/shared/DateFormat';
import { TO_BEFORE_FROM_MESSAGE } from '@domain/absence/absenceValidation';
import { services } from '@infrastructure/services';
import { AbsenceDialog } from './AbsenceDialog';

vi.mock('@infrastructure/services', () => ({
  services: { absence: { create: vi.fn(), update: vi.fn() } },
}));

const createMock = vi.mocked(services.absence.create);
const updateMock = vi.mocked(services.absence.update);
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
    holidayVacationHours: 5,
    active: true,
    createdAt: '',
    updatedAt: '',
  };
}

const employees = [employee(m1, 'Müller'), employee('m2' as EmployeeId, 'Schulz')];
const today = toISODate(new Date());

function renderDialog(absences: Absence[] = [], absence: Absence | null = null) {
  const onClose = vi.fn();
  const onSaved = vi.fn();
  const onError = vi.fn();
  render(
    <AbsenceDialog
      employees={employees}
      absences={absences}
      absence={absence}
      onClose={onClose}
      onSaved={onSaved}
      onError={onError}
    />,
  );
  return { onClose, onSaved, onError };
}

function existingVacation(overrides: Partial<Absence> = {}): Absence {
  return {
    id: 'existing-vacation' as AbsenceId,
    employeeId: m1,
    type: 'Vacation',
    from: '2026-03-01',
    to: '2026-03-15',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  } as Absence;
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
  it('keeps the long "Angerechnete Stunden manuell (optional)" label shrunk, so it is never cut off (Teil 5)', () => {
    renderDialog();

    // In its resting position an outlined label may only be the field width minus 24px: 314px of
    // text in a 280px field was cut off on desktop and phone alike.
    expect(screen.getByText('Angerechnete Stunden manuell (optional)', { selector: 'label' })).toHaveAttribute('data-shrink', 'true');
  });

  beforeEach(() => {
    createMock.mockReset();
    createMock.mockImplementation(async (input) => ({ ...input, id: 'a1' as AbsenceId, createdAt: '' }));
    updateMock.mockReset();
    updateMock.mockImplementation(async (absence) => absence);
  });

  it('drops a checked half-day flag once the range is extended to multiple days', async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByRole('checkbox', { name: 'Nur vormittags frei' }));
    setDate('Bis', '2099-01-05'); // safely after "today" (Von), whatever "today" is at test time
    expect(screen.queryByRole('checkbox', { name: 'Nur vormittags frei' })).not.toBeInTheDocument();

    await user.click(save());

    expect(createMock).toHaveBeenCalledWith(expect.objectContaining({ halfDay: undefined }));
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

  it('does not carry a note typed while Vacation was selected over to a save under Sonstige', async () => {
    const user = userEvent.setup();
    const { onSaved } = renderDialog();

    await user.type(screen.getByLabelText('Notiz (optional)'), 'Ski-Urlaub');
    await chooseType(user, 'Sonstige');
    await user.type(screen.getByRole('textbox', { name: 'Bezeichnung' }), 'Fortbildung');
    await user.click(save());

    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(createMock).toHaveBeenCalledWith(expect.objectContaining({ type: 'Other', note: undefined }));
  });

  it('keeps an existing Other absence\'s own note untouched when only the dates are edited (deliberate roundtrip, not a leak)', async () => {
    const user = userEvent.setup();
    const existingOther: Absence = {
      id: 'existing-other' as AbsenceId,
      employeeId: m1,
      type: 'Other',
      from: '2026-03-01',
      to: '2026-03-01',
      label: 'Fortbildung',
      note: 'Wichtige Schulung',
      createdAt: '2026-01-01T00:00:00.000Z',
    } as Absence;
    const { onSaved } = renderDialog([], existingOther);

    await user.click(save());

    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({ note: 'Wichtige Schulung' }));
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

  it('asks for confirmation before saving an absence that overlaps an existing one, and only saves once confirmed', async () => {
    const user = userEvent.setup();
    renderDialog([existingVacation()]);

    await chooseType(user, 'Krankheit');
    setDate('Von', '2026-03-10');
    setDate('Bis', '2026-03-20');
    await user.click(save());

    expect(await screen.findByText('Überschneidung mit bestehender Abwesenheit?')).toBeInTheDocument();
    expect(
      screen.getByText('Diese Abwesenheit überschneidet sich mit: Urlaub (01.03.2026 – 15.03.2026).'),
    ).toBeInTheDocument();
    expect(createMock).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Trotzdem speichern' }));
    await waitFor(() => expect(createMock).toHaveBeenCalledTimes(1));
  });

  it('does not warn for a single public-holiday day nested inside an existing longer absence (regression)', async () => {
    const user = userEvent.setup();
    renderDialog([existingVacation()]);

    await chooseType(user, 'Feiertag');
    setDate('Von', '2026-03-10');
    setDate('Bis', '2026-03-10');
    await user.click(save());

    await waitFor(() => expect(createMock).toHaveBeenCalledTimes(1));
    expect(screen.queryByText('Überschneidung mit bestehender Abwesenheit?')).not.toBeInTheDocument();
  });

  it('pre-fills every field from the given absence, titles itself "bearbeiten", and calls update (not create) with its id', async () => {
    const user = userEvent.setup();
    const vacation = existingVacation({ note: 'Mallorca', halfDay: { atStart: true, atEnd: false } });
    renderDialog([vacation], vacation);

    expect(screen.getByText('Abwesenheit bearbeiten')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Mitarbeiter' })).toHaveTextContent('Müller, Anna');
    expect(dateField('Von')).toHaveValue('2026-03-01');
    expect(dateField('Bis')).toHaveValue('2026-03-15');
    expect(screen.getByDisplayValue('Mallorca')).toBeInTheDocument();

    setDate('Bis', '2026-03-16');
    await user.click(save());

    await waitFor(() => expect(updateMock).toHaveBeenCalledTimes(1));
    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({ id: vacation.id, to: '2026-03-16' }));
    expect(createMock).not.toHaveBeenCalled();
  });

  it('does not warn about overlapping itself when re-saving an absence unchanged (excludeId)', async () => {
    const user = userEvent.setup();
    const vacation = existingVacation();
    renderDialog([vacation], vacation);

    await user.click(save());

    await waitFor(() => expect(updateMock).toHaveBeenCalledTimes(1));
    expect(screen.queryByText('Überschneidung mit bestehender Abwesenheit?')).not.toBeInTheDocument();
  });
});
