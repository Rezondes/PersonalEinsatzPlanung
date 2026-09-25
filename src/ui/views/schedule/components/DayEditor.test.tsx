import { describe, it, expect, vi, afterEach } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { EmployeeId, AbsenceId } from '@domain/shared/ids';
import type { Absence } from '@domain/absence/Absence';
import type { DayEntry } from '@domain/schedule/EmployeeWeekAssignment';
import { DayEditor } from './DayEditor';

const m1 = 'm1' as EmployeeId;
const date = '2026-09-07';

function renderEditor(entry: DayEntry = { type: 'Off' }, absence?: Absence, birthDate?: string) {
  const onClose = vi.fn();
  const onSave = vi.fn();
  const onAbsenceSave = vi.fn();
  render(
    <DayEditor
      open
      onClose={onClose}
      onSave={onSave}
      onAbsenceSave={onAbsenceSave}
      employeeId={m1}
      employeeName="Anna Müller"
      employeeTitleName="Müller, Anna"
      day="Montag"
      date={date}
      entry={entry}
      absence={absence}
      birthDate={birthDate}
    />,
  );
  return { onClose, onSave, onAbsenceSave };
}

const save = () => screen.getByRole('button', { name: 'Speichern' });
/** Time inputs have no ARIA role and their required labels carry MUI's asterisk, so match the
 * label text exactly once the asterisk is stripped (keeps "Beginn (optional)" and the "Ende liegt
 * am Folgetag" checkbox apart from the shift fields). jsdom ignores user.type on time inputs, so
 * values are set with fireEvent.change. */
const timeField = (label: string) => screen.getByLabelText((text) => text.replace('*', '').trim() === label);
const setTime = (label: string, value: string) => fireEvent.change(timeField(label), { target: { value } });

describe('DayEditor', () => {
  describe('Tagesart-Auswahl layout (Teil 5, Package 8)', () => {
    const group = () => screen.getByRole('group', { name: 'Eintragsart' });

    afterEach(() => {
      // @ts-expect-error -- undo the per-test stub, jsdom has no matchMedia of its own to restore
      delete window.matchMedia;
    });

    it('lays the six day types out as a 3x2 grid on a phone, where one row clipped "Arbeitszeit"', () => {
      // jsdom has no matchMedia of its own, so MUI's media queries answer false: the phone layout.
      renderEditor();

      expect(group()).toHaveStyle({ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)' });
    });

    it('keeps the six day types in one row on desktop', () => {
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
      renderEditor();

      expect(group()).toHaveStyle({ display: 'flex' });
    });
  });

  it('keeps the long "Angerechnete Stunden manuell (optional)" label shrunk, so it is never cut off (Teil 5)', async () => {
    renderEditor();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Urlaub' }));

    expect(screen.getByText('Angerechnete Stunden manuell (optional)', { selector: 'label' })).toHaveAttribute('data-shrink', 'true');
  });

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

  // Teil 8, Package 18: next to a fixed 200px hours field the required Bezeichnung got ~110px.
  it('stacks Bezeichnung and hours on a phone', async () => {
    const user = userEvent.setup();
    renderEditor();

    await user.click(screen.getByRole('button', { name: 'Sonstige' }));

    const row = screen.getByRole('textbox', { name: 'Bezeichnung' }).closest('.MuiStack-root') as HTMLElement;
    expect(row).toHaveStyle({ flexDirection: 'column' });
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

    expect(onAbsenceSave).toHaveBeenCalledWith('Other', { label: 'Fortbildung', hoursPerDay: undefined });
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

  // Teil 8, Package 17: the ArbZG results were only shown after Speichern, warnings never.
  it('shows ArbZG errors while editing, before Speichern', () => {
    renderEditor();

    setTime('Ende', '22:00');

    expect(screen.getByTestId('arbzg-live')).toHaveTextContent(/Höchstgrenze von 10 Std/);
  });

  it('shows ArbZG warnings while editing', () => {
    renderEditor();

    // 06:00-15:30 with the suggested breaks is over 8h net: a warning, not an error.
    setTime('Ende', '15:30');

    expect(screen.getByTestId('arbzg-live')).toHaveTextContent(/über 8 Std/);
  });

  it('shows nothing while the day is fine, and saving stays possible', async () => {
    const user = userEvent.setup();
    const { onSave } = renderEditor();

    // 4h: no break needed (the 06:00-14:00 suggestion itself lacks its 30 min break).
    setTime('Ende', '10:00');

    expect(screen.getByTestId('arbzg-live')).toBeEmptyDOMElement();
    await user.click(save());
    expect(onSave).toHaveBeenCalled();
  });

  it('lists the violations one by one in the confirmation', async () => {
    const user = userEvent.setup();
    renderEditor();

    setTime('Ende', '22:00');
    await user.click(save());

    const dialog = screen.getByRole('dialog', { name: 'Gesetzesverstoß trotzdem speichern?' });
    expect(within(dialog).getAllByRole('listitem').length).toBeGreaterThanOrEqual(2);
  });

  it('asks for confirmation on a pure youth-protection violation (minor working past 20:00) even though no adult rule fires', async () => {
    const user = userEvent.setup();
    // 19:00-21:00: 2h net, no break required, nowhere near any adult daily-hours threshold - the
    // ONLY thing wrong with this shift is JArbSchG's 20:00 curfew for a minor.
    const { onSave } = renderEditor(undefined, undefined, '2010-05-01');

    setTime('Beginn', '19:00');
    setTime('Ende', '21:00');
    await user.click(save());

    expect(screen.getByText('Gesetzesverstoß trotzdem speichern?')).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Trotzdem speichern' }));
    expect(onSave).toHaveBeenCalledWith({
      type: 'Shift',
      shifts: [expect.objectContaining({ start: '19:00', end: '21:00' })],
    });
  });

  it('does not ask for confirmation on the identical shift for an adult', async () => {
    const user = userEvent.setup();
    const { onSave } = renderEditor(undefined, undefined, '1990-05-01');

    setTime('Beginn', '19:00');
    setTime('Ende', '21:00');
    await user.click(save());

    expect(screen.queryByText('Gesetzesverstoß trotzdem speichern?')).not.toBeInTheDocument();
    expect(onSave).toHaveBeenCalled();
  });

  it('asks for confirmation for a child (under 15) even on an otherwise unremarkable shift, per the unconditional §5 JArbSchG ban', async () => {
    const user = userEvent.setup();
    const { onSave } = renderEditor(undefined, undefined, '2020-01-01');

    // 2h net, no break required, well inside 06:00-20:00 - violates no hour/break/night-work rule
    // for anyone; the ONLY reason to ask for confirmation here is the child ban itself.
    setTime('Beginn', '08:00');
    setTime('Ende', '10:00');
    await user.click(save());

    expect(screen.getByText('Gesetzesverstoß trotzdem speichern?')).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('labels the entry-type toggle group for screen readers', () => {
    renderEditor();
    expect(screen.getByRole('group', { name: 'Eintragsart' })).toBeInTheDocument();
  });
});

describe('DayEditor discard confirmation', () => {
  it('does not ask for the untouched 06:00-14:00 suggestion on a free day', async () => {
    const { onClose } = renderEditor();

    await userEvent.setup().click(screen.getByRole('button', { name: 'Abbrechen' }));

    expect(screen.queryByText('Änderungen verwerfen?')).not.toBeInTheDocument();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('asks on Abbrechen once the end time was changed', async () => {
    const { onClose } = renderEditor();

    setTime('Ende', '15:00');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Abbrechen' }));

    expect(await screen.findByText('Änderungen verwerfen?')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('compares against the day it was reopened for, not the previous one', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const props = {
      onClose,
      onSave: vi.fn(),
      onAbsenceSave: vi.fn(),
      employeeId: m1,
      employeeName: 'Anna Müller',
      employeeTitleName: 'Müller, Anna',
      day: 'Montag' as const,
      date,
    };
    const { rerender } = render(<DayEditor open {...props} entry={{ type: 'Off' }} />);
    setTime('Ende', '15:00');

    const nextDay: DayEntry = { type: 'Off' };
    rerender(<DayEditor open={false} {...props} entry={nextDay} />);
    rerender(<DayEditor open {...props} entry={nextDay} />);
    await user.click(screen.getByRole('button', { name: 'Abbrechen' }));

    expect(screen.queryByText('Änderungen verwerfen?')).not.toBeInTheDocument();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
