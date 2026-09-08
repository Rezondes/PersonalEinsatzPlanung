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

export function backupFilename(): string {
  const now = new Date().toISOString().slice(0, 10);
  return `pep-backup-${now}.json`;
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
