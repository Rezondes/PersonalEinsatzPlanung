import { describe, it, expect } from 'vitest';
import { DomainValidationError } from '@domain/shared/DomainError';
import { createBranch } from './Branch';

describe('createBranch', () => {
  it('creates an active branch with an empty address and no open Sundays by default', () => {
    const branch = createBranch({ name: 'Velpke', branchNumber: '2504', federalState: 'Niedersachsen' });
    expect(branch.id).toBeTruthy();
    expect(branch.active).toBe(true);
    expect(branch.address).toEqual({ street: '', houseNumber: '', postalCode: '', city: '' });
    expect(branch.allowedOpenSundays).toEqual([]);
    expect(branch.logoBase64).toBeNull();
  });

  it('rejects an empty name', () => {
    expect(() => createBranch({ name: '  ', branchNumber: '2504', federalState: 'Niedersachsen' })).toThrow(DomainValidationError);
  });

  it('rejects an empty branch number', () => {
    expect(() => createBranch({ name: 'Velpke', branchNumber: '', federalState: 'Niedersachsen' })).toThrow(
      'Bitte Filialnummer eingeben.',
    );
  });
});
