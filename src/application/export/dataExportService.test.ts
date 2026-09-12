import { describe, it, expect, vi } from 'vitest';
import type { BranchId } from '@domain/shared/ids';
import type { Branch } from '@domain/branch/Branch';
import type { WeeklyScheduleRepository } from '@application/ports/WeeklyScheduleRepository';
import { CURRENT_FORMAT_VERSION } from './jsonExportFormat';
import type { PepExportFile } from './jsonExportFormat';
import { createDataExportService } from './dataExportService';
import type { DataRepositories } from './dataExportService';

function branch(overrides: Partial<Branch> = {}): Branch {
  return {
    id: 'b1' as BranchId,
    name: 'Filiale Velpke',
    branchNumber: '2504',
    address: { street: '', houseNumber: '', postalCode: '', city: '' },
    logoBase64: null,
    federalState: 'Niedersachsen',
    allowedOpenSundays: [],
    active: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function fakeRepos(overrides: Partial<DataRepositories> = {}): DataRepositories {
  return {
    branch: {
      findAll: vi.fn(async () => []),
      findById: vi.fn(),
      save: vi.fn(async () => {}),
      delete: vi.fn(),
      deleteAll: vi.fn(async () => {}),
    },
    employee: {
      findAll: vi.fn(async () => []),
      findByBranch: vi.fn(),
      findById: vi.fn(),
      save: vi.fn(async () => {}),
      delete: vi.fn(),
      deleteAll: vi.fn(async () => {}),
    },
    weeklySchedule: {
      findAll: vi.fn(async () => []),
      findByBranchAndWeek: vi.fn(),
      findByBranch: vi.fn(),
      findById: vi.fn(),
      save: vi.fn(async () => {}),
      delete: vi.fn(),
      deleteAll: vi.fn(async () => {}),
      transaction: vi.fn((fn: () => Promise<unknown>) => fn()) as WeeklyScheduleRepository['transaction'],
    },
    absence: {
      findAll: vi.fn(async () => []),
      findByEmployee: vi.fn(),
      findByEmployeeIds: vi.fn(),
      save: vi.fn(async () => {}),
      delete: vi.fn(),
      deleteAll: vi.fn(async () => {}),
    },
    shiftTemplate: {
      findAll: vi.fn(async () => []),
      findByBranch: vi.fn(),
      save: vi.fn(async () => {}),
      delete: vi.fn(),
      deleteAll: vi.fn(async () => {}),
    },
    transaction: vi.fn((fn: () => Promise<unknown>) => fn()) as DataRepositories['transaction'],
    ...overrides,
  };
}

describe('dataExportService.export', () => {
  it('collects every store into one PepExportFile at the current format version', async () => {
    const repos = fakeRepos({
      branch: {
        findAll: vi.fn(async () => [branch()]),
        findById: vi.fn(),
        save: vi.fn(),
        delete: vi.fn(),
        deleteAll: vi.fn(),
      },
    });

    const file = await createDataExportService(repos).export();

    expect(file.formatVersion).toBe(CURRENT_FORMAT_VERSION);
    expect(file.data.branches).toEqual([branch()]);
    expect(file.data.employees).toEqual([]);
    expect(file.exportedAt).toBeTruthy();
  });
});

describe('dataExportService.importAndReplace', () => {
  it('deletes every store and re-saves the imported data inside one transaction', async () => {
    const repos = fakeRepos();
    const importFile: PepExportFile = {
      formatVersion: CURRENT_FORMAT_VERSION,
      exportedAt: '2026-01-01T00:00:00.000Z',
      data: {
        branches: [branch()],
        employees: [],
        weeklySchedules: [],
        absences: [],
        shiftTemplates: [],
      },
    };

    await createDataExportService(repos).importAndReplace(importFile);

    expect(repos.transaction).toHaveBeenCalled();
    expect(repos.branch.deleteAll).toHaveBeenCalled();
    expect(repos.employee.deleteAll).toHaveBeenCalled();
    expect(repos.weeklySchedule.deleteAll).toHaveBeenCalled();
    expect(repos.absence.deleteAll).toHaveBeenCalled();
    expect(repos.shiftTemplate.deleteAll).toHaveBeenCalled();
    expect(repos.branch.save).toHaveBeenCalledWith(branch());
  });

  it('rejects a malformed import file without touching any store', async () => {
    const repos = fakeRepos();

    await expect(createDataExportService(repos).importAndReplace({ not: 'a valid export file' })).rejects.toThrow();

    expect(repos.branch.deleteAll).not.toHaveBeenCalled();
    expect(repos.transaction).not.toHaveBeenCalled();
  });
});

describe('dataExportService.deleteAllData', () => {
  it('clears every store atomically, inside the same transaction wrapper importAndReplace uses', async () => {
    const repos = fakeRepos();

    await createDataExportService(repos).deleteAllData();

    expect(repos.transaction).toHaveBeenCalled();
    expect(repos.branch.deleteAll).toHaveBeenCalled();
    expect(repos.employee.deleteAll).toHaveBeenCalled();
    expect(repos.weeklySchedule.deleteAll).toHaveBeenCalled();
    expect(repos.absence.deleteAll).toHaveBeenCalled();
    expect(repos.shiftTemplate.deleteAll).toHaveBeenCalled();
  });
});
