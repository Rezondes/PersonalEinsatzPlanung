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
