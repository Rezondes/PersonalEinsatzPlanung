import { describe, it, expect } from 'vitest';
import { DomainError } from '@domain/shared/DomainError';
import { migrateToCurrentVersion } from './jsonMigrations';

const validFile = {
  formatVersion: 3,
  exportedAt: '2026-09-07T00:00:00.000Z',
  data: { branches: [], employees: [], weeklySchedules: [], absences: [] },
};

describe('migrateToCurrentVersion', () => {
  it('accepts a valid current-version export file unchanged', () => {
    expect(migrateToCurrentVersion(validFile)).toEqual(validFile);
  });

  it('rejects null/undefined/primitive values', () => {
    expect(() => migrateToCurrentVersion(null)).toThrow(DomainError);
    expect(() => migrateToCurrentVersion(undefined)).toThrow(DomainError);
    expect(() => migrateToCurrentVersion('not a json object')).toThrow(DomainError);
    expect(() => migrateToCurrentVersion(42)).toThrow(DomainError);
  });

  it('rejects an object without formatVersion', () => {
    expect(() => migrateToCurrentVersion({ data: validFile.data })).toThrow(DomainError);
  });

  it('rejects a newer, unknown formatVersion', () => {
    expect(() => migrateToCurrentVersion({ ...validFile, formatVersion: 99 })).toThrow(DomainError);
  });

  it('rejects a v2 file without a data field', () => {
    expect(() => migrateToCurrentVersion({ formatVersion: 2 })).toThrow(DomainError);
  });

  it('rejects a v2 file where one of the 4 data fields is missing or not an array', () => {
    expect(() =>
      migrateToCurrentVersion({
        formatVersion: 2,
        data: { branches: [], employees: [], weeklySchedules: [] }, // absences missing
      }),
    ).toThrow(DomainError);

    expect(() =>
      migrateToCurrentVersion({
        formatVersion: 2,
        data: { branches: 'not an array', employees: [], weeklySchedules: [], absences: [] },
      }),
    ).toThrow(DomainError);
  });

  it('migrates a v1 file (pre-rename German field names) through to the current structure', () => {
    const fileV1 = {
      formatVersion: 1,
      exportiertAm: '2025-01-01T00:00:00.000Z',
      daten: {
        filialen: [
          {
            id: 'f1',
            name: 'Filiale Velpke',
            filialnummer: '2504',
            adresse: { strasse: 'Weidenweg', hausnummer: '1', plz: '38458', ort: 'Velpke' },
            logoBase64: null,
            bundesland: 'Niedersachsen',
            erlaubteVerkaufsoffeneSonntage: ['2025-12-14'],
            aktiv: true,
            erstelltAm: '2025-01-01T00:00:00.000Z',
            aktualisiertAm: '2025-01-01T00:00:00.000Z',
          },
        ],
        mitarbeiter: [
          {
            id: 'm1',
            filialeId: 'f1',
            nachname: 'Adler',
            vorname: 'Ben',
            taetigkeit: 'Verkäufer/-in',
            beschaeftigungsart: { typ: 'Vollzeit', wochenstunden: 37.5 },
            urlaubsanspruchProJahr: 28,
            geburtsdatum: '1990-05-01',
            aktiv: true,
            erstelltAm: '2025-01-01T00:00:00.000Z',
            aktualisiertAm: '2025-01-01T00:00:00.000Z',
          },
          {
            id: 'm2',
            filialeId: 'f1',
            nachname: 'Meyer',
            vorname: 'Chris',
            taetigkeit: 'Aushilfe',
            beschaeftigungsart: { typ: 'Minijob', minStunden: 6, maxStunden: 10 },
            urlaubsanspruchProJahr: 12,
            aktiv: true,
            erstelltAm: '2025-01-01T00:00:00.000Z',
            aktualisiertAm: '2025-01-01T00:00:00.000Z',
          },
        ],
        wochenplaene: [
          {
            id: 'w1',
            filialeId: 'f1',
            kalenderwoche: { jahr: 2026, woche: 37 },
            geplanterWochenumsatz: 50000,
            geplanteWochenstunden: 200,
            mitarbeiterEinsaetze: [
              {
                mitarbeiterId: 'm1',
                tage: {
                  Montag: {
                    typ: 'Schicht',
                    schichten: [
                      { id: 's1', beginn: '06:00', ende: '14:00', endeFolgetag: false, pausen: [{ id: 'p1', beginn: '10:00', dauerMinuten: 30 }] },
                    ],
                  },
                  Dienstag: { typ: 'Frei' },
                },
                sollAnpassungMinuten: 90,
              },
            ],
            erstelltAm: '2026-09-01T00:00:00.000Z',
            aktualisiertAm: '2026-09-01T00:00:00.000Z',
          },
        ],
        abwesenheiten: [
          {
            id: 'a1',
            mitarbeiterId: 'm2',
            von: '2026-09-10',
            bis: '2026-09-12',
            erstelltAm: '2026-08-01T00:00:00.000Z',
            art: 'Urlaub',
            halbtags: { amBeginn: true, amEnde: false },
            notiz: 'Arzttermin',
          },
          {
            id: 'a2',
            mitarbeiterId: 'm1',
            von: '2026-09-15',
            bis: '2026-09-15',
            erstelltAm: '2026-09-01T00:00:00.000Z',
            art: 'Krankheit',
          },
          {
            id: 'a3',
            mitarbeiterId: 'm1',
            von: '2026-09-20',
            bis: '2026-09-20',
            erstelltAm: '2026-09-01T00:00:00.000Z',
            art: 'Sonstige',
            bezeichnung: 'Fortbildung',
          },
        ],
      },
    };

    const migrated = migrateToCurrentVersion(fileV1);

    expect(migrated.formatVersion).toBe(3);
    expect(migrated.exportedAt).toBe('2025-01-01T00:00:00.000Z');

    expect(migrated.data.branches).toEqual([
      {
        id: 'f1',
        name: 'Filiale Velpke',
        branchNumber: '2504',
        address: { street: 'Weidenweg', houseNumber: '1', postalCode: '38458', city: 'Velpke' },
        logoBase64: null,
        federalState: 'Niedersachsen',
        allowedOpenSundays: ['2025-12-14'],
        active: true,
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-01T00:00:00.000Z',
      },
    ]);

    expect(migrated.data.employees[0]).toMatchObject({
      id: 'm1',
      branchId: 'f1',
      lastName: 'Adler',
      firstName: 'Ben',
      jobTitle: 'Verkäufer/-in',
      employmentType: { type: 'FullTime', weeklyHours: 37.5 },
      vacationEntitlementPerYear: 28,
      // Did not exist in v1/v2; backfilled from the contract hours over a 6-day week.
      holidayVacationHours: 37.5 / 6,
      birthDate: '1990-05-01',
      active: true,
    });
    expect(migrated.data.employees[1].employmentType).toEqual({ type: 'Minijob', minHours: 6, maxHours: 10 });

    const schedule = migrated.data.weeklySchedules[0];
    expect(schedule.branchId).toBe('f1');
    expect(schedule.calendarWeek).toEqual({ year: 2026, week: 37 });
    expect(schedule.plannedWeeklyRevenue).toBe(50000);
    const assignment = schedule.employeeAssignments[0];
    expect(assignment.employeeId).toBe('m1');
    expect(assignment.targetAdjustmentMinutes).toBe(90);
    expect(assignment.days.Montag).toEqual({
      type: 'Shift',
      shifts: [{ id: 's1', start: '06:00', end: '14:00', endsNextDay: false, breaks: [{ id: 'p1', start: '10:00', durationMinutes: 30 }] }],
    });
    expect(assignment.days.Dienstag).toEqual({ type: 'Off' });

    expect(migrated.data.absences[0]).toEqual({
      id: 'a1',
      employeeId: 'm2',
      from: '2026-09-10',
      to: '2026-09-12',
      createdAt: '2026-08-01T00:00:00.000Z',
      type: 'Vacation',
      halfDay: { atStart: true, atEnd: false },
      note: 'Arzttermin',
    });
    expect(migrated.data.absences[1]).toEqual({
      id: 'a2',
      employeeId: 'm1',
      from: '2026-09-15',
      to: '2026-09-15',
      createdAt: '2026-09-01T00:00:00.000Z',
      type: 'Illness',
    });
    expect(migrated.data.absences[2]).toEqual({
      id: 'a3',
      employeeId: 'm1',
      from: '2026-09-20',
      to: '2026-09-20',
      createdAt: '2026-09-01T00:00:00.000Z',
      type: 'Other',
      label: 'Fortbildung',
      note: undefined,
    });
  });

  it('rejects a v1 file where one of the 4 data fields is missing or not an array', () => {
    expect(() =>
      migrateToCurrentVersion({
        formatVersion: 1,
        exportiertAm: '2025-01-01T00:00:00.000Z',
        daten: { filialen: [], mitarbeiter: [], wochenplaene: [] }, // abwesenheiten missing
      }),
    ).toThrow(DomainError);
  });
});
