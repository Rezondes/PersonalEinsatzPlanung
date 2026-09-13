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
  it('creates a Shift-kind template with an id and timestamps', () => {
    const template = createShiftTemplate({ branchId, name: 'Frühschicht', kind: 'Shift', shifts });
    expect(template.id).toBeTruthy();
    expect(template.branchId).toBe(branchId);
    expect(template.createdAt).toBe(template.updatedAt);
    expect(template.kind).toBe('Shift');
    expect(template.kind === 'Shift' && template.shifts).toHaveLength(1);
  });

  it('rejects an empty or whitespace-only name', () => {
    expect(() => createShiftTemplate({ branchId, name: '', kind: 'Shift', shifts })).toThrow(DomainValidationError);
    expect(() => createShiftTemplate({ branchId, name: '   ', kind: 'Shift', shifts })).toThrow(
      'Bitte Bezeichnung eingeben.',
    );
  });

  it('rejects a Shift-kind template without any shift', () => {
    expect(() => createShiftTemplate({ branchId, name: 'Leer', kind: 'Shift', shifts: [] })).toThrow(
      'Bitte mindestens eine Schicht anlegen.',
    );
  });

  it('creates an Other-kind template with a label and optional hours, no shifts field', () => {
    const template = createShiftTemplate({ branchId, name: 'Feiertag', kind: 'Other', label: 'Feiertag', hoursPerDay: 8 });
    expect(template.kind).toBe('Other');
    expect(template.kind === 'Other' && template.label).toBe('Feiertag');
    expect(template.kind === 'Other' && template.hoursPerDay).toBe(8);
    expect((template as { shifts?: unknown }).shifts).toBeUndefined();
  });

  it('rejects an Other-kind template with an empty label', () => {
    expect(() => createShiftTemplate({ branchId, name: 'X', kind: 'Other', label: '' })).toThrow(
      DomainValidationError,
    );
  });
});

describe('validateShiftTemplate', () => {
  it('accepts a complete Shift-kind draft', () => {
    expect(validateShiftTemplate({ kind: 'Shift', name: 'Spätschicht', shiftCount: 1 })).toEqual([]);
  });

  it('reports both Shift-kind problems at once', () => {
    expect(validateShiftTemplate({ kind: 'Shift', name: ' ', shiftCount: 0 })).toHaveLength(2);
  });

  it('accepts a complete Other-kind draft', () => {
    expect(validateShiftTemplate({ kind: 'Other', name: 'Feiertag', label: 'Feiertag', hoursPerDay: 8 })).toEqual([]);
  });

  it('reports a missing label on an Other-kind draft', () => {
    const errors = validateShiftTemplate({ kind: 'Other', name: 'X', label: '' });
    expect(errors).toEqual([{ field: 'label', message: 'Bitte Bezeichnung eingeben.' }]);
  });

  it('reports an out-of-range hoursPerDay on an Other-kind draft', () => {
    const errors = validateShiftTemplate({ kind: 'Other', name: 'X', label: 'Training', hoursPerDay: 30 });
    expect(errors).toHaveLength(1);
    expect(errors[0].field).toBe('hoursPerDay');
  });
});

describe('compareShiftTemplatesByName', () => {
  it('sorts with German collation', () => {
    const make = (name: string) => createShiftTemplate({ branchId, name, kind: 'Shift', shifts });
    const sorted = [make('Zwischendienst'), make('Öffnung'), make('Abend')].sort(compareShiftTemplatesByName);
    expect(sorted.map((t) => t.name)).toEqual(['Abend', 'Öffnung', 'Zwischendienst']);
  });
});
