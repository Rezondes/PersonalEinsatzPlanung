import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { GoogleDriveBackupStorage, DriveSessionExpiredError } from './GoogleDriveBackupStorage';
import { currentAccessToken, requestAccessToken, clearAccessToken } from './googleIdentity';

vi.mock('./googleIdentity', () => ({
  currentAccessToken: vi.fn(),
  requestAccessToken: vi.fn(),
  clearAccessToken: vi.fn(),
  forgetAccessToken: vi.fn(),
  wasConnected: vi.fn(),
}));

function jsonResponse(status: number, body: unknown = {}): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

function folderFoundResponse(): Response {
  return jsonResponse(200, { files: [{ id: 'folder-1' }] });
}

beforeEach(() => {
  vi.mocked(currentAccessToken).mockReturnValue('token-1');
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('GoogleDriveBackupStorage', () => {
  describe('second 401 after a successful token refresh (H4)', () => {
    it('throws DriveSessionExpiredError instead of the generic rejection message', async () => {
      vi.mocked(requestAccessToken).mockResolvedValue('token-2');
      vi.stubGlobal(
        'fetch',
        vi
          .fn()
          .mockResolvedValueOnce(folderFoundResponse())
          .mockResolvedValueOnce(jsonResponse(401))
          .mockResolvedValueOnce(jsonResponse(401)),
      );

      const storage = new GoogleDriveBackupStorage();

      await expect(storage.list()).rejects.toBeInstanceOf(DriveSessionExpiredError);
      expect(clearAccessToken).toHaveBeenCalled();
    });
  });

  describe('list() pagination (M3)', () => {
    it('follows nextPageToken across multiple pages instead of returning only the first', async () => {
      vi.stubGlobal(
        'fetch',
        vi
          .fn()
          .mockResolvedValueOnce(folderFoundResponse())
          .mockResolvedValueOnce(
            jsonResponse(200, { files: [{ id: 'f1', name: 'a.json' }], nextPageToken: 'page-2' }),
          )
          .mockResolvedValueOnce(jsonResponse(200, { files: [{ id: 'f2', name: 'b.json' }] })),
      );

      const storage = new GoogleDriveBackupStorage();
      const result = await storage.list();

      expect(result.map((r) => r.id)).toEqual(['f1', 'f2']);
      const secondPageUrl = vi.mocked(fetch).mock.calls[2][0] as string;
      expect(secondPageUrl).toContain('pageToken=page-2');
    });
  });

  describe('upload() size guard (M4)', () => {
    it('throws before making the upload request when the body exceeds the 5MB multipart limit', async () => {
      const fetchMock = vi.fn().mockResolvedValueOnce(folderFoundResponse());
      vi.stubGlobal('fetch', fetchMock);

      const storage = new GoogleDriveBackupStorage();
      const hugeContent = { blob: 'x'.repeat(6 * 1024 * 1024) };

      await expect(storage.upload('backup.json', hugeContent)).rejects.toThrow(/zu groß/i);
      expect(fetchMock).toHaveBeenCalledTimes(1); // only ensureFolder's lookup, never the upload itself
    });

    it('still uploads a body well under the limit', async () => {
      vi.stubGlobal(
        'fetch',
        vi
          .fn()
          .mockResolvedValueOnce(folderFoundResponse())
          .mockResolvedValueOnce(jsonResponse(200, { id: 'f1', name: 'backup.json' })),
      );

      const storage = new GoogleDriveBackupStorage();
      await expect(storage.upload('backup.json', { hello: 'world' })).resolves.toMatchObject({ id: 'f1' });
    });
  });

  describe('distinguishable error messages for 403/429/5xx (M5)', () => {
    it('reports a quota-exceeded 403 distinctly', async () => {
      vi.stubGlobal(
        'fetch',
        vi
          .fn()
          .mockResolvedValueOnce(folderFoundResponse())
          .mockResolvedValueOnce(jsonResponse(403, { error: { errors: [{ reason: 'quotaExceeded' }] } })),
      );
      const storage = new GoogleDriveBackupStorage();
      await expect(storage.list()).rejects.toThrow(/kontingent/i);
    });

    it('reports a rate-limit 403 distinctly from a quota 403', async () => {
      vi.stubGlobal(
        'fetch',
        vi
          .fn()
          .mockResolvedValueOnce(folderFoundResponse())
          .mockResolvedValueOnce(jsonResponse(403, { error: { errors: [{ reason: 'userRateLimitExceeded' }] } })),
      );
      const storage = new GoogleDriveBackupStorage();
      await expect(storage.list()).rejects.toThrow(/anfragen/i);
    });

    it('reports a 429 the same way as a rate-limit 403', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValueOnce(folderFoundResponse()).mockResolvedValueOnce(jsonResponse(429, {})),
      );
      const storage = new GoogleDriveBackupStorage();
      await expect(storage.list()).rejects.toThrow(/anfragen/i);
    });

    it('reports a 5xx as a distinct, transient server error', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValueOnce(folderFoundResponse()).mockResolvedValueOnce(jsonResponse(503, {})),
      );
      const storage = new GoogleDriveBackupStorage();
      await expect(storage.list()).rejects.toThrow(/serverfehler/i);
    });
  });

  describe('ensureFolder() in-flight de-duplication (N3)', () => {
    it('performs only one folder lookup when two operations race concurrently', async () => {
      const fetchMock = vi.fn(async (url: string) =>
        url.includes('mimeType') ? folderFoundResponse() : jsonResponse(200, { files: [] }),
      );
      vi.stubGlobal('fetch', fetchMock);

      const storage = new GoogleDriveBackupStorage();
      await Promise.all([storage.list(), storage.list()]);

      const folderLookupCalls = fetchMock.mock.calls.filter(([url]) => (url as string).includes('mimeType'));
      expect(folderLookupCalls).toHaveLength(1);
    });
  });
});
