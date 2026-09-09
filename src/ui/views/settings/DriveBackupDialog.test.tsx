import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { RemoteBackup } from '@application/ports/BackupStorage';
import { services } from '@infrastructure/services';
import { DriveBackupDialog } from './DriveBackupDialog';

// The real adapter talks to Google, which cannot be automated. The port exists precisely so the
// whole flow can be driven from a fake instead.
vi.mock('@infrastructure/services', () => ({
  services: { backupStorage: { list: vi.fn(), delete: vi.fn() } },
}));

const listMock = vi.mocked(services.backupStorage.list);
const deleteMock = vi.mocked(services.backupStorage.delete);

const backup = (overrides: Partial<RemoteBackup> = {}): RemoteBackup => ({
  id: 'file-1',
  name: 'pep-backup-2026-09-08_14-32-05.json',
  modifiedAt: '2026-09-08T12:32:05.000Z',
  sizeBytes: 245_760,
  ...overrides,
});

function renderDialog() {
  const onClose = vi.fn();
  const onSelect = vi.fn();
  const onError = vi.fn();
  render(<DriveBackupDialog onClose={onClose} onSelect={onSelect} onError={onError} />);
  return { onClose, onSelect, onError };
}

/** Once the nested confirmation is open there are TWO "Abbrechen" buttons in the document, so an
 * unqualified query is ambiguous. This one always means the picker's. */
const pickerCancel = () => within(screen.getByRole('dialog', { name: /laden oder löschen/ })).getByRole('button', { name: 'Abbrechen' });

describe('DriveBackupDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    deleteMock.mockResolvedValue(undefined);
  });

  it('lists the backups with a German date and their size', async () => {
    listMock.mockResolvedValue([backup()]);
    renderDialog();

    expect(await screen.findByText('pep-backup-2026-09-08_14-32-05.json')).toBeInTheDocument();
    expect(screen.getByText(/Gesichert am 08\.09\.2026/)).toBeInTheDocument();
    expect(screen.getByText(/240 KB/)).toBeInTheDocument();
  });

  it('hands the chosen backup to the parent, which runs the usual import confirmation', async () => {
    const chosen = backup({ id: 'file-2', name: 'zweites-backup.json' });
    listMock.mockResolvedValue([backup(), chosen]);
    const { onSelect } = renderDialog();

    await userEvent.click(await screen.findByText('zweites-backup.json'));

    expect(onSelect).toHaveBeenCalledWith(chosen);
  });

  it('says what to do when Drive holds no backup instead of showing an empty box', async () => {
    listMock.mockResolvedValue([]);
    renderDialog();

    expect(await screen.findByText(/In Google Drive liegt keine Sicherung/)).toBeInTheDocument();
  });

  it('shows the storage error message rather than an endless spinner', async () => {
    listMock.mockRejectedValue(new Error('Google Drive ist nicht erreichbar. Besteht eine Internetverbindung?'));
    renderDialog();

    expect(await screen.findByRole('alert')).toHaveTextContent('Google Drive ist nicht erreichbar.');
  });

  it('closes without selecting anything on Abbrechen', async () => {
    listMock.mockResolvedValue([backup()]);
    const { onClose, onSelect } = renderDialog();
    await waitFor(() => expect(listMock).toHaveBeenCalled());

    await userEvent.click(pickerCancel());

    expect(onClose).toHaveBeenCalled();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('asks before deleting, and says the file goes to the trash rather than promising an erase', async () => {
    listMock.mockResolvedValue([backup()]);
    renderDialog();

    await userEvent.click(await screen.findByRole('button', { name: /löschen$/ }));

    expect(screen.getByText('Sicherung löschen?')).toBeInTheDocument();
    expect(screen.getByText(/Papierkorb von Google Drive/)).toBeInTheDocument();
    expect(screen.getByText(/30 Tagen/)).toBeInTheDocument();
    // Nothing happens until the second confirmation.
    expect(deleteMock).not.toHaveBeenCalled();
  });

  it('leaves the backup alone when the confirmation is dismissed', async () => {
    listMock.mockResolvedValue([backup()]);
    renderDialog();

    await userEvent.click(await screen.findByRole('button', { name: /löschen$/ }));
    await userEvent.click(within(screen.getByRole('dialog', { name: 'Sicherung löschen?' })).getByRole('button', { name: 'Abbrechen' }));

    expect(deleteMock).not.toHaveBeenCalled();
    expect(screen.getByText('pep-backup-2026-09-08_14-32-05.json')).toBeInTheDocument();
  });

  it('deletes the confirmed backup and drops its row', async () => {
    const keep = backup({ id: 'file-2', name: 'bleibt.json' });
    listMock.mockResolvedValue([backup(), keep]);
    renderDialog();

    await userEvent.click(await screen.findByRole('button', { name: 'pep-backup-2026-09-08_14-32-05.json löschen' }));
    await userEvent.click(screen.getByRole('button', { name: 'Löschen' }));

    expect(deleteMock).toHaveBeenCalledWith('file-1');
    // The row goes only once the request has settled, so this has to wait for it.
    await waitFor(() =>
      expect(screen.queryByText('pep-backup-2026-09-08_14-32-05.json')).not.toBeInTheDocument(),
    );
    expect(screen.getByText('bleibt.json')).toBeInTheDocument();
  });

  it('hands a failed delete to the parent and keeps the row', async () => {
    listMock.mockResolvedValue([backup()]);
    deleteMock.mockRejectedValue(new Error('Google Drive hat die Anfrage abgelehnt (Fehler 403).'));
    const { onError } = renderDialog();

    await userEvent.click(await screen.findByRole('button', { name: /löschen$/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Löschen' }));

    // The parent owns the message: this dialog is unmounted on close and would take it along.
    await waitFor(() => expect(onError).toHaveBeenCalled());
    expect(onError.mock.calls[0][1]).toBe('Die Sicherung konnte nicht gelöscht werden');
    expect(screen.getByText('pep-backup-2026-09-08_14-32-05.json')).toBeInTheDocument();
  });

  it('offers to create one when the last backup has just been deleted, without saying "noch"', async () => {
    listMock.mockResolvedValue([backup()]);
    renderDialog();

    await userEvent.click(await screen.findByRole('button', { name: /löschen$/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Löschen' }));

    expect(await screen.findByText(/In Google Drive liegt keine Sicherung/)).toBeInTheDocument();
    expect(screen.queryByText(/noch keine Sicherung/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Lege zuerst/)).not.toBeInTheDocument();
  });
});
