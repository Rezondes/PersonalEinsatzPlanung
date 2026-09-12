import { describe, it, expect, vi } from 'vitest';
import type { EmployeeId, AbsenceId } from '@domain/shared/ids';
import type { Absence } from '@domain/absence/Absence';
import type { AbsenceRepository } from '@application/ports/AbsenceRepository';
import { createAbsenceService } from './absenceService';

const m1 = 'm1' as EmployeeId;

function fakeRepo(): AbsenceRepository {
  return {
    findAll: vi.fn(),
    findByEmployee: vi.fn(async () => []),
    findByEmployeeIds: vi.fn(async () => []),
    save: vi.fn(async () => {}),
    delete: vi.fn(async () => {}),
    deleteAll: vi.fn(),
  };
}

describe('absenceService', () => {
  it('forEmployee delegates to the repository', async () => {
    const repo = fakeRepo();
    await createAbsenceService(repo).forEmployee(m1);
    expect(repo.findByEmployee).toHaveBeenCalledWith(m1);
  });

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
