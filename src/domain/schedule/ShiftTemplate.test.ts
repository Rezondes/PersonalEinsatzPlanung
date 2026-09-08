import { describe, it, expect } from 'vitest';
import type { BranchId } from '@domain/shared/ids';
import { clockTime } from '@domain/shared/ClockTime';
import { DomainValidationError } from '@domain/shared/DomainError';
import { createShift } from './Shift';
import { compareShiftTemplatesByName, createShiftTemplate } from './ShiftTemplate';
import { validateShiftTemplate } from './shiftTemplateValidation';

const branchId = 'b1' as BranchId;
const shifts = [createShift(clockTime('06:00'), clockTime('14:00'))];

describe('createShiftTemplate', () => {
  it('creates a template with an id and timestamps', () => {
    const template = createShiftTemplate({ branchId, name: 'Frühschicht', shifts });
    expect(template.id).toBeTruthy();
    expect(template.branchId).toBe(branchId);
    expect(template.createdAt).toBe(template.updatedAt);
    expect(template.shifts).toHaveLength(1);
  });

  it('rejects an empty or whitespace-only name', () => {
    expect(() => createShiftTemplate({ branchId, name: '', shifts })).toThrow(DomainValidationError);
    expect(() => createShiftTemplate({ branchId, name: '   ', shifts })).toThrow('Bitte Bezeichnung eingeben.');
  });

  it('rejects a template without any shift', () => {
    expect(() => createShiftTemplate({ branchId, name: 'Leer', shifts: [] })).toThrow(
      'Bitte mindestens eine Schicht anlegen.',
    );
  });
});

describe('validateShiftTemplate', () => {
  it('accepts a complete draft', () => {
    expect(validateShiftTemplate({ name: 'Spätschicht', shiftCount: 1 })).toEqual([]);
  });

  it('reports both problems at once', () => {
    expect(validateShiftTemplate({ name: ' ', shiftCount: 0 })).toHaveLength(2);
  });
});

describe('compareShiftTemplatesByName', () => {
  it('sorts with German collation', () => {
    const make = (name: string) => createShiftTemplate({ branchId, name, shifts });
    const sorted = [make('Zwischendienst'), make('Öffnung'), make('Abend')].sort(compareShiftTemplatesByName);
    expect(sorted.map((t) => t.name)).toEqual(['Abend', 'Öffnung', 'Zwischendienst']);
  });
});
