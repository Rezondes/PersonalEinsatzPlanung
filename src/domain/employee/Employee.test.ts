import { describe, it, expect } from 'vitest';
import type { BranchId } from '@domain/shared/ids';
import { DomainValidationError } from '@domain/shared/DomainError';
import { compareByLastName, createEmployee } from './Employee';

function m(lastName: string, firstName: string) {
  return { lastName, firstName };
}

describe('compareByLastName', () => {
  it('sorts by last name A-Z', () => {
    const list = [m('Zorn', 'Anna'), m('Adler', 'Ben'), m('Meyer', 'Chris')];
    list.sort(compareByLastName);
    expect(list.map((x) => x.lastName)).toEqual(['Adler', 'Meyer', 'Zorn']);
  });

  it('uses first name as a tiebreaker for equal last names', () => {
    const list = [m('Meyer', 'Zora'), m('Meyer', 'Anna')];
    list.sort(compareByLastName);
    expect(list.map((x) => x.firstName)).toEqual(['Anna', 'Zora']);
  });

  it('sorts umlauts correctly per German collation', () => {
    // German collation: 'Ö' sorts near 'O', not after 'Z' (as plain code-point comparison would).
    const list = [m('Zorn', 'A'), m('Özdemir', 'B'), m('Adler', 'C')];
    list.sort(compareByLastName);
    expect(list.map((x) => x.lastName)).toEqual(['Adler', 'Özdemir', 'Zorn']);
  });
});

describe('createEmployee', () => {
  const details = {
    branchId: 'b1' as BranchId,
    lastName: 'Müller',
    firstName: 'Anna',
    jobTitle: 'Verkauf',
    employmentType: { type: 'PartTime' as const, weeklyHours: 20 },
    vacationEntitlementPerYear: 28,
  };

  it('creates an active employee with id and timestamps', () => {
    const employee = createEmployee(details);
    expect(employee.id).toBeTruthy();
    expect(employee.active).toBe(true);
    expect(employee.createdAt).toBe(employee.updatedAt);
  });

  it('rejects an empty job title', () => {
    expect(() => createEmployee({ ...details, jobTitle: '' })).toThrow(DomainValidationError);
  });

  it('rejects zero weekly hours', () => {
    expect(() => createEmployee({ ...details, employmentType: { type: 'FullTime', weeklyHours: 0 } })).toThrow(
      'Muss größer als 0 sein.',
    );
  });
});
