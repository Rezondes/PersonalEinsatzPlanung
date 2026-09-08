import { describe, it, expect } from 'vitest';
import { clockTime } from '@domain/shared/ClockTime';
import { DomainValidationError } from '@domain/shared/DomainError';
import { createShift } from './Shift';
import { createBreak } from './Break';
import {
  SHIFT_LIST_FIELD,
  breakFieldKey,
  newBreakDraft,
  newShiftDraft,
  shiftDraftsToShifts,
  shiftFieldKey,
  shiftToDraft,
  validateShiftDrafts,
} from './shiftDraft';

const EMPTY = '';

describe('shiftToDraft / shiftDraftsToShifts', () => {
  it('round-trips a shift with a break that has no start time', () => {
    const shift = createShift(clockTime('06:00'), clockTime('14:00'));
    shift.breaks.push(createBreak(30), createBreak(15, clockTime('10:00')));

    const draft = shiftToDraft(shift);
    expect(draft.breaks[0].start).toBe(EMPTY);

    expect(shiftDraftsToShifts([draft])).toEqual([shift]);
  });

  it('round-trips a night shift', () => {
    const shift = createShift(clockTime('22:00'), clockTime('02:00'), true);
    expect(shiftDraftsToShifts([shiftToDraft(shift)])).toEqual([shift]);
  });

  it('refuses to convert invalid drafts', () => {
    const draft = { ...newShiftDraft(), start: EMPTY };
    expect(() => shiftDraftsToShifts([draft])).toThrow(DomainValidationError);
  });
});

describe('validateShiftDrafts', () => {
  it('accepts the default new shift', () => {
    expect(validateShiftDrafts([newShiftDraft()])).toEqual([]);
  });

  it('requires at least one shift', () => {
    expect(validateShiftDrafts([])).toEqual([{ field: SHIFT_LIST_FIELD, message: 'Bitte mindestens eine Schicht anlegen.' }]);
  });

  it('reports a cleared start or end on the right shift', () => {
    const first = { ...newShiftDraft(), start: EMPTY };
    const second = { ...newShiftDraft(), end: EMPTY };

    expect(validateShiftDrafts([first, second])).toEqual([
      { field: shiftFieldKey(first.id, 'start'), message: 'Bitte Beginn eingeben.' },
      { field: shiftFieldKey(second.id, 'end'), message: 'Bitte Ende eingeben.' },
    ]);
  });

  it('requires a positive break duration and allows an empty break start', () => {
    const missing = { ...newBreakDraft(), durationMinutes: undefined };
    const zero = { ...newBreakDraft(), durationMinutes: 0 };
    const shift = { ...newShiftDraft(), breaks: [missing, zero, newBreakDraft(45)] };

    expect(validateShiftDrafts([shift])).toEqual([
      { field: breakFieldKey(missing.id, 'durationMinutes'), message: 'Bitte Dauer eingeben.' },
      { field: breakFieldKey(zero.id, 'durationMinutes'), message: 'Muss größer als 0 sein.' },
    ]);
  });

  it('rejects a break start that is not a clock time', () => {
    const brk = { ...newBreakDraft(), start: '25:99' };
    const shift = { ...newShiftDraft(), breaks: [brk] };
    expect(validateShiftDrafts([shift])).toEqual([{ field: breakFieldKey(brk.id, 'start'), message: 'Bitte gültige Uhrzeit eingeben.' }]);
  });
});
