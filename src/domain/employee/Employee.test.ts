import { describe, it, expect } from 'vitest';
import type { BranchId } from '@domain/shared/ids';
import { DomainValidationError } from '@domain/shared/DomainError';
import { compareByLastName, createEmployee, isEmployedDuring, isEmployedOn } from './Employee';

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
    holidayVacationHours: 5,
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

describe('isEmployedOn', () => {
  it('is true for an employee without any dates (every record made before the fields existed)', () => {
    expect(isEmployedOn({}, '2026-03-01')).toBe(true);
  });

  it('excludes days before the entry date and includes the entry date itself', () => {
    expect(isEmployedOn({ entryDate: '2026-03-01' }, '2026-02-28')).toBe(false);
    expect(isEmployedOn({ entryDate: '2026-03-01' }, '2026-03-01')).toBe(true);
  });

  it('excludes days after the exit date and includes the exit date itself', () => {
    expect(isEmployedOn({ exitDate: '2026-03-31' }, '2026-04-01')).toBe(false);
    expect(isEmployedOn({ exitDate: '2026-03-31' }, '2026-03-31')).toBe(true);
  });
});

describe('isEmployedDuring', () => {
  const period = { entryDate: '2026-03-04', exitDate: '2026-03-06' };

  it('is true when the period overlaps the range at all', () => {
    expect(isEmployedDuring(period, '2026-03-02', '2026-03-08')).toBe(true);
    expect(isEmployedDuring(period, '2026-03-06', '2026-03-12')).toBe(true);
  });

  it('is false when the employment starts after or ended before the range', () => {
    expect(isEmployedDuring(period, '2026-02-23', '2026-03-01')).toBe(false);
    expect(isEmployedDuring(period, '2026-03-09', '2026-03-15')).toBe(false);
  });

  it('is true without any dates', () => {
    expect(isEmployedDuring({}, '2026-03-02', '2026-03-08')).toBe(true);
  });
});
