import type { Shift } from './Shift';
import type { Break } from './Break';
import { parseClockTime } from '@domain/shared/ClockTime';
import { assertNoFieldErrors } from '@domain/shared/DomainError';
import type { FieldError } from '@domain/validation/FieldError';
import { MUST_BE_POSITIVE_MESSAGE, validateHourRange } from '@domain/validation/FieldError';

/** What the Tageseditor holds while the user types: times as the raw input strings (a native time
 * input yields '' or 'HH:mm') and the break duration as entered, possibly still empty. Keeping the
 * raw values means a cleared field stays visibly empty and can be marked, instead of being
 * silently discarded the way parsing on every keystroke used to do. */
export interface BreakDraft {
  id: string;
  start: string;
  durationMinutes: number | undefined;
}

export interface ShiftDraft {
  id: string;
  start: string;
  end: string;
  endsNextDay: boolean;
  breaks: BreakDraft[];
}

export function shiftToDraft(shift: Shift): ShiftDraft {
  return {
    id: shift.id,
    start: shift.start,
    end: shift.end,
    endsNextDay: shift.endsNextDay,
    breaks: shift.breaks.map((b) => ({ id: b.id, start: b.start ?? '', durationMinutes: b.durationMinutes })),
  };
}

export function newShiftDraft(start = '06:00', end = '14:00'): ShiftDraft {
  return { id: crypto.randomUUID(), start, end, endsNextDay: false, breaks: [] };
}

export function newBreakDraft(durationMinutes = 30): BreakDraft {
  return { id: crypto.randomUUID(), start: '', durationMinutes };
}

/** Field key for the shift list as a whole (used when there is no shift at all). */
export const SHIFT_LIST_FIELD = 'shifts';

export function shiftFieldKey(shiftId: string, field: 'start' | 'end'): string {
  return `shift:${shiftId}:${field}`;
}

export function breakFieldKey(breakId: string, field: 'start' | 'durationMinutes'): string {
  return `break:${breakId}:${field}`;
}

export function validateShiftDrafts(drafts: ShiftDraft[]): FieldError[] {
  if (drafts.length === 0) {
    return [{ field: SHIFT_LIST_FIELD, message: 'Bitte mindestens eine Schicht anlegen.' }];
  }

  const errors: FieldError[] = [];
  for (const shift of drafts) {
    if (!parseClockTime(shift.start)) {
      errors.push({ field: shiftFieldKey(shift.id, 'start'), message: 'Bitte Beginn eingeben.' });
    }
    if (!parseClockTime(shift.end)) {
      errors.push({ field: shiftFieldKey(shift.id, 'end'), message: 'Bitte Ende eingeben.' });
    }
    for (const brk of shift.breaks) {
      if (brk.start !== '' && !parseClockTime(brk.start)) {
        errors.push({ field: breakFieldKey(brk.id, 'start'), message: 'Bitte gültige Uhrzeit eingeben.' });
      }
      if (brk.durationMinutes === undefined || !Number.isFinite(brk.durationMinutes)) {
        errors.push({ field: breakFieldKey(brk.id, 'durationMinutes'), message: 'Bitte Dauer eingeben.' });
      } else if (brk.durationMinutes <= 0) {
        errors.push({ field: breakFieldKey(brk.id, 'durationMinutes'), message: MUST_BE_POSITIVE_MESSAGE });
      }
    }
  }
  return errors;
}

/** Converts validated drafts back into Shift aggregates. Throws DomainValidationError when the
 * drafts are invalid, so callers must run validateShiftDrafts first. */
export function shiftDraftsToShifts(drafts: ShiftDraft[]): Shift[] {
  assertNoFieldErrors(validateShiftDrafts(drafts));
  return drafts.map((shift) => ({
    id: shift.id,
    start: parseClockTime(shift.start)!,
    end: parseClockTime(shift.end)!,
    endsNextDay: shift.endsNextDay,
    breaks: shift.breaks.map(
      (b): Break => ({
        id: b.id,
        start: b.start ? parseClockTime(b.start)! : undefined,
        durationMinutes: b.durationMinutes!,
      }),
    ),
  }));
}

/** Field key for the manual net-hours override of the whole day (DayEntry.netMinutesOverride). */
export const NET_OVERRIDE_FIELD = 'netMinutesOverride';

/** The override is optional: an empty field simply means "use the calculated hours". Only a value
 * that is actually entered has to be plausible. */
export function validateNetMinutesOverride(hours: number | undefined): FieldError[] {
  if (hours === undefined) {
    return [];
  }
  return validateHourRange(hours, NET_OVERRIDE_FIELD);
}
