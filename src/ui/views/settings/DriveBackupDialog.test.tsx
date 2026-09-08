import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { RemoteBackup } from '@application/ports/BackupStorage';
import { services } from '@infrastructure/services';
import { DriveBackupDialog } from './DriveBackupDialog';

// The real adapter talks to Google, which cannot be automated. The port exists precisely so the
// whole flow can be driven from a fake instead.
vi.mock('@infrastructure/services', () => ({
  services: { backupStorage: { list: vi.fn() } },
}));

const listMock = vi.mocked(services.backupStorage.list);

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
  render(<DriveBackupDialog onClose={onClose} onSelect={onSelect} />);
  return { onClose, onSelect };
}

describe('DriveBackupDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  it('says what to do when Drive holds no backup yet instead of showing an empty box', async () => {
    listMock.mockResolvedValue([]);
    renderDialog();

    expect(await screen.findByText(/noch keine Sicherung/)).toBeInTheDocument();
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

    await userEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));

    expect(onClose).toHaveBeenCalled();
    expect(onSelect).not.toHaveBeenCalled();
  });
});
