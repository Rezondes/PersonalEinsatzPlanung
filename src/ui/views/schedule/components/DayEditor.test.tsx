import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { EmployeeId, AbsenceId } from '@domain/shared/ids';
import type { Absence } from '@domain/absence/Absence';
import type { DayEntry } from '@domain/schedule/EmployeeWeekAssignment';
import { DayEditor } from './DayEditor';

const m1 = 'm1' as EmployeeId;
const date = '2026-09-07';

function renderEditor(entry: DayEntry = { type: 'Off' }, absence?: Absence) {
  const onClose = vi.fn();
  const onSave = vi.fn();
  const onAbsenceSave = vi.fn();
  const onAbsenceDelete = vi.fn();
  render(
    <DayEditor
      open
      onClose={onClose}
      onSave={onSave}
      onAbsenceSave={onAbsenceSave}
      onAbsenceDelete={onAbsenceDelete}
      employeeId={m1}
      employeeName="Müller, Anna"
      day="Montag"
      date={date}
      entry={entry}
      absence={absence}
    />,
  );
  return { onClose, onSave, onAbsenceSave, onAbsenceDelete };
}

const save = () => screen.getByRole('button', { name: 'Speichern' });
/** Time inputs have no ARIA role and their required labels carry MUI's asterisk, so match the
 * label text exactly once the asterisk is stripped (keeps "Beginn (optional)" and the "Ende liegt
 * am Folgetag" checkbox apart from the shift fields). jsdom ignores user.type on time inputs, so
 * values are set with fireEvent.change. */
const timeField = (label: string) => screen.getByLabelText((text) => text.replace('*', '').trim() === label);
const setTime = (label: string, value: string) => fireEvent.change(timeField(label), { target: { value } });

describe('DayEditor', () => {
  it('suggests a 06:00-14:00 shift on a free day and saves it', async () => {
    const user = userEvent.setup();
    const { onSave, onClose } = renderEditor();

    expect(timeField('Beginn')).toHaveValue('06:00');
    expect(timeField('Ende')).toHaveValue('14:00');
    expect(screen.getByText('* Pflichtfeld')).toBeInTheDocument();

    // Six hours need no statutory break, so this saves without the ArbZG confirmation.
    setTime('Ende', '12:00');
    await user.click(save());

    expect(onSave).toHaveBeenCalledWith({
      type: 'Shift',
      shifts: [expect.objectContaining({ start: '06:00', end: '12:00', endsNextDay: false, breaks: [] })],
    });
    expect(onClose).toHaveBeenCalled();
  });

  it('keeps a cleared start time empty, marks it and refuses to save until it is filled', async () => {
    const user = userEvent.setup();
    const { onSave } = renderEditor();

    setTime('Beginn', '');
    expect(timeField('Beginn')).toHaveValue('');
    expect(screen.getByText(/– Std\. netto/)).toBeInTheDocument();

    await user.click(save());

    expect(screen.getByText('Bitte Beginn eingeben.')).toBeInTheDocument();
    expect(timeField('Beginn')).toHaveFocus();
    expect(onSave).not.toHaveBeenCalled();

    setTime('Beginn', '08:00');
    expect(screen.queryByText('Bitte Beginn eingeben.')).not.toBeInTheDocument();
    expect(screen.getByText(/6 Std\. netto/)).toBeInTheDocument();
  });

  it('requires a break duration above zero', async () => {
    const user = userEvent.setup();
    const { onSave } = renderEditor();

    await user.click(screen.getByRole('button', { name: 'Pause hinzufügen' }));
    const duration = screen.getByRole('textbox', { name: 'Dauer (Min.)' });
    expect(duration).toHaveValue('30');

    await user.clear(duration);
    await user.click(save());
    expect(screen.getByText('Bitte Dauer eingeben.')).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();

    await user.type(duration, '0');
    expect(screen.getByText('Muss größer als 0 sein.')).toBeInTheDocument();

    await user.clear(duration);
    await user.type(duration, '45');
    expect(screen.queryByText('Muss größer als 0 sein.')).not.toBeInTheDocument();
  });

  it('asks for at least one shift when switching an absence day to work time', async () => {
    const user = userEvent.setup();
    const vacation: Absence = { id: 'a1' as AbsenceId, employeeId: m1, type: 'Vacation', from: date, to: date, createdAt: '' };
    const { onSave } = renderEditor({ type: 'Off' }, vacation);

    await user.click(screen.getByRole('button', { name: 'Arbeitszeit' }));
    await user.click(save());

    expect(screen.getByText('Bitte mindestens eine Schicht anlegen.')).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Schicht hinzufügen' }));
    expect(screen.queryByText('Bitte mindestens eine Schicht anlegen.')).not.toBeInTheDocument();
  });

  it('requires a Bezeichnung for Sonstige and passes it on trimmed', async () => {
    const user = userEvent.setup();
    const { onAbsenceSave, onClose } = renderEditor();

    await user.click(screen.getByRole('button', { name: 'Sonstige' }));
    await user.click(save());

    expect(screen.getByText('Bitte Bezeichnung eingeben.')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Bezeichnung' })).toHaveFocus();
    expect(onAbsenceSave).not.toHaveBeenCalled();

    await user.type(screen.getByRole('textbox', { name: 'Bezeichnung' }), ' Fortbildung ');
    await user.click(save());

    expect(onAbsenceSave).toHaveBeenCalledWith('Other', 'Fortbildung');
    expect(onClose).toHaveBeenCalled();
  });

  it('still only asks for confirmation on an ArbZG violation instead of blocking', async () => {
    const user = userEvent.setup();
    const { onSave } = renderEditor();

    setTime('Ende', '22:00');
    await user.click(save());

    expect(screen.getByText('Gesetzesverstoß trotzdem speichern?')).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Trotzdem speichern' }));

    expect(onSave).toHaveBeenCalledWith({
      type: 'Shift',
      shifts: [expect.objectContaining({ start: '06:00', end: '22:00' })],
    });
  });
});
