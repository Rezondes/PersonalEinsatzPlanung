import { describe, it, expect } from 'vitest';
import { compareByLastName } from './Employee';

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
