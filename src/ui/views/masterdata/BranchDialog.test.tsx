import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { BranchId } from '@domain/shared/ids';
import { services } from '@infrastructure/services';
import { BranchDialog } from './BranchDialog';

vi.mock('@infrastructure/services', () => ({
  services: { branch: { create: vi.fn(), update: vi.fn() } },
}));

const createMock = vi.mocked(services.branch.create);
const updateMock = vi.mocked(services.branch.update);

function renderDialog() {
  const onClose = vi.fn();
  const onSaved = vi.fn();
  const onError = vi.fn();
  render(<BranchDialog branch={null} onClose={onClose} onSaved={onSaved} onError={onError} />);
  return { onClose, onSaved, onError };
}

const textbox = (name: string) => screen.getByRole('textbox', { name });
const save = () => screen.getByRole('button', { name: 'Speichern' });
const addSunday = () => screen.getByRole('button', { name: 'Hinzufügen' });
const sundayInput = () => screen.getByLabelText('Datum hinzufügen');

/** Native date inputs ignore user.type in jsdom; changing the value directly is the reliable way. */
function pickSunday(value: string) {
  fireEvent.change(sundayInput(), { target: { value } });
}

describe('BranchDialog', () => {
  beforeEach(() => {
    createMock.mockReset();
    updateMock.mockReset();
    createMock.mockImplementation(async (details) => ({
      id: 'b-new' as BranchId,
      name: details.name,
      branchNumber: details.branchNumber,
      federalState: details.federalState,
      address: details.address ?? { street: '', houseNumber: '', postalCode: '', city: '' },
      logoBase64: details.logoBase64 ?? null,
      allowedOpenSundays: [],
      active: true,
      createdAt: '',
      updatedAt: '',
    }));
    updateMock.mockImplementation(async (branch) => branch);
  });

  it('marks Name and Filialnummer as required and the address as optional', () => {
    renderDialog();

    expect(screen.getByText('* Pflichtfeld')).toBeInTheDocument();
    expect(textbox('Name')).toBeRequired();
    expect(textbox('Filialnummer')).toBeRequired();
    expect(textbox('Straße (optional)')).not.toBeRequired();
    expect(textbox('Ort (optional)')).not.toBeRequired();
    expect(screen.getByText('Logo hochladen (optional)')).toBeInTheDocument();
  });

  it('shows both missing fields, focuses Name and saves nothing on an empty form', async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(save());

    expect(screen.getByText('Bitte Namen der Filiale eingeben.')).toBeInTheDocument();
    expect(screen.getByText('Bitte Filialnummer eingeben.')).toBeInTheDocument();
    expect(textbox('Name')).toHaveFocus();
    expect(createMock).not.toHaveBeenCalled();
  });

  it('only accepts Sundays that are not yet in the list', async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(addSunday());
    expect(screen.getByText('Bitte ein Datum wählen.')).toBeInTheDocument();

    pickSunday('2026-09-14');
    await user.click(addSunday());
    expect(screen.getByText('Das Datum ist kein Sonntag.')).toBeInTheDocument();

    pickSunday('2026-09-13');
    await user.click(addSunday());
    expect(screen.getByText('13.09.2026')).toBeInTheDocument();
    expect(sundayInput()).toHaveValue('');
    expect(screen.queryByText('Das Datum ist kein Sonntag.')).not.toBeInTheDocument();

    pickSunday('2026-09-13');
    await user.click(addSunday());
    expect(screen.getByText('Dieses Datum ist bereits eingetragen.')).toBeInTheDocument();
  });

  it('creates the branch and then stores the added Sundays', async () => {
    const user = userEvent.setup();
    const { onClose, onSaved } = renderDialog();

    await user.type(textbox('Name'), 'Velpke');
    await user.type(textbox('Filialnummer'), '2504');
    pickSunday('2026-09-13');
    await user.click(addSunday());
    await user.click(save());

    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(createMock).toHaveBeenCalledWith({
      name: 'Velpke',
      branchNumber: '2504',
      federalState: 'Niedersachsen',
      address: { street: '', houseNumber: '', postalCode: '', city: '' },
      logoBase64: null,
    });
    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({ id: 'b-new', allowedOpenSundays: ['2026-09-13'] }));
    expect(onClose).toHaveBeenCalled();
  });
});
