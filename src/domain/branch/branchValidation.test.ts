import { describe, it, expect } from 'vitest';
import { isSunday, validateBranch, validateOpenSundayDate } from './branchValidation';

describe('validateBranch', () => {
  it('accepts a name and a branch number', () => {
    expect(validateBranch({ name: 'Velpke', branchNumber: '2504' })).toEqual([]);
  });

  it('reports both empty fields at once, ignoring whitespace', () => {
    expect(validateBranch({ name: ' ', branchNumber: '' })).toEqual([
      { field: 'name', message: 'Bitte Namen der Filiale eingeben.' },
      { field: 'branchNumber', message: 'Bitte Filialnummer eingeben.' },
    ]);
  });
});

describe('isSunday', () => {
  it('recognises a Sunday and rejects the Monday after it', () => {
    expect(isSunday('2026-09-13')).toBe(true);
    expect(isSunday('2026-09-14')).toBe(false);
  });

  it('is not fooled by the DST switch weekends', () => {
    expect(isSunday('2026-03-29')).toBe(true);
    expect(isSunday('2026-10-25')).toBe(true);
    expect(isSunday('2026-03-28')).toBe(false);
  });

  it('returns false for garbage', () => {
    expect(isSunday('')).toBe(false);
    expect(isSunday('nicht-ein-datum')).toBe(false);
  });
});

describe('validateOpenSundayDate', () => {
  it('requires a date', () => {
    expect(validateOpenSundayDate('', [])).toEqual([{ field: 'newSunday', message: 'Bitte ein Datum wählen.' }]);
  });

  it('rejects a weekday', () => {
    expect(validateOpenSundayDate('2026-09-14', [])).toEqual([{ field: 'newSunday', message: 'Das Datum ist kein Sonntag.' }]);
  });

  it('rejects a date that is already in the list', () => {
    expect(validateOpenSundayDate('2026-09-13', ['2026-09-13'])).toEqual([
      { field: 'newSunday', message: 'Dieses Datum ist bereits eingetragen.' },
    ]);
  });

  it('accepts a new Sunday', () => {
    expect(validateOpenSundayDate('2026-09-13', ['2026-09-06'])).toEqual([]);
  });
});
