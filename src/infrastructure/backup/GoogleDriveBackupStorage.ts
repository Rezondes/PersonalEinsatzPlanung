import type { BackupStorage, RemoteBackup } from '@application/ports/BackupStorage';
import { BACKUP_FOLDER_NAME, GOOGLE_CLIENT_ID } from './googleConfig';
import { clearAccessToken, currentAccessToken, forgetAccessToken, requestAccessToken, wasConnected as hasConnectedBefore } from './googleIdentity';

const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';
const FOLDER_MIME = 'application/vnd.google-apps.folder';

interface DriveFile {
  id: string;
  name: string;
  modifiedTime?: string;
  size?: string;
}

interface DriveFileList {
  files?: DriveFile[];
}

function toRemoteBackup(file: DriveFile): RemoteBackup {
  return {
    id: file.id,
    name: file.name,
    modifiedAt: file.modifiedTime ?? '',
    sizeBytes: file.size ? Number(file.size) : null,
  };
}

/**
 * Google Drive as an optional destination for the JSON backup, next to the local file download.
 *
 * Uses the drive.file scope, so every call here can only ever touch files this app created itself -
 * the rest of the user's Drive stays invisible to it. Backups go into a normal, visible folder so
 * they can be seen, tidied up and downloaded by hand in Drive as well as from inside the app.
 */
export class GoogleDriveBackupStorage implements BackupStorage {
  private folderId: string | null = null;

  isConfigured(): boolean {
    return GOOGLE_CLIENT_ID.length > 0;
  }

  isSignedIn(): boolean {
    return currentAccessToken() !== null;
  }

  wasConnected(): boolean {
    return hasConnectedBefore();
  }

  async signIn(): Promise<void> {
    await requestAccessToken(false);
  }

  async restoreSession(): Promise<boolean> {
    if (currentAccessToken()) {
      return true;
    }
    if (!hasConnectedBefore()) {
      return false;
    }
    try {
      await requestAccessToken(true);
      return true;
    } catch {
      // Google wants to see the user again (session expired, consent withdrawn, third-party
      // cookies blocked). Not an error worth showing - the sign-in button is right there.
      return false;
    }
  }

  signOut(): void {
    forgetAccessToken();
    this.folderId = null;
  }

  /**
   * One Drive call with the current token. On 401 the token is renewed once without bothering the
   * user (their Google session usually still stands) and the call is retried exactly once.
   */
  private async call(url: string, init: RequestInit = {}, retry = true): Promise<Response> {
    const token = currentAccessToken();
    if (!token) {
      throw new Error('Nicht mit Google verbunden.');
    }

    let response: Response;
    try {
      response = await fetch(url, {
        ...init,
        headers: { ...init.headers, Authorization: `Bearer ${token}` },
      });
    } catch {
      throw new Error('Google Drive ist nicht erreichbar. Besteht eine Internetverbindung?');
    }

    if (response.status === 401 && retry) {
      try {
        await requestAccessToken(true);
      } catch {
        clearAccessToken();
        throw new Error('Die Verbindung zu Google ist abgelaufen. Bitte melde dich erneut mit Google an.');
      }
      return this.call(url, init, false);
    }
    if (!response.ok) {
      throw new Error(`Google Drive hat die Anfrage abgelehnt (Fehler ${response.status}).`);
    }
    return response;
  }

  /** Finds the backup folder or creates it. Cached for the session, cleared on sign-out. */
  private async ensureFolder(): Promise<string> {
    if (this.folderId) {
      return this.folderId;
    }

    const query = encodeURIComponent(
      `name = '${BACKUP_FOLDER_NAME}' and mimeType = '${FOLDER_MIME}' and trashed = false`,
    );
    const response = await this.call(`${DRIVE_API}/files?q=${query}&fields=files(id)`);
    const found = (await response.json()) as DriveFileList;
    const existing = found.files?.[0];
    if (existing) {
      this.folderId = existing.id;
      return existing.id;
    }

    const createResponse = await this.call(`${DRIVE_API}/files?fields=id`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: BACKUP_FOLDER_NAME, mimeType: FOLDER_MIME }),
    });
    const created = (await createResponse.json()) as DriveFile;
    this.folderId = created.id;
    return created.id;
  }

  async list(): Promise<RemoteBackup[]> {
    const folderId = await this.ensureFolder();
    const query = encodeURIComponent(`'${folderId}' in parents and trashed = false`);
    const response = await this.call(
      `${DRIVE_API}/files?q=${query}&orderBy=modifiedTime desc&fields=files(id,name,modifiedTime,size)`,
    );
    const result = (await response.json()) as DriveFileList;
    return (result.files ?? []).map(toRemoteBackup);
  }

  async upload(filename: string, content: unknown): Promise<RemoteBackup> {
    const folderId = await this.ensureFolder();
    const boundary = `pep-${crypto.randomUUID()}`;
    const metadata = { name: filename, parents: [folderId], mimeType: 'application/json' };
    const body =
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
      `--${boundary}\r\nContent-Type: application/json\r\n\r\n${JSON.stringify(content, null, 2)}\r\n` +
      `--${boundary}--`;

    const response = await this.call(
      `${DRIVE_UPLOAD_API}/files?uploadType=multipart&fields=id,name,modifiedTime,size`,
      {
        method: 'POST',
        headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
        body,
      },
    );
    return toRemoteBackup((await response.json()) as DriveFile);
  }

  /**
   * Moves a backup to Drive's trash rather than erasing it. The same scope would allow a real
   * DELETE, but this is frequently the user's only second copy of their data and one mis-tap would
   * be unrecoverable; in the trash it can be restored for 30 days from Drive itself. list() already
   * filters `trashed = false`, so it disappears from the app immediately either way.
   */
  async delete(id: string): Promise<void> {
    await this.call(`${DRIVE_API}/files/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trashed: true }),
    });
  }

  async download(id: string): Promise<unknown> {
    const response = await this.call(`${DRIVE_API}/files/${encodeURIComponent(id)}?alt=media`);
    try {
      return await response.json();
    } catch {
      throw new Error('Die Sicherung in Google Drive enthält kein gültiges JSON.');
    }
  }
}
