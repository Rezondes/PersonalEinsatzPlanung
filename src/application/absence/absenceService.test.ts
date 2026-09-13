import { describe, it, expect, vi } from 'vitest';
import type { EmployeeId, AbsenceId } from '@domain/shared/ids';
import type { Absence } from '@domain/absence/Absence';
import type { AbsenceRepository } from '@application/ports/AbsenceRepository';
import { createAbsenceService } from './absenceService';

const m1 = 'm1' as EmployeeId;

function fakeRepo(): AbsenceRepository {
  return {
    findAll: vi.fn(),
    findById: vi.fn(async () => null),
    findByEmployee: vi.fn(async () => []),
    findByEmployeeIds: vi.fn(async () => []),
    save: vi.fn(async () => {}),
    delete: vi.fn(async () => {}),
    deleteAll: vi.fn(),
  };
}

describe('absenceService', () => {
  it('forEmployees delegates to the repository', async () => {
    const repo = fakeRepo();
    await createAbsenceService(repo).forEmployees([m1]);
    expect(repo.findByEmployeeIds).toHaveBeenCalledWith([m1]);
  });

  it('create builds a new Absence and saves it', async () => {
    const repo = fakeRepo();
    const absence = await createAbsenceService(repo).create({
      employeeId: m1,
      type: 'Vacation',
      from: '2026-09-07',
      to: '2026-09-11',
    });

    expect(absence.id).toBeTruthy();
    expect(absence.employeeId).toBe(m1);
    expect(repo.save).toHaveBeenCalledWith(absence);
  });

  it('update saves the absence with a refreshed updatedAt, keeping its id and createdAt', async () => {
    const repo = fakeRepo();
    const existing: Absence = {
      id: 'a1' as AbsenceId,
      employeeId: m1,
      type: 'Vacation',
      from: '2026-01-05',
      to: '2026-01-06',
      createdAt: '2026-01-01T00:00:00.000Z',
    };

    const updated = await createAbsenceService(repo).update({ ...existing, to: '2026-01-07' });

    expect(updated.to).toBe('2026-01-07');
    expect(updated.id).toBe(existing.id);
    expect(updated.createdAt).toBe(existing.createdAt);
    expect(updated.updatedAt).toBeTruthy();
    expect(repo.save).toHaveBeenCalledWith(updated);
  });

  it('restore saves the absence verbatim, keeping its id and createdAt', async () => {
    const repo = fakeRepo();
    const existing: Absence = {
      id: 'a1' as AbsenceId,
      employeeId: m1,
      type: 'Illness',
      from: '2026-01-05',
      to: '2026-01-06',
      createdAt: '2026-01-01T00:00:00.000Z',
    };

    await createAbsenceService(repo).restore(existing);

    expect(repo.save).toHaveBeenCalledWith(existing);
  });

  it('delete calls the repository with the given id', async () => {
    const repo = fakeRepo();
    await createAbsenceService(repo).delete('a1' as AbsenceId);
    expect(repo.delete).toHaveBeenCalledWith('a1');
  });
});
