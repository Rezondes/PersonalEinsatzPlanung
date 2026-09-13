import { describe, it, expect, vi, afterEach } from 'vitest';
import { backupFilename, downloadFile, downloadTextFile } from './fileAccess';

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

describe('downloadTextFile', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('wraps the given text in a Blob of the given mime type and triggers a download via an anchor click, revoking the object URL afterwards', () => {
    const createObjectURL = vi.fn<(blob: Blob) => string>(() => 'blob:mock-url');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL });
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    downloadTextFile('export.csv', 'a;b', 'text/csv');

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    const blob = createObjectURL.mock.calls[0][0];
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe('text/csv');
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
  });

  it('sets the anchor\'s download attribute to the given filename', () => {
    vi.stubGlobal('URL', { ...URL, createObjectURL: vi.fn(() => 'blob:mock-url'), revokeObjectURL: vi.fn() });
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(function (this: HTMLAnchorElement) {
        expect(this.download).toBe('export.csv');
      });

    downloadTextFile('export.csv', 'a;b', 'text/csv');

    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it('attaches the anchor to the document before clicking it and detaches it afterwards - some browsers silently ignore click() on a never-attached element', () => {
    vi.stubGlobal('URL', { ...URL, createObjectURL: vi.fn(() => 'blob:mock-url'), revokeObjectURL: vi.fn() });
    const appendSpy = vi.spyOn(document.body, 'appendChild');
    const removeSpy = vi.spyOn(document.body, 'removeChild');
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(function (this: HTMLAnchorElement) {
        // A click() mocked as a pure no-op (as the two tests above do) can never catch a missing
        // appendChild - only checking attachment status AT THE MOMENT OF THE CLICK does.
        expect(document.body.contains(this)).toBe(true);
      });

    downloadTextFile('export.csv', 'a;b', 'text/csv');

    expect(appendSpy).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(removeSpy).toHaveBeenCalledTimes(1);
  });
});

describe('downloadFile', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('wraps the given value as pretty-printed JSON and triggers a download via an anchor click, revoking the object URL afterwards', () => {
    const createObjectURL = vi.fn<(blob: Blob) => string>(() => 'blob:mock-url');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    downloadFile('backup.json', { formatVersion: 5 });

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    const blob = createObjectURL.mock.calls[0][0];
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe('application/json');
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
  });

  it('attaches the anchor to the document before clicking it and detaches it afterwards', () => {
    vi.stubGlobal('URL', { ...URL, createObjectURL: vi.fn(() => 'blob:mock-url'), revokeObjectURL: vi.fn() });
    const appendSpy = vi.spyOn(document.body, 'appendChild');
    const removeSpy = vi.spyOn(document.body, 'removeChild');
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      expect(document.body.contains(this)).toBe(true);
    });

    downloadFile('backup.json', { formatVersion: 5 });

    expect(appendSpy).toHaveBeenCalledTimes(1);
    expect(removeSpy).toHaveBeenCalledTimes(1);
  });
});
