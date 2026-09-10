/**
 * File format for an optionally-password-encrypted backup. Wraps a `PepExportFile`
 * (`jsonExportFormat.ts`) without touching it: the whole `PepExportFile`, including its own
 * `formatVersion`/`exportedAt`, becomes the plaintext of `ciphertext`. `envelopeVersion` is a
 * separate, independent counter from `PepExportFile.formatVersion` - the envelope and the data it
 * carries can evolve on their own schedules.
 *
 * Pure DTO/type file, like `jsonExportFormat.ts` - no `crypto.subtle`, no browser APIs. The
 * `application/` layer's rule is that it never touches browser APIs directly; the actual
 * encryption/decryption lives in `infrastructure/export/backupEncryption.ts`.
 */
export interface EncryptedBackupEnvelope {
  encrypted: true;
  envelopeVersion: 1;
  kdf: {
    name: 'PBKDF2';
    hash: 'SHA-256';
    iterations: number;
    /** base64 */
    salt: string;
  };
  cipher: {
    name: 'AES-GCM';
    /** base64 */
    iv: string;
  };
  /** base64 of AES-GCM(JSON.stringify(PepExportFile)); includes the GCM authentication tag. */
  ciphertext: string;
}

/**
 * Shallow shape check, mirroring how `jsonMigrations.ts` only checks the top-level shape of a
 * `PepExportFile` rather than every field. `kdf`/`cipher`/`envelopeVersion`/`encrypted` all stay
 * cleartext by design (standard practice for an encrypted container - it does not weaken the
 * encryption), which is exactly what makes this check possible without ever touching
 * `crypto.subtle`: a legacy plaintext `PepExportFile` has none of these fields, so the two shapes
 * never get confused.
 */
export function isEncryptedBackupEnvelope(raw: unknown): raw is EncryptedBackupEnvelope {
  if (typeof raw !== 'object' || raw === null) {
    return false;
  }
  const envelope = raw as Record<string, unknown>;
  if (envelope.encrypted !== true || envelope.envelopeVersion !== 1) {
    return false;
  }
  if (typeof envelope.ciphertext !== 'string') {
    return false;
  }

  if (typeof envelope.kdf !== 'object' || envelope.kdf === null) {
    return false;
  }
  const kdf = envelope.kdf as Record<string, unknown>;
  if (
    kdf.name !== 'PBKDF2' ||
    kdf.hash !== 'SHA-256' ||
    typeof kdf.iterations !== 'number' ||
    typeof kdf.salt !== 'string'
  ) {
    return false;
  }

  if (typeof envelope.cipher !== 'object' || envelope.cipher === null) {
    return false;
  }
  const cipher = envelope.cipher as Record<string, unknown>;
  if (cipher.name !== 'AES-GCM' || typeof cipher.iv !== 'string') {
    return false;
  }

  return true;
}
