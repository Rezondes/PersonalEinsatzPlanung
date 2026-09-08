import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { BranchId, ShiftTemplateId } from '@domain/shared/ids';
import { clockTime } from '@domain/shared/ClockTime';
import { createShift } from '@domain/schedule/Shift';
import type { ShiftTemplate } from '@domain/schedule/ShiftTemplate';
import { services } from '@infrastructure/services';
import { ShiftTemplateDialog } from './ShiftTemplateDialog';

vi.mock('@infrastructure/services', () => ({
  services: { shiftTemplate: { create: vi.fn(), update: vi.fn() } },
}));

const createMock = vi.mocked(services.shiftTemplate.create);
const updateMock = vi.mocked(services.shiftTemplate.update);

const branchId = 'b1' as BranchId;

function renderDialog(template: ShiftTemplate | null = null) {
  const onClose = vi.fn();
  const onSaved = vi.fn();
  const onError = vi.fn();
  render(
    <ShiftTemplateDialog
      branchId={branchId}
      template={template}
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
    expect(payload.branchId).toBe(branchId);
    expect(payload.name).toBe('Frühschicht');
    expect(payload.shifts).toHaveLength(1);
    expect(payload.shifts[0].start).toBe('06:00');
    expect(payload.shifts[0].end).toBe('12:00');
    expect(onClose).toHaveBeenCalled();
  });

  it('updates an existing template instead of creating a second one', async () => {
    const user = userEvent.setup();
    const existing: ShiftTemplate = {
      id: 't1' as ShiftTemplateId,
      branchId,
      name: 'Spätschicht',
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
});
