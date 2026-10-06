import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { BranchId, ShiftTemplateId } from '@domain/shared/ids';
import { clockTime } from '@domain/shared/ClockTime';
import { createShift } from '@domain/schedule/Shift';
import type { ShiftTemplate } from '@domain/schedule/ShiftTemplate';
import { services } from '@infrastructure/services';
import type { CellAbsenceDraft } from '../scheduleTools';
import { ShiftTemplateDialog } from './ShiftTemplateDialog';

vi.mock('@infrastructure/services', () => ({
  services: { shiftTemplate: { create: vi.fn(), update: vi.fn() } },
}));

const createMock = vi.mocked(services.shiftTemplate.create);
const updateMock = vi.mocked(services.shiftTemplate.update);

const branchId = 'b1' as BranchId;

function renderDialog(template: ShiftTemplate | null = null, initialAbsence?: CellAbsenceDraft) {
  const onClose = vi.fn();
  const onSaved = vi.fn();
  const onError = vi.fn();
  render(
    <ShiftTemplateDialog
      branchId={branchId}
      template={template}
      initialAbsence={initialAbsence}
      onClose={onClose}
      onSaved={onSaved}
      onError={onError}
    />,
  );
  return { onClose, onSaved, onError };
}

const save = () => screen.getByRole('button', { name: 'Speichern' });
const textbox = (name: string) => screen.getByRole('textbox', { name });
/** Required labels carry MUI's asterisk, so match the label once the asterisk is stripped. */
const timeField = (label: string) => screen.getByLabelText((text) => text.replace('*', '').trim() === label);
const setTime = (label: string, value: string) => fireEvent.change(timeField(label), { target: { value } });

beforeEach(() => {
  createMock.mockReset();
  updateMock.mockReset();
  createMock.mockImplementation(async (details) => ({
    ...details,
    id: 'new' as ShiftTemplateId,
    createdAt: '',
    updatedAt: '',
  }));
});

describe('ShiftTemplateDialog', () => {
  it('marks the required fields and opens with one prefilled shift', () => {
    renderDialog();
    expect(screen.getByText('* Pflichtfeld')).toBeInTheDocument();
    expect(textbox('Bezeichnung')).toBeRequired();
    expect(timeField('Beginn')).toHaveValue('06:00');
    expect(timeField('Ende')).toHaveValue('14:00');
  });

  it('reports the missing name, focuses it and saves nothing', async () => {
    const user = userEvent.setup();
    const { onClose } = renderDialog();

    await user.click(save());

    expect(screen.getByText('Bitte Bezeichnung eingeben.')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Bitte die rot markierten Felder prüfen.');
    expect(textbox('Bezeichnung')).toHaveFocus();
    expect(createMock).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('clears the error again as soon as the name is typed', async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(save());
    await user.type(textbox('Bezeichnung'), 'Frühschicht');

    expect(screen.queryByText('Bitte Bezeichnung eingeben.')).not.toBeInTheDocument();
  });

  it('creates the template with the entered name and shift', async () => {
    const user = userEvent.setup();
    const { onClose, onSaved } = renderDialog();

    await user.type(textbox('Bezeichnung'), '  Frühschicht  ');
    setTime('Ende', '12:00');
    await user.click(save());

    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(createMock).toHaveBeenCalledTimes(1);
    const payload = createMock.mock.calls[0][0];
    if (payload.kind !== 'Shift') throw new Error('expected a Shift-kind payload');
    expect(payload.branchId).toBe(branchId);
    expect(payload.name).toBe('Frühschicht');
    expect(payload.shifts).toHaveLength(1);
    expect(payload.shifts[0].start).toBe('06:00');
    expect(payload.shifts[0].end).toBe('12:00');
    expect(onClose).toHaveBeenCalled();
  });

  it('shows a busy state while saving: disables Abbrechen, spins Speichern, blocks dismissal (M13)', async () => {
    const user = userEvent.setup();
    let resolveCreate!: (value: ShiftTemplate) => void;
    createMock.mockReturnValueOnce(
      new Promise<ShiftTemplate>((res) => {
        resolveCreate = res;
      }),
    );
    const { onClose } = renderDialog();

    await user.type(textbox('Bezeichnung'), 'Frühschicht');
    await user.click(save());

    expect(screen.getByRole('button', { name: 'Abbrechen' })).toBeDisabled();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(onClose).not.toHaveBeenCalled();

    resolveCreate({
      id: 'new' as ShiftTemplateId,
      branchId,
      name: 'Frühschicht',
      kind: 'Shift',
      shifts: [createShift(clockTime('06:00'), clockTime('14:00'))],
      createdAt: '',
      updatedAt: '',
    });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('updates an existing template instead of creating a second one', async () => {
    const user = userEvent.setup();
    const existing: ShiftTemplate = {
      id: 't1' as ShiftTemplateId,
      branchId,
      name: 'Spätschicht',
      kind: 'Shift',
      shifts: [createShift(clockTime('14:00'), clockTime('20:00'))],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    const { onSaved } = renderDialog(existing);

    expect(timeField('Beginn')).toHaveValue('14:00');
    await user.clear(textbox('Bezeichnung'));
    await user.type(textbox('Bezeichnung'), 'Abenddienst');
    await user.click(save());

    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(createMock).not.toHaveBeenCalled();
    expect(updateMock).toHaveBeenCalledTimes(1);
    expect(updateMock.mock.calls[0][0].id).toBe(existing.id);
    expect(updateMock.mock.calls[0][0].name).toBe('Abenddienst');
  });

  describe('Sonstiges mode', () => {
    it('switches to a Stunden field instead of the shift list, keeping the one Bezeichnung field', async () => {
      const user = userEvent.setup();
      renderDialog();

      await user.click(screen.getByRole('button', { name: 'Sonstiges' }));

      expect(screen.queryByLabelText((t) => t.replace('*', '').trim() === 'Beginn')).not.toBeInTheDocument();
      expect(textbox('Bezeichnung')).toBeInTheDocument();
      expect(screen.getByLabelText((t) => t.includes('Stunden'))).toBeInTheDocument();
    });

    it('reports the missing Bezeichnung once (not twice), focuses it and saves nothing', async () => {
      const user = userEvent.setup();
      renderDialog();

      await user.click(screen.getByRole('button', { name: 'Sonstiges' }));
      await user.click(save());

      expect(screen.getAllByText('Bitte Bezeichnung eingeben.')).toHaveLength(1);
      expect(textbox('Bezeichnung')).toHaveFocus();
      expect(createMock).not.toHaveBeenCalled();
    });

    it('creates an Other-kind template using the Bezeichnung as both the template name and the absence label, plus the entered hours', async () => {
      const user = userEvent.setup();
      const { onSaved } = renderDialog();

      await user.type(textbox('Bezeichnung'), 'Inventur');
      await user.click(screen.getByRole('button', { name: 'Sonstiges' }));
      const hoursField = screen.getByLabelText((t) => t.includes('Stunden'));
      await user.type(hoursField, '4');
      await user.click(save());

      await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
      expect(createMock).toHaveBeenCalledTimes(1);
      const payload = createMock.mock.calls[0][0];
      expect(payload).toMatchObject({ branchId, name: 'Inventur', kind: 'Other', label: 'Inventur', hoursPerDay: 4 });
      expect((payload as { shifts?: unknown }).shifts).toBeUndefined();
    });

    it('prefills and updates an existing Other-kind template', async () => {
      const user = userEvent.setup();
      const existing: ShiftTemplate = {
        id: 't2' as ShiftTemplateId,
        branchId,
        name: 'Feiertag',
        kind: 'Other',
        label: 'Feiertag',
        hoursPerDay: 8,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      };
      const { onSaved } = renderDialog(existing);

      expect(screen.getByRole('button', { name: 'Sonstiges', pressed: true })).toBeInTheDocument();
      await user.click(save());

      await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
      expect(updateMock).toHaveBeenCalledTimes(1);
      expect(updateMock.mock.calls[0][0]).toMatchObject({ id: 't2', kind: 'Other', label: 'Feiertag', hoursPerDay: 8 });
    });
  });
});

describe('ShiftTemplateDialog absence kinds', () => {
  const kindButton = (name: string) => screen.getByRole('button', { name });
  const creditedField = () => screen.getByLabelText((t) => t.includes('Angerechnete Stunden'));

  it('offers all five kinds in the plan order', () => {
    renderDialog();
    const group = screen.getByRole('group', { name: 'Art der Vorlage' });
    expect(within(group).getAllByRole('button').map((b) => b.textContent)).toEqual([
      'Arbeitszeit',
      'Sonstiges',
      'Urlaub',
      'Krankheit',
      'Feiertag',
    ]);
  });

  it('bietet Urlaub mit Halbtag und Stunden an', async () => {
    const user = userEvent.setup();
    const { onSaved } = renderDialog();

    await user.click(kindButton('Urlaub'));

    expect(textbox('Bezeichnung')).toHaveValue('Urlaub');
    expect(screen.getByRole('radio', { name: 'Ganzer Tag' })).toBeChecked();
    await user.click(screen.getByRole('radio', { name: 'Nur vormittags frei' }));
    await user.type(creditedField(), '4');
    await user.click(save());

    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    const payload = createMock.mock.calls[0][0];
    expect(payload).toEqual({ branchId, name: 'Urlaub', kind: 'Vacation', halfDay: 'morning', creditedMinutesOverride: 240 });
  });

  it('speichert eine Feiertagsvorlage', async () => {
    const user = userEvent.setup();
    const { onSaved } = renderDialog();

    await user.click(kindButton('Feiertag'));

    expect(textbox('Bezeichnung')).toHaveValue('Feiertag');
    // The half day only exists for Urlaub; the credited hours for all three absence kinds.
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    expect(creditedField()).toBeInTheDocument();
    await user.click(save());

    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(createMock.mock.calls[0][0]).toEqual({ branchId, name: 'Feiertag', kind: 'PublicHoliday' });
  });

  it('replaces only the prefilled name when the kind changes, never a typed one', async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(kindButton('Urlaub'));
    await user.click(kindButton('Krankheit'));
    expect(textbox('Bezeichnung')).toHaveValue('Krankheit');
    await user.click(kindButton('Arbeitszeit'));
    expect(textbox('Bezeichnung')).toHaveValue('');

    await user.type(textbox('Bezeichnung'), 'Krank (Attest)');
    await user.click(kindButton('Krankheit'));
    expect(textbox('Bezeichnung')).toHaveValue('Krank (Attest)');
  });

  it('rejects more than 24 credited hours at the field and saves nothing', async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(kindButton('Krankheit'));
    await user.type(creditedField(), '25');
    await user.click(save());

    expect(screen.getByText('Höchstens 24 Stunden.')).toBeInTheDocument();
    expect(creditedField()).toHaveFocus();
    expect(createMock).not.toHaveBeenCalled();
  });

  it('prefills and updates an existing Urlaub template', async () => {
    const user = userEvent.setup();
    const existing: ShiftTemplate = {
      id: 't3' as ShiftTemplateId,
      branchId,
      name: 'Urlaub nachmittags',
      kind: 'Vacation',
      halfDay: 'afternoon',
      creditedMinutesOverride: 210,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    const { onSaved } = renderDialog(existing);

    expect(kindButton('Urlaub')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('radio', { name: 'Nur nachmittags frei' })).toBeChecked();
    expect(creditedField()).toHaveValue('3,5');
    await user.click(screen.getByRole('radio', { name: 'Ganzer Tag' }));
    await user.click(save());

    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(updateMock.mock.calls[0][0]).toEqual({
      ...existing,
      halfDay: undefined,
    });
  });

  it('übernimmt eine Abwesenheit als Vorbelegung', async () => {
    const user = userEvent.setup();
    const { onSaved } = renderDialog(null, { type: 'Vacation', halfDay: 'afternoon', creditedMinutesOverride: 210 });

    expect(screen.getByText('Neue Vorlage')).toBeInTheDocument();
    expect(kindButton('Urlaub')).toHaveAttribute('aria-pressed', 'true');
    expect(textbox('Bezeichnung')).toHaveValue('Urlaub');
    expect(screen.getByRole('radio', { name: 'Nur nachmittags frei' })).toBeChecked();
    expect(creditedField()).toHaveValue('3,5');
    await user.click(save());

    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(createMock.mock.calls[0][0]).toEqual({
      branchId,
      name: 'Urlaub',
      kind: 'Vacation',
      halfDay: 'afternoon',
      creditedMinutesOverride: 210,
    });
  });

  it('takes a Sonstiges absence\'s Bezeichnung and hours, and counts the prefill as no change', async () => {
    const user = userEvent.setup();
    const { onClose } = renderDialog(null, { type: 'Other', label: 'Inventur', hoursPerDay: 4 });

    expect(kindButton('Sonstiges')).toHaveAttribute('aria-pressed', 'true');
    expect(textbox('Bezeichnung')).toHaveValue('Inventur');
    expect(screen.getByLabelText((t) => t.includes('Stunden'))).toHaveValue('4');

    await user.click(screen.getByRole('button', { name: 'Schließen' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('ShiftTemplateDialog discard confirmation', () => {
  it('closes at once without a change, but asks before the X drops a changed end time', async () => {
    const user = userEvent.setup();
    const { onClose } = renderDialog();

    await user.click(screen.getByRole('button', { name: 'Schließen' }));
    expect(onClose).toHaveBeenCalledTimes(1);

    setTime('Ende', '15:00');
    await user.click(screen.getByRole('button', { name: 'Schließen' }));
    expect(await screen.findByText('Änderungen verwerfen?')).toBeInTheDocument();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
