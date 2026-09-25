import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '@mui/material/styles';
import type { BranchId } from '@domain/shared/ids';
import type { Branch } from '@domain/branch/Branch';
import { services } from '@infrastructure/services';
import { theme } from '@ui/app/theme';
import StoreOutlinedIcon from '@mui/icons-material/StoreOutlined';
import { BranchDialog } from './BranchDialog';

vi.mock('@infrastructure/services', () => ({
  services: { branch: { create: vi.fn(), update: vi.fn() } },
}));

const createMock = vi.mocked(services.branch.create);
const updateMock = vi.mocked(services.branch.update);

// ThemeProvider wraps the real app theme - the dialog's logo-avatar style reads the custom
// theme.palette.accentSurface key, absent on MUI's own default theme.
// Teil 8, Package 12: same stacked-dialog problem as in the EmployeeDialog.
describe('BranchDialog, secondary actions', () => {
  it('locks them while the form has unsaved changes', async () => {
    const user = userEvent.setup();
    const deactivate = { key: 'deactivate', label: 'Deaktivieren', icon: StoreOutlinedIcon, onSelect: vi.fn() };
    render(
      <ThemeProvider theme={theme}>
        <BranchDialog branch={null} onClose={vi.fn()} onSaved={vi.fn()} onError={vi.fn()} secondaryActions={[deactivate]} />
      </ThemeProvider>,
    );

    await user.type(screen.getByRole('textbox', { name: 'Name' }), 'X');

    expect(screen.getByRole('button', { name: 'Deaktivieren' })).toBeDisabled();
  });
});

function renderDialog() {
  const onClose = vi.fn();
  const onSaved = vi.fn();
  const onError = vi.fn();
  const { container } = render(
    <ThemeProvider theme={theme}>
      <BranchDialog branch={null} onClose={onClose} onSaved={onSaved} onError={onError} />
    </ThemeProvider>,
  );
  return { onClose, onSaved, onError, container };
}

const textbox = (name: string) => screen.getByRole('textbox', { name });
const save = () => screen.getByRole('button', { name: 'Speichern' });
const abbrechen = () => screen.getByRole('button', { name: 'Abbrechen' });
const addSunday = () => screen.getByRole('button', { name: 'Hinzufügen' });
const sundayInput = () => screen.getByLabelText('Datum hinzufügen (optional)');

/** Native date inputs ignore user.type in jsdom; changing the value directly is the reliable way. */
function pickSunday(value: string) {
  fireEvent.change(sundayInput(), { target: { value } });
}

describe('BranchDialog', () => {
  it('does not let the full-width Straße/Ort squeeze the Nr./PLZ fields until their labels are cut off (Teil 5)', () => {
    renderDialog();

    // At 360px "Nr. (optional)" got 63 of its 98px and "PLZ (optional)" 76 of 106px.
    expect(textbox('Nr. (optional)').closest('.MuiFormControl-root')).toHaveStyle({ flexShrink: '0' });
    expect(textbox('PLZ (optional)').closest('.MuiFormControl-root')).toHaveStyle({ flexShrink: '0' });
  });

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

  it('colors the logo avatar and its placeholder icon from the theme, not a hardcoded literal', () => {
    // document.querySelector, not container.querySelector: ResponsiveDialog renders its content
    // into a portal attached to document.body, outside the render() result's own container div.
    renderDialog();

    const avatar = document.querySelector('.MuiAvatar-root');
    expect(avatar).toHaveStyle({ backgroundColor: theme.palette.accentSurface.subtle });
    // Scoped to a descendant of the avatar, not any .MuiSvgIcon-root in the document - the dialog
    // has other icons (e.g. its own close button) with an unrelated default color.
    expect(avatar?.querySelector('.MuiSvgIcon-root')).toHaveStyle({
      color: theme.palette.primary.main,
    });
  });

  // Teil 8, Package 3: rendered as a <label>, the button had no onClick for Enter to call.
  it('opens the logo file picker from the keyboard', async () => {
    const user = userEvent.setup();
    const click = vi.spyOn(HTMLInputElement.prototype, 'click');
    renderDialog();

    screen.getByRole('button', { name: 'Logo hochladen (optional)' }).focus();
    await user.keyboard('{Enter}');

    expect(click).toHaveBeenCalledTimes(1);
    click.mockRestore();
  });

  // Teil 8, Package 20: a logo could only be replaced, never removed.
  it('removes an uploaded logo again', async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.upload(document.querySelector('input[type="file"]') as HTMLInputElement, new File([new Uint8Array(10)], 'logo.png', { type: 'image/png' }));
    await waitFor(() => expect(document.querySelector('img')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Logo entfernen' }));

    expect(document.querySelector('img')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Logo entfernen' })).not.toBeInTheDocument();
  });

  // Teil 8, Package 20: its asterisk claimed a required field; the Filiale saves fine without one.
  it('marks the open-Sunday date as optional', () => {
    renderDialog();

    const field = screen.getByLabelText(/^Datum hinzufügen/);
    expect(field).not.toBeRequired();
    expect(screen.getByLabelText('Datum hinzufügen (optional)')).toBe(field);
  });

  it('hat ein leeres alt-Attribut auf dem Logo-Vorschaubild, sobald ein Logo hochgeladen wurde', async () => {
    const user = userEvent.setup();
    renderDialog();

    const validImage = new File([new Uint8Array(10)], 'logo.png', { type: 'image/png' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, validImage);

    await waitFor(() => expect(document.querySelector('img')).toBeInTheDocument());
    expect(document.querySelector('img')?.getAttribute('alt')).toBe('');
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

describe('BranchDialog discard confirmation', () => {
  it('asks before the X drops a typed name', async () => {
    const user = userEvent.setup();
    const { onClose } = renderDialog();

    await user.type(textbox('Name'), 'Velpke');
    await user.click(screen.getByRole('button', { name: 'Schließen' }));

    expect(await screen.findByText('Änderungen verwerfen?')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });
});
