import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { services } from '@infrastructure/services';
import { AppNotifications } from '@ui/app/AppNotifications';
import { useNotificationStore } from '@ui/app/store/notificationStore';
import { SettingsView } from './SettingsView';

vi.mock('@infrastructure/services', () => ({
  services: {
    backupStorage: {
      isConfigured: vi.fn(() => true),
      isSignedIn: vi.fn(() => false),
      wasConnected: vi.fn(() => false),
      restoreSession: vi.fn(async () => false),
      signIn: vi.fn(async () => undefined),
      signOut: vi.fn(),
      list: vi.fn(async () => []),
      upload: vi.fn(),
      download: vi.fn(),
      delete: vi.fn(async () => undefined),
    },
    dataExport: {
      export: vi.fn(async () => ({ formatVersion: 4 })),
      importAndReplace: vi.fn(async () => undefined),
      deleteAllData: vi.fn(),
    },
  },
}));

const drive = vi.mocked(services.backupStorage);

// AppNotifications comes along because feedback no longer lives in this view's own tree - it is
// mounted once in App.tsx so it also reaches the print route. Rendering the view alone would test
// an app whose messages go nowhere.
const renderView = () =>
  render(
    <MemoryRouter>
      <SettingsView />
      <AppNotifications />
    </MemoryRouter>,
  );

const signInButton = () => screen.queryByRole('button', { name: 'Mit Google anmelden' });
const saveToDrive = () => screen.findByRole('button', { name: 'In Google Drive sichern' });

describe('SettingsView, Google Drive section', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // The store is a module singleton; a queued message would otherwise leak into the next test.
    useNotificationStore.getState().clear();
    drive.isConfigured.mockReturnValue(true);
    drive.isSignedIn.mockReturnValue(false);
    drive.wasConnected.mockReturnValue(false);
    drive.restoreSession.mockResolvedValue(false);
  });

  it('hides the whole section while no client id is configured', () => {
    drive.isConfigured.mockReturnValue(false);
    renderView();

    expect(screen.queryByText('Google Drive')).not.toBeInTheDocument();
    expect(signInButton()).not.toBeInTheDocument();
  });

  it('asks a first-time visitor to sign in and does not touch Google on its own', () => {
    renderView();

    expect(signInButton()).toBeInTheDocument();
    expect(drive.restoreSession).not.toHaveBeenCalled();
    expect(drive.signIn).not.toHaveBeenCalled();
  });

  it('renews a previous connection silently, so the reload after an import does not sign you out', async () => {
    // What the page looks like right after performImport's window.location.reload(): the in-memory
    // token is gone, but the user connected before.
    drive.wasConnected.mockReturnValue(true);
    drive.restoreSession.mockResolvedValue(true);
    renderView();

    expect(await saveToDrive()).toBeInTheDocument();
    expect(drive.restoreSession).toHaveBeenCalledTimes(1);
    // The whole point: no second trip through the Google dialog.
    expect(drive.signIn).not.toHaveBeenCalled();
    expect(signInButton()).not.toBeInTheDocument();
  });

  it('falls back to the sign-in button when Google wants to see the user again', async () => {
    drive.wasConnected.mockReturnValue(true);
    drive.restoreSession.mockResolvedValue(false);
    renderView();

    await waitFor(() => expect(signInButton()).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'In Google Drive sichern' })).not.toBeInTheDocument();
  });

  it('lets a lapsed connection be dropped for good, so nothing reaches for Google again', async () => {
    drive.wasConnected.mockReturnValue(true);
    drive.restoreSession.mockResolvedValue(false);
    renderView();

    await waitFor(() => expect(signInButton()).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: 'Google Drive nicht mehr verwenden' }));

    expect(drive.signOut).toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Google Drive nicht mehr verwenden' })).not.toBeInTheDocument();
    expect(signInButton()).toBeInTheDocument();
  });

  it('offers no such opt-out to someone who never connected', () => {
    renderView();

    expect(signInButton()).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Google Drive nicht mehr verwenden' })).not.toBeInTheDocument();
  });

  it('does not leave the section stuck when the silent renewal throws', async () => {
    drive.wasConnected.mockReturnValue(true);
    drive.restoreSession.mockRejectedValue(new Error('kaputt'));
    renderView();

    await waitFor(() => expect(signInButton()).toBeInTheDocument());
  });

  it('names the uploaded file with date and time', async () => {
    drive.isSignedIn.mockReturnValue(true);
    drive.upload.mockResolvedValue({
      id: 'f1',
      name: 'pep-backup-2026-09-08_14-32-05.json',
      modifiedAt: '2026-09-08T12:32:05.000Z',
      sizeBytes: 10,
    });
    renderView();

    await userEvent.click(await saveToDrive());

    await waitFor(() => expect(drive.upload).toHaveBeenCalled());
    expect(drive.upload.mock.calls[0][0]).toMatch(/^pep-backup-\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.json$/);
  });

  it('routes a backup chosen from Drive into the same import confirmation as a local file', async () => {
    drive.isSignedIn.mockReturnValue(true);
    drive.list.mockResolvedValue([
      {
        id: 'f1',
        name: 'pep-backup-2026-09-08_14-32-05.json',
        modifiedAt: '2026-09-08T12:32:05.000Z',
        sizeBytes: 2048,
      },
    ]);
    drive.download.mockResolvedValue({ formatVersion: 4 });
    renderView();

    await userEvent.click(await screen.findByRole('button', { name: 'Aus Google Drive laden' }));
    await userEvent.click(await screen.findByText('pep-backup-2026-09-08_14-32-05.json'));

    expect(await screen.findByText('Daten importieren?')).toBeInTheDocument();
    expect(drive.download).toHaveBeenCalledWith('f1');
    // Nothing is replaced until the user confirms.
    expect(services.dataExport.importAndReplace).not.toHaveBeenCalled();
  });

  it('reports a failed download instead of opening an empty confirmation', async () => {
    drive.isSignedIn.mockReturnValue(true);
    drive.list.mockResolvedValue([
      { id: 'f1', name: 'kaputt.json', modifiedAt: '2026-09-08T12:32:05.000Z', sizeBytes: 10 },
    ]);
    drive.download.mockRejectedValue(new Error('Die Verbindung zu Google ist abgelaufen.'));
    renderView();

    await userEvent.click(await screen.findByRole('button', { name: 'Aus Google Drive laden' }));
    await userEvent.click(await screen.findByText('kaputt.json'));

    expect(await screen.findByText('Die Verbindung zu Google ist abgelaufen.')).toBeInTheDocument();
    expect(screen.queryByText('Daten importieren?')).not.toBeInTheDocument();
  });
});
