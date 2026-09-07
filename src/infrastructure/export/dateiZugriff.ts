/** Pure browser I/O helpers for JSON backup export/import (Blob/File API, no business logic). */

export function dateiHerunterladen(dateiname: string, inhalt: unknown): void {
  const blob = new Blob([JSON.stringify(inhalt, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = dateiname;
  link.click();
  URL.revokeObjectURL(url);
}

export function backupDateiname(): string {
  const jetzt = new Date().toISOString().slice(0, 10);
  return `pep-backup-${jetzt}.json`;
}

export function datenDateiEinlesen(datei: File): Promise<unknown> {
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
    reader.readAsText(datei);
  });
}
