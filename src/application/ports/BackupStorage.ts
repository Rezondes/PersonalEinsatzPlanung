/** One backup file that lives in the user's remote storage. */
export interface RemoteBackup {
  id: string;
  name: string;
  /** ISO timestamp of the last change, as the storage reports it. */
  modifiedAt: string;
  sizeBytes: number | null;
}

/**
 * Optional remote destination for the JSON backup, next to the existing local file download.
 * Kept as a port so the UI never talks to a provider directly and the whole flow can be tested
 * against a fake - the real sign-in dialog cannot be automated.
 */
export interface BackupStorage {
  /** False when no client id is configured; the UI then hides the feature entirely. */
  isConfigured(): boolean;
  isSignedIn(): boolean;
  /** True when the user connected in an earlier visit. Only this fact is remembered, never the
   * token, so the UI knows whether restoreSession() is worth attempting at all. */
  wasConnected(): boolean;
  /** Shows the provider's sign-in window. Must be called straight from a click - a popup opened
   * later than that gets blocked by the browser. */
  signIn(): Promise<void>;
  /**
   * Renews the authorisation without showing anything, for app start after a reload: the in-memory
   * token is gone, but the user's session with the provider usually still stands. Returns false
   * instead of throwing when the provider wants to ask again - the UI then just shows the sign-in
   * button. Deliberately silent-only, so it is safe to call outside a click.
   */
  restoreSession(): Promise<boolean>;
  signOut(): void;
  list(): Promise<RemoteBackup[]>;
  upload(filename: string, content: unknown): Promise<RemoteBackup>;
  download(id: string): Promise<unknown>;
}
