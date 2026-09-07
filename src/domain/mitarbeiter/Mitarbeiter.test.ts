import { describe, it, expect } from 'vitest';
import { vergleicheNachname } from './Mitarbeiter';

function m(nachname: string, vorname: string) {
  return { nachname, vorname };
}

describe('vergleicheNachname', () => {
  it('sortiert nach Nachname A-Z', () => {
    const liste = [m('Zorn', 'Anna'), m('Adler', 'Ben'), m('Meyer', 'Chris')];
    liste.sort(vergleicheNachname);
    expect(liste.map((x) => x.nachname)).toEqual(['Adler', 'Meyer', 'Zorn']);
  });

  it('nutzt Vorname als Tiebreaker bei gleichem Nachname', () => {
    const liste = [m('Meyer', 'Zora'), m('Meyer', 'Anna')];
    liste.sort(vergleicheNachname);
    expect(liste.map((x) => x.vorname)).toEqual(['Anna', 'Zora']);
  });

  it('sortiert Umlaute nach deutscher Kollation korrekt ein', () => {
    // German collation: 'Ö' sorts near 'O', not after 'Z' (as plain code-point comparison would).
    const liste = [m('Zorn', 'A'), m('Özdemir', 'B'), m('Adler', 'C')];
    liste.sort(vergleicheNachname);
    expect(liste.map((x) => x.nachname)).toEqual(['Adler', 'Özdemir', 'Zorn']);
  });
});
