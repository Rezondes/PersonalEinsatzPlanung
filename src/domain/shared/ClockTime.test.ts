import { describe, it, expect } from 'vitest';
import { DomainError } from './DomainError';
import { parseClockTime, clockTime, clockTimeToMinutes, minutesToClockTime } from './ClockTime';

describe('parseClockTime', () => {
  it('accepts valid HH:mm times across the full day, including both boundaries', () => {
    expect(parseClockTime('00:00')).toBe('00:00');
    expect(parseClockTime('23:59')).toBe('23:59');
    expect(parseClockTime('06:00')).toBe('06:00');
    expect(parseClockTime('12:34')).toBe('12:34');
  });

  it('rejects an hour of 24 or more', () => {
    expect(parseClockTime('24:00')).toBeNull();
    expect(parseClockTime('25:30')).toBeNull();
  });

  it('rejects a minute of 60 or more', () => {
    expect(parseClockTime('06:60')).toBeNull();
    expect(parseClockTime('06:99')).toBeNull();
  });

  it('rejects an hour without a leading zero', () => {
    expect(parseClockTime('7:00')).toBeNull();
  });

  it('rejects a minute without a leading zero', () => {
    expect(parseClockTime('07:0')).toBeNull();
  });

  it('rejects garbage input, including empty and non-time strings', () => {
    expect(parseClockTime('')).toBeNull();
    expect(parseClockTime('abc')).toBeNull();
    expect(parseClockTime('12:34:56')).toBeNull();
    expect(parseClockTime('12-34')).toBeNull();
  });
});

describe('clockTime', () => {
  it('returns the parsed value for valid input', () => {
    expect(clockTime('14:15')).toBe('14:15');
  });

  it('throws a DomainError with a German message for invalid input', () => {
    expect(() => clockTime('24:00')).toThrow(DomainError);
    expect(() => clockTime('7:00')).toThrow('Ungültige Uhrzeit: "7:00". Erwartet wird das Format HH:mm.');
  });
});

describe('clockTimeToMinutes', () => {
  it('converts midnight to 0', () => {
    expect(clockTimeToMinutes(clockTime('00:00'))).toBe(0);
  });

  it('converts a normal daytime value', () => {
    expect(clockTimeToMinutes(clockTime('06:00'))).toBe(360);
  });

  it('converts the last minute of the day', () => {
    expect(clockTimeToMinutes(clockTime('23:59'))).toBe(1439);
  });
});

describe('minutesToClockTime', () => {
  it('formats a normal in-range value with zero-padding', () => {
    expect(minutesToClockTime(0)).toBe('00:00');
    expect(minutesToClockTime(90)).toBe('01:30');
    expect(minutesToClockTime(1439)).toBe('23:59');
  });

  it('wraps a value at or past 24h (1440 min) back into the same day', () => {
    expect(minutesToClockTime(1440)).toBe('00:00');
    expect(minutesToClockTime(1500)).toBe('01:00');
  });

  it('wraps a negative value backward into the previous day\'s time, not producing a negative result', () => {
    expect(minutesToClockTime(-30)).toBe('23:30');
    expect(minutesToClockTime(-1440)).toBe('00:00');
  });
});
