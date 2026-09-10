import type { PepExportFile } from '@application/export/jsonExportFormat';
import type { EncryptedBackupEnvelope } from '@application/export/encryptedExportFormat';

/**
 * Wraps a `PepExportFile` into a password-encrypted `EncryptedBackupEnvelope` and back. Pure
 * `crypto.subtle` wrapping layer around the existing export format - `dataExportService.ts`,
 * `jsonMigrations.ts` and `fileAccess.ts` are untouched and know nothing about encryption.
 *
 * There is deliberately no recovery mechanism: the password never leaves the browser, is never
 * stored anywhere (see `backup/backupPasswordSession.ts`), and nothing here derives a recovery
 * code or escrow key. A forgotten password makes the backups made with it permanently
 * unreadable - the UI (`BackupPasswordDialog.tsx`) states this plainly before a password is set.
 */

/** Fixed rather than benchmarked: this is a client-side, one-user-at-a-time app, not a server that
 * needs to tune cost against load. 600,000 is OWASP's current PBKDF2-HMAC-SHA256 baseline. */
export const PBKDF2_ITERATIONS = 600_000;

const SALT_LENGTH_BYTES = 16;
const IV_LENGTH_BYTES = 12;

/** `btoa(String.fromCharCode(...bytes))` throws `RangeError: Maximum call stack size exceeded` once
 * `bytes` is more than a few tens of thousands of elements - a real risk here, since a backup can be
 * several MB. Building the binary string in fixed-size chunks keeps every spread well under the
 * engine's argument-count limit regardless of file size. */
const BASE64_CHUNK_SIZE = 8192;

function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += BASE64_CHUNK_SIZE) {
    const chunk = bytes.subarray(offset, offset + BASE64_CHUNK_SIZE);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

function base64ToBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/** Thrown by `decryptBackup` when `crypto.subtle.decrypt` rejects - AES-GCM authenticates the
 * ciphertext, so that happens for exactly two reasons: a wrong password or corrupted/tampered
 * ciphertext. There is no way (and no need) to tell those apart; the UI shows one message either
 * way and lets the user retry the password. */
export class WrongPasswordError extends Error {
  constructor(message = 'Falsches Passwort oder beschädigte Sicherung.') {
    super(message);
    this.name = 'WrongPasswordError';
  }
}

/** `usages` is passed in rather than always requesting both: `encryptBackup` only ever needs
 * `encrypt`, `decryptBackup` only `decrypt`, and `extractable: false` means the key can never leave
 * this module either way. */
async function deriveKey(password: string, salt: Uint8Array, usages: KeyUsage[]): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    usages,
  );
}

/** Encrypts a `PepExportFile` for a password. A fresh random salt and IV are drawn on every call
 * (never reused across calls, even for the same password), which is what makes reusing GCM with a
 * derived key safe here. */
export async function encryptBackup(file: PepExportFile, password: string): Promise<EncryptedBackupEnvelope> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH_BYTES));
  const key = await deriveKey(password, salt, ['encrypt']);

  const plaintext = new TextEncoder().encode(JSON.stringify(file));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);

  return {
    encrypted: true,
    envelopeVersion: 1,
    kdf: {
      name: 'PBKDF2',
      hash: 'SHA-256',
      iterations: PBKDF2_ITERATIONS,
      salt: bufferToBase64(salt.buffer),
    },
    cipher: { name: 'AES-GCM', iv: bufferToBase64(iv.buffer) },
    ciphertext: bufferToBase64(ciphertext),
  };
}

/** Decrypts an `EncryptedBackupEnvelope` back to the raw (still unvalidated/unmigrated) data that
 * was originally produced by `services.dataExport.export()`. Returns `unknown` on purpose: the
 * result still has to go through `migrateToCurrentVersion` inside
 * `services.dataExport.importAndReplace`, exactly like a legacy plaintext import - this function's
 * job ends at "the bytes decrypted to valid JSON". */
export async function decryptBackup(envelope: EncryptedBackupEnvelope, password: string): Promise<unknown> {
  const salt = new Uint8Array(base64ToBuffer(envelope.kdf.salt));
  const iv = new Uint8Array(base64ToBuffer(envelope.cipher.iv));
  const key = await deriveKey(password, salt, ['decrypt']);
  const ciphertext = base64ToBuffer(envelope.ciphertext);

  let plaintext: ArrayBuffer;
  try {
    plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
  } catch {
    // GCM already authenticated the ciphertext - there is nothing more to verify, so this catch is
    // the only place the wrong-password case is detected. Do not add a second check here.
    throw new WrongPasswordError();
  }

  return JSON.parse(new TextDecoder().decode(plaintext));
}
