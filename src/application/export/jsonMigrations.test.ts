import { describe, it, expect } from 'vitest';
import { DomainError } from '@domain/shared/DomainError';
import { migriereZuAktuellerVersion } from './jsonMigrations';

const gueltigeDatei = {
  formatVersion: 1,
  exportiertAm: '2026-09-07T00:00:00.000Z',
  daten: { filialen: [], mitarbeiter: [], wochenplaene: [], abwesenheiten: [] },
};

describe('migriereZuAktuellerVersion', () => {
  it('akzeptiert eine gültige Exportdatei unverändert', () => {
    expect(migriereZuAktuellerVersion(gueltigeDatei)).toEqual(gueltigeDatei);
  });

  it('lehnt null/undefined/primitive Werte ab', () => {
    expect(() => migriereZuAktuellerVersion(null)).toThrow(DomainError);
    expect(() => migriereZuAktuellerVersion(undefined)).toThrow(DomainError);
    expect(() => migriereZuAktuellerVersion('kein json objekt')).toThrow(DomainError);
    expect(() => migriereZuAktuellerVersion(42)).toThrow(DomainError);
  });

  it('lehnt ein Objekt ohne formatVersion ab', () => {
    expect(() => migriereZuAktuellerVersion({ daten: gueltigeDatei.daten })).toThrow(DomainError);
  });

  it('lehnt eine neuere, unbekannte formatVersion ab', () => {
    expect(() => migriereZuAktuellerVersion({ ...gueltigeDatei, formatVersion: 99 })).toThrow(DomainError);
  });

  it('lehnt eine Datei ohne daten-Feld ab', () => {
    expect(() => migriereZuAktuellerVersion({ formatVersion: 1 })).toThrow(DomainError);
  });

  it('lehnt eine Datei ab, bei der eines der 4 Datenfelder fehlt oder kein Array ist', () => {
    expect(() =>
      migriereZuAktuellerVersion({
        formatVersion: 1,
        daten: { filialen: [], mitarbeiter: [], wochenplaene: [] }, // abwesenheiten fehlt
      }),
    ).toThrow(DomainError);

    expect(() =>
      migriereZuAktuellerVersion({
        formatVersion: 1,
        daten: { filialen: 'nicht ein array', mitarbeiter: [], wochenplaene: [], abwesenheiten: [] },
      }),
    ).toThrow(DomainError);
  });
});
