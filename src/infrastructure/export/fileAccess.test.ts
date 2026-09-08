import { describe, it, expect } from 'vitest';
import { backupFilename } from './fileAccess';

describe('backupFilename', () => {
  it('names the file after the local date and time, down to the second', () => {
    expect(backupFilename(new Date(2026, 8, 8, 14, 32, 5))).toBe('pep-backup-2026-09-08_14-32-05.json');
  });

  it('zero-pads every part, so all names have the same length and sort chronologically', () => {
    expect(backupFilename(new Date(2026, 0, 3, 7, 4, 9))).toBe('pep-backup-2026-01-03_07-04-09.json');
  });

  it('tells two backups of the same day apart', () => {
    const morning = backupFilename(new Date(2026, 8, 8, 9, 15, 0));
    const evening = backupFilename(new Date(2026, 8, 8, 21, 15, 0));
    expect(morning).not.toBe(evening);
    // Plain string order has to match chronological order - that is the point of the ISO order.
    expect(morning < evening).toBe(true);
  });

  it('uses the local day, not UTC: a late evening backup keeps that evening in its name', () => {
    // 23:30 German summer time is already the next day in UTC. toISOString() would name it 09-09.
    expect(backupFilename(new Date(2026, 8, 8, 23, 30, 0))).toContain('2026-09-08');
  });

  it('avoids characters Windows refuses in a file name', () => {
    expect(backupFilename(new Date(2026, 8, 8, 14, 32, 5))).not.toMatch(/[:*?"<>|]/);
  });
});
