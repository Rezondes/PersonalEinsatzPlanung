import { describe, it, expect } from 'vitest';
import { TO_BEFORE_FROM_MESSAGE, validateAbsence } from './absenceValidation';
import type { AbsenceDraft } from './absenceValidation';

function draft(overrides: Partial<AbsenceDraft> = {}): AbsenceDraft {
  return { employeeId: 'm1', type: 'Vacation', from: '2026-09-07', to: '2026-09-11', ...overrides };
}

const EMPTY = '';

describe('validateAbsence', () => {
  it('accepts a complete vacation without a label', () => {
    expect(validateAbsence(draft())).toEqual([]);
  });

  it('requires an employee', () => {
    expect(validateAbsence(draft({ employeeId: EMPTY }))).toEqual([{ field: 'employeeId', message: 'Bitte Mitarbeiter auswählen.' }]);
  });

  it('requires a label only for type Other', () => {
    expect(validateAbsence(draft({ type: 'Other' }))).toEqual([{ field: 'label', message: 'Bitte Bezeichnung eingeben.' }]);
    expect(validateAbsence(draft({ type: 'Other', label: '  ' }))).toEqual([{ field: 'label', message: 'Bitte Bezeichnung eingeben.' }]);
    expect(validateAbsence(draft({ type: 'Other', label: 'Fortbildung' }))).toEqual([]);
    expect(validateAbsence(draft({ type: 'Illness' }))).toEqual([]);
  });

  it('requires both dates', () => {
    expect(validateAbsence(draft({ from: EMPTY, to: EMPTY }))).toEqual([
      { field: 'from', message: 'Bitte Startdatum wählen.' },
      { field: 'to', message: 'Bitte Enddatum wählen.' },
    ]);
  });

  it('reports an end before the start on the end field', () => {
    expect(validateAbsence(draft({ from: '2026-09-11', to: '2026-09-07' }))).toEqual([{ field: 'to', message: TO_BEFORE_FROM_MESSAGE }]);
  });

  it('allows a single day', () => {
    expect(validateAbsence(draft({ from: '2026-09-07', to: '2026-09-07' }))).toEqual([]);
  });
});

describe('validateAbsence - Stunden und Beschäftigungszeitraum', () => {
  const other = { employeeId: 'm1', type: 'Other' as const, from: '2026-03-04', to: '2026-03-04', label: 'Feiertag' };

  it('accepts an absent or valid hours value', () => {
    expect(validateAbsence(other)).toEqual([]);
    expect(validateAbsence({ ...other, hoursPerDay: 0 })).toEqual([]);
    expect(validateAbsence({ ...other, hoursPerDay: 7.5 })).toEqual([]);
  });

  it('rejects negative hours and more than a full day', () => {
    expect(validateAbsence({ ...other, hoursPerDay: -1 })).toEqual([
      { field: 'hoursPerDay', message: 'Darf nicht negativ sein.' },
    ]);
    expect(validateAbsence({ ...other, hoursPerDay: 25 })).toEqual([
      { field: 'hoursPerDay', message: 'Höchstens 24 Stunden.' },
    ]);
  });

  it('accepts an absent or valid creditedMinutesOverride for a non-Other type', () => {
    expect(validateAbsence(draft())).toEqual([]);
    expect(validateAbsence(draft({ creditedMinutesOverride: 0 }))).toEqual([]);
    expect(validateAbsence(draft({ creditedMinutesOverride: 480 }))).toEqual([]);
  });

  it('rejects a negative creditedMinutesOverride or more than 24 hours worth of minutes', () => {
    expect(validateAbsence(draft({ creditedMinutesOverride: -1 }))).toEqual([
      { field: 'creditedMinutesOverride', message: 'Darf nicht negativ sein.' },
    ]);
    // 1441 minutes = 24h01m - the field is minutes (not hours, unlike hoursPerDay above), so the
    // boundary is 24 * 60, not 24 - this is the one call site validateHourRange takes a non-default
    // max for.
    expect(validateAbsence(draft({ creditedMinutesOverride: 1441 }))).toEqual([
      { field: 'creditedMinutesOverride', message: 'Höchstens 24 Stunden.' },
    ]);
  });

  it('ignores creditedMinutesOverride for type Other, where hoursPerDay is the manual field instead', () => {
    expect(validateAbsence({ ...other, creditedMinutesOverride: 9999 })).toEqual([]);
  });

  it('rejects a range that starts before the entry date or ends after the exit date', () => {
    expect(validateAbsence({ ...other, employment: { entryDate: '2026-03-05' } })).toEqual([
      { field: 'from', message: 'Liegt vor dem Eintrittsdatum des Mitarbeiters.' },
    ]);
    expect(validateAbsence({ ...other, employment: { exitDate: '2026-03-03' } })).toEqual([
      { field: 'to', message: 'Liegt nach dem Austrittsdatum des Mitarbeiters.' },
    ]);
  });

  it('accepts a range inside the employment period, and any range without one', () => {
    expect(validateAbsence({ ...other, employment: { entryDate: '2026-03-01', exitDate: '2026-03-31' } })).toEqual([]);
    expect(validateAbsence({ ...other, employment: {} })).toEqual([]);
  });
});
