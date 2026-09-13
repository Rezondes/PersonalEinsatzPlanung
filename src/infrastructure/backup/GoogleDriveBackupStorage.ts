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
  nextPageToken?: string;
}

interface DriveErrorBody {
  error?: { errors?: { reason?: string }[] };
}

/** Multipart uploads are hard-capped by Google at 5 MB; a resumable upload would lift that, but
 * this app's backups are small JSON files and staying on multipart is deliberately simpler - the
 * fix here is only to fail with a clear message before sending, not to lift the limit. */
const MULTIPART_UPLOAD_MAX_BYTES = 5 * 1024 * 1024;

/** Thrown by `call()` when a 401 survives the silent token-refresh retry - i.e. the user's Google
 * session is actually gone (revoked consent, expired refresh token), not just one bad request. Its
 * own class, rather than a plain `Error`, so `SettingsView` can catch this one case specifically
 * and reset `driveSignedIn` back to the "not connected" UI state instead of leaving the buttons for
 * an already-dead session on screen. */
export class DriveSessionExpiredError extends Error {
  constructor(message = 'Die Verbindung zu Google ist abgelaufen. Bitte melde dich erneut mit Google an.') {
    super(message);
    this.name = 'DriveSessionExpiredError';
  }
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
  /** The in-flight folder lookup/creation, if one is already running - so two concurrent callers
   * (e.g. React StrictMode's double-invoke, or two Drive operations kicked off close together)
   * share one request instead of each creating their own "Personaleinsatzplanung" folder. Cleared
   * once the lookup settles either way, so a failure can be retried on the next call. */
  private folderPromise: Promise<string> | null = null;

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
    this.folderPromise = null;
  }

  /** Best-effort extraction of Drive's own reason code from an error body (e.g. 'quotaExceeded',
   * 'userRateLimitExceeded') - undefined for a non-JSON body or an unrecognized shape, in which
   * case the caller falls back to a generic message for that status code. */
  private async errorReason(response: Response): Promise<string | undefined> {
    try {
      const body = (await response.json()) as DriveErrorBody;
      return body.error?.errors?.[0]?.reason;
    } catch {
      return undefined;
    }
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

    // Normalized through the real Headers API (not a plain spread) so a caller-supplied Headers
    // instance is preserved too - {...headers} silently drops a real Headers instance's entries,
    // since its data lives behind getters rather than own enumerable properties.
    const headers = new Headers(init.headers);
    headers.set('Authorization', `Bearer ${token}`);

    let response: Response;
    try {
      response = await fetch(url, { ...init, headers });
    } catch {
      throw new Error('Google Drive ist nicht erreichbar. Besteht eine Internetverbindung?');
    }

    if (response.status === 401) {
      if (retry) {
        try {
          await requestAccessToken(true);
        } catch {
          clearAccessToken();
          throw new DriveSessionExpiredError();
        }
        return this.call(url, init, false);
      }
      // A second 401 even after a successful token refresh means Google itself now rejects the
      // (seemingly valid) new token - the session is genuinely gone, not just this one request.
      clearAccessToken();
      throw new DriveSessionExpiredError();
    }
    if (!response.ok) {
      if (response.status === 429 || response.status === 403) {
        const reason = await this.errorReason(response);
        if (response.status === 429 || reason === 'rateLimitExceeded' || reason === 'userRateLimitExceeded') {
          throw new Error('Zu viele Anfragen an Google Drive. Bitte versuche es in ein paar Minuten erneut.');
        }
        if (reason === 'quotaExceeded' || reason === 'storageQuotaExceeded') {
          throw new Error('Das Google-Drive-Speicherkontingent ist ausgeschöpft.');
        }
        throw new Error('Google Drive hat die Anfrage abgelehnt (Zugriff verweigert).');
      }
      if (response.status >= 500) {
        throw new Error('Google Drive ist momentan nicht erreichbar (Serverfehler). Bitte versuche es später erneut.');
      }
      throw new Error(`Google Drive hat die Anfrage abgelehnt (Fehler ${response.status}).`);
    }
    return response;
  }

  /** Finds the backup folder or creates it. The resolved id is cached for the session, cleared on
   * sign-out; the in-flight promise is cached too (see folderPromise) so concurrent callers share
   * one lookup instead of each creating their own folder. */
  private async ensureFolder(): Promise<string> {
    if (this.folderId) {
      return this.folderId;
    }
    if (!this.folderPromise) {
      this.folderPromise = this.resolveFolder().finally(() => {
        this.folderPromise = null;
      });
    }
    return this.folderPromise;
  }

  private async resolveFolder(): Promise<string> {
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
    const files: DriveFile[] = [];
    let pageToken: string | undefined;
    do {
      const pageParam = pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : '';
      const response = await this.call(
        `${DRIVE_API}/files?q=${query}&orderBy=modifiedTime desc&fields=files(id,name,modifiedTime,size),nextPageToken${pageParam}`,
      );
      const result = (await response.json()) as DriveFileList;
      files.push(...(result.files ?? []));
      pageToken = result.nextPageToken;
    } while (pageToken);
    return files.map(toRemoteBackup);
  }

  async upload(filename: string, content: unknown): Promise<RemoteBackup> {
    const folderId = await this.ensureFolder();
    const boundary = `pep-${crypto.randomUUID()}`;
    const metadata = { name: filename, parents: [folderId], mimeType: 'application/json' };
    const body =
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
      `--${boundary}\r\nContent-Type: application/json\r\n\r\n${JSON.stringify(content, null, 2)}\r\n` +
      `--${boundary}--`;

    if (new TextEncoder().encode(body).length > MULTIPART_UPLOAD_MAX_BYTES) {
      throw new Error('Die Sicherung ist zu groß für den Upload zu Google Drive (Limit: 5 MB).');
    }

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
