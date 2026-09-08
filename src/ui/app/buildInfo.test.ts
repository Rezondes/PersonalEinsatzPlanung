import { describe, it, expect } from 'vitest';
import { formatBuildVersion } from './buildInfo';

describe('formatBuildVersion', () => {
  it('uses the UTC date plus a four-character stamp for a real build', () => {
    expect(formatBuildVersion('2026-09-08T17:34:15.000Z', true)).toBe('080926.1ct3');
  });

  it('pads day and month, and takes the last two digits of the year', () => {
    expect(formatBuildVersion('2026-01-05T00:00:00.000Z', true)).toBe('050126.0000');
  });

  it('covers both ends of the day without changing length', () => {
    expect(formatBuildVersion('2026-09-08T00:00:00.000Z', true)).toBe('080926.0000');
    expect(formatBuildVersion('2026-09-08T23:59:59.000Z', true)).toBe('080926.1unz');
  });

  it('marks a local build as dev, keeping the stamp so two of them differ', () => {
    expect(formatBuildVersion('2026-09-08T17:34:15.000Z', false)).toBe('dev.1ct3');
    expect(formatBuildVersion('2026-09-08T17:34:16.000Z', false)).toBe('dev.1ct4');
  });

  it('reads the timestamp as UTC, not in the local time zone', () => {
    // Same instant, written with an offset: the version must not move with the machine.
    expect(formatBuildVersion('2026-09-08T19:34:15.000+02:00', true)).toBe('080926.1ct3');
  });

  it('is stable for the same instant and different for the next second', () => {
    const at = (iso: string) => formatBuildVersion(iso, true);
    expect(at('2026-09-08T12:00:00.000Z')).toBe(at('2026-09-08T12:00:00.999Z'));
    expect(at('2026-09-08T12:00:00.000Z')).not.toBe(at('2026-09-08T12:00:01.000Z'));
  });
});
