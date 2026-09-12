import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { BranchId } from '@domain/shared/ids';
import type { Branch } from '@domain/branch/Branch';
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
const abbrechen = () => screen.getByRole('button', { name: 'Abbrechen' });
const addSunday = () => screen.getByRole('button', { name: 'Hinzufügen' });
// A required field's accessible name gets MUI's appended " *", so an exact match against the bare
// label would stop matching once "Datum hinzufügen" becomes required.
const sundayInput = () => screen.getByLabelText(/^Datum hinzufügen\s*\*?$/);

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

  it('marks "Datum hinzufügen" as required', () => {
    renderDialog();

    expect(sundayInput()).toBeRequired();
  });

  it('disables Abbrechen and shows a busy Speichern while saving, and Abbrechen has no effect meanwhile', async () => {
    const user = userEvent.setup();
    let resolveCreate!: (value: Branch) => void;
    createMock.mockReturnValue(
      new Promise<Branch>((res) => {
        resolveCreate = res;
      }),
    );
    const { onClose } = renderDialog();

    await user.type(textbox('Name'), 'Velpke');
    await user.type(textbox('Filialnummer'), '2504');
    await user.click(save());

    const savingButton = save();
    expect(savingButton).toBeDisabled();
    expect(within(savingButton).getByRole('progressbar')).toBeInTheDocument();
    // A genuinely disabled button already proves a click can have no effect - userEvent (unlike
    // fireEvent) simulates real pointer-events and throws rather than clicking it anyway.
    expect(abbrechen()).toBeDisabled();
    expect(onClose).not.toHaveBeenCalled();

    resolveCreate({
      id: 'b-new' as BranchId,
      name: 'Velpke',
      branchNumber: '2504',
      federalState: 'Niedersachsen',
      address: { street: '', houseNumber: '', postalCode: '', city: '' },
      logoBase64: null,
      allowedOpenSundays: [],
      active: true,
      createdAt: '',
      updatedAt: '',
    });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('rejects a logo file over the size limit instead of reading it without bound', async () => {
    const user = userEvent.setup();
    const { onError } = renderDialog();

    const oversized = new File([new Uint8Array(600 * 1024)], 'logo.png', { type: 'image/png' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, oversized);

    await waitFor(() => expect(onError).toHaveBeenCalledWith(expect.any(Error), 'Logo konnte nicht gelesen werden'));
    expect((onError.mock.calls[0][0] as Error).message).toContain('500 KB');
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('rejects a non-image logo file instead of reading it', async () => {
    const { onError } = renderDialog();

    const wrongType = new File(['nicht wirklich ein Bild'], 'logo.txt', { type: 'text/plain' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    // userEvent.upload enforces the input's own accept="image/*" the way a native file picker
    // would and silently refuses a non-matching file - but accept is only a picker hint, not an
    // enforcement mechanism, so a real user can still get a non-image file past it via drag-and-
    // drop. fireEvent.change bypasses that emulation and reaches the handler directly, same as the
    // native date input above.
    fireEvent.change(input, { target: { files: [wrongType] } });

    await waitFor(() => expect(onError).toHaveBeenCalledWith(expect.any(Error), 'Logo konnte nicht gelesen werden'));
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});
