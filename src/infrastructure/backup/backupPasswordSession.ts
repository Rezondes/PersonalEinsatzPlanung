/**
 * Session-only cache for the backup encryption password, mirroring the exact pattern
 * `backup/googleIdentity.ts` uses for the Drive access token: the secret itself lives in a module
 * variable and is never persisted, while a single, worthless-on-its-own boolean in `localStorage`
 * remembers THAT a password was configured, so the UI can show "Festgelegt" and know to prompt
 * again after a reload instead of silently falling back to an unencrypted export.
 */

/** Remembers only THAT a backup password was once set for this browser, never the password itself -
 * the same role `pep.drive.connected` plays for Drive in `googleIdentity.ts`. */
const CONFIGURED_FLAG = 'pep.backup.passwordConfigured';

// Deliberately memory only, never localStorage: a stored password would be readable by any XSS. The
// price is the same one googleIdentity.ts pays for the Drive token - asking again after a reload.
let cachedPassword: string | null = null;

export function isBackupPasswordConfigured(): boolean {
  try {
    return localStorage.getItem(CONFIGURED_FLAG) === '1';
  } catch {
    // Private mode or blocked site data: behave as if no password was ever configured.
    return false;
  }
}

export function setBackupPasswordConfigured(configured: boolean): void {
  try {
    if (configured) {
      localStorage.setItem(CONFIGURED_FLAG, '1');
    } else {
      localStorage.removeItem(CONFIGURED_FLAG);
    }
  } catch {
    // Nothing to do - the feature still works, it just forgets the state after a reload.
  }
}

export function getCachedPassword(): string | null {
  return cachedPassword;
}

export function setCachedPassword(password: string | null): void {
  cachedPassword = password;
}
