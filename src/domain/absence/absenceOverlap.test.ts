import { describe, it, expect } from 'vitest';
import type { AbsenceId, EmployeeId } from '@domain/shared/ids';
import type { Absence } from './Absence';
import { findOverlappingAbsences, findConflictingAbsences } from './absenceOverlap';

const e1 = 'e1' as EmployeeId;
const e2 = 'e2' as EmployeeId;

function absence(overrides: Partial<Absence> & Pick<Absence, 'type'>): Absence {
  return {
    id: 'a1' as AbsenceId,
    employeeId: e1,
    from: '2026-03-01',
    to: '2026-03-01',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  } as Absence;
}

describe('findOverlappingAbsences', () => {
  it('finds a single-day range inside a longer existing absence', () => {
    const vacation = absence({ type: 'Vacation', from: '2026-03-01', to: '2026-03-15' });

    const result = findOverlappingAbsences({ employeeId: e1, from: '2026-03-10', to: '2026-03-10' }, [vacation]);

    expect(result).toEqual([vacation]);
  });

  it('finds nothing when there is a gap between the ranges', () => {
    const vacation = absence({ type: 'Vacation', from: '2026-03-01', to: '2026-03-15' });

    const result = findOverlappingAbsences({ employeeId: e1, from: '2026-03-20', to: '2026-03-25' }, [vacation]);

    expect(result).toEqual([]);
  });

  it('excludes the absence itself via excludeId', () => {
    const vacation = absence({ type: 'Vacation', from: '2026-03-01', to: '2026-03-15' });

    const result = findOverlappingAbsences(
      { employeeId: e1, from: vacation.from, to: vacation.to },
      [vacation],
      vacation.id,
    );

    expect(result).toEqual([]);
  });

  it('ignores absences of a different employee', () => {
    const otherEmployeesVacation = absence({ type: 'Vacation', from: '2026-03-01', to: '2026-03-15', employeeId: e2 });

    const result = findOverlappingAbsences({ employeeId: e1, from: '2026-03-10', to: '2026-03-10' }, [otherEmployeesVacation]);

    expect(result).toEqual([]);
  });
});

describe('findConflictingAbsences', () => {
  it('ignores a single day fully inside a strictly longer existing Vacation (the documented public-holiday-in-vacation nesting)', () => {
    const vacation = absence({ type: 'Vacation', from: '2026-03-01', to: '2026-03-15' });

    const result = findConflictingAbsences({ employeeId: e1, from: '2026-03-10', to: '2026-03-10' }, [vacation]);

    expect(result).toEqual([]);
  });

  it('ignores the same nesting regardless of the existing absence type', () => {
    const illnessWeek = absence({ type: 'Illness', from: '2026-03-01', to: '2026-03-15' });

    const result = findConflictingAbsences({ employeeId: e1, from: '2026-03-10', to: '2026-03-10' }, [illnessWeek]);

    expect(result).toEqual([]);
  });

  it('flags an overlap when the new range is itself multi-day, so neither side is a nested single day', () => {
    const vacation = absence({ type: 'Vacation', from: '2026-03-01', to: '2026-03-15' });

    const result = findConflictingAbsences({ employeeId: e1, from: '2026-03-05', to: '2026-03-20' }, [vacation]);

    expect(result).toEqual([vacation]);
  });

  it('flags two single-day entries on the same date as a conflict (neither is "longer")', () => {
    const existingHoliday = absence({ type: 'Other', label: 'Feiertag', from: '2026-03-10', to: '2026-03-10' });

    const result = findConflictingAbsences({ employeeId: e1, from: '2026-03-10', to: '2026-03-10' }, [existingHoliday]);

    expect(result).toEqual([existingHoliday]);
  });

  it('is symmetric: also ignores nesting when the EXISTING absence is the single day and the new range is the longer one', () => {
    const existingHoliday = absence({ type: 'PublicHoliday', from: '2026-03-10', to: '2026-03-10' });

    const result = findConflictingAbsences({ employeeId: e1, from: '2026-03-01', to: '2026-03-15' }, [existingHoliday]);

    expect(result).toEqual([]);
  });

  it('respects excludeId, so re-saving an absence unchanged never conflicts with itself', () => {
    const vacation = absence({ type: 'Vacation', from: '2026-03-01', to: '2026-03-15' });

    const result = findConflictingAbsences(
      { employeeId: e1, from: vacation.from, to: vacation.to },
      [vacation],
      vacation.id,
    );

    expect(result).toEqual([]);
  });
});
