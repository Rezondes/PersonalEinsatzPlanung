// @vitest-environment node
//
// This file needs nothing from jsdom (no DOM, no browser chrome) and PBKDF2 at 600,000 iterations
// is real CPU work run several times over - the Node environment gives it Node's native WebCrypto
// implementation directly, rather than depending on jsdom's (partial, version-dependent) coverage
// of crypto.subtle.
import { describe, it, expect } from 'vitest';
import { DomainError } from '@domain/shared/DomainError';
import type { PepExportFile } from '@application/export/jsonExportFormat';
import { isEncryptedBackupEnvelope } from '@application/export/encryptedExportFormat';
import { encryptBackup, decryptBackup, WrongPasswordError, PBKDF2_ITERATIONS } from './backupEncryption';

const sampleFile: PepExportFile = {
  formatVersion: 4,
  exportedAt: '2026-09-07T00:00:00.000Z',
  data: {
    branches: [],
    employees: [],
    weeklySchedules: [],
    absences: [],
    shiftTemplates: [],
  },
};

describe('backupEncryption', () => {
  it('round-trips a PepExportFile through encryptBackup then decryptBackup with the correct password', async () => {
    const envelope = await encryptBackup(sampleFile, 'correct horse battery staple');
    const decrypted = await decryptBackup(envelope, 'correct horse battery staple');
    expect(decrypted).toEqual(sampleFile);
  });

  it('produces a cleartext envelope carrying the expected KDF/cipher parameters', async () => {
    const envelope = await encryptBackup(sampleFile, 'password');
    expect(envelope.encrypted).toBe(true);
    expect(envelope.envelopeVersion).toBe(1);
    expect(envelope.kdf).toMatchObject({ name: 'PBKDF2', hash: 'SHA-256', iterations: PBKDF2_ITERATIONS });
    expect(envelope.cipher.name).toBe('AES-GCM');
    expect(typeof envelope.kdf.salt).toBe('string');
    expect(typeof envelope.cipher.iv).toBe('string');
    expect(typeof envelope.ciphertext).toBe('string');
  });

  it('draws a fresh random salt and IV on every call, even for the same password', async () => {
    const a = await encryptBackup(sampleFile, 'password');
    const b = await encryptBackup(sampleFile, 'password');
    expect(a.kdf.salt).not.toBe(b.kdf.salt);
    expect(a.cipher.iv).not.toBe(b.cipher.iv);
    expect(a.ciphertext).not.toBe(b.ciphertext);
  });

  it('throws WrongPasswordError when decrypting with the wrong password', async () => {
    const envelope = await encryptBackup(sampleFile, 'correct horse battery staple');
    await expect(decryptBackup(envelope, 'not the right password')).rejects.toThrow(WrongPasswordError);
  });

  it('throws WrongPasswordError when the ciphertext was tampered with', async () => {
    const envelope = await encryptBackup(sampleFile, 'correct horse battery staple');
    const tampered = { ...envelope, ciphertext: envelope.ciphertext.slice(0, -4) + 'AAAA' };
    await expect(decryptBackup(tampered, 'correct horse battery staple')).rejects.toThrow(WrongPasswordError);
  });

  it('isEncryptedBackupEnvelope recognizes an envelope and rejects a legacy plaintext export file', async () => {
    const envelope = await encryptBackup(sampleFile, 'password');
    expect(isEncryptedBackupEnvelope(envelope)).toBe(true);
    expect(isEncryptedBackupEnvelope(sampleFile)).toBe(false);
  });

  it('isEncryptedBackupEnvelope rejects non-object and malformed values', () => {
    expect(isEncryptedBackupEnvelope(null)).toBe(false);
    expect(isEncryptedBackupEnvelope(undefined)).toBe(false);
    expect(isEncryptedBackupEnvelope('a string')).toBe(false);
    expect(isEncryptedBackupEnvelope({})).toBe(false);
    expect(isEncryptedBackupEnvelope({ encrypted: true, envelopeVersion: 1 })).toBe(false);
  });

  it('rejects a password below the minimum length instead of silently encrypting with it', async () => {
    await expect(encryptBackup(sampleFile, '1234567')).rejects.toThrow(DomainError);
  });

  it('accepts a password at exactly the minimum length', async () => {
    await expect(encryptBackup(sampleFile, '12345678')).resolves.toBeDefined();
  });

  it('throws WrongPasswordError, not a raw browser exception, when the envelope contains malformed base64', async () => {
    const envelope = await encryptBackup(sampleFile, 'correct horse battery staple');
    const corrupted = { ...envelope, kdf: { ...envelope.kdf, salt: 'not-valid-base64!!!' } };
    await expect(decryptBackup(corrupted, 'correct horse battery staple')).rejects.toThrow(WrongPasswordError);
  });
});
