import { describe, it, expect } from 'vitest';
import type { EmployeeId } from '@domain/shared/ids';
import { DomainError } from '@domain/shared/DomainError';
import { createAbsence } from './Absence';

const m1 = 'm1' as EmployeeId;

describe('createAbsence', () => {
  it('creates a valid absence with id and createdAt', () => {
    const absence = createAbsence({ employeeId: m1, type: 'Vacation', from: '2026-09-07', to: '2026-09-11' });
    expect(absence.id).toBeTruthy();
    expect(absence.createdAt).toBeTruthy();
    expect(absence.from).toBe('2026-09-07');
    expect(absence.to).toBe('2026-09-11');
  });

  it('allows a single day (from === to)', () => {
    expect(() => createAbsence({ employeeId: m1, type: 'Illness', from: '2026-09-07', to: '2026-09-07' })).not.toThrow();
  });

  it('rejects to before from', () => {
    expect(() =>
      createAbsence({ employeeId: m1, type: 'Vacation', from: '2026-09-11', to: '2026-09-07' }),
    ).toThrow(DomainError);
  });
});
