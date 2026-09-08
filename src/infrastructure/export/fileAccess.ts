import { toISODate } from '@domain/shared/DateFormat';

/** Pure browser I/O helpers for JSON backup export/import (Blob/File API, no business logic). */

export function downloadFile(filename: string, content: unknown): void {
  const blob = new Blob([JSON.stringify(content, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Local date AND time, so several backups on the same day stay apart and stay recognisable.
 * Example: pep-backup-2026-09-08_14-32-05.json
 *
 * Deliberately still the ISO order (year first) rather than the German one: that is what makes the
 * files sort chronologically in a file manager and in Google Drive. Deliberately hyphens instead of
 * colons in the time - Windows does not allow ":" in file names.
 *
 * toISODate, not toISOString(): the latter is UTC, so a backup taken at 23:00 German summer time
 * would be named after the following day.
 */
export function backupFilename(now: Date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  const time = `${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
  return `pep-backup-${toISODate(now)}_${time}.json`;
}

export function readDataFile(file: File): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        resolve(JSON.parse(String(reader.result)));
      } catch {
        reject(new Error('Die Datei enthält kein gültiges JSON.'));
      }
    };
    reader.onerror = () => reject(new Error('Die Datei konnte nicht gelesen werden.'));
    reader.readAsText(file);
  });
}
