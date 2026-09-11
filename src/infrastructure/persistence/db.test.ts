import Dexie from 'dexie';
import { describe, it, expect } from 'vitest';
import { PepDatabase, db, transaction } from './db';
import { defaultHolidayVacationHours } from '@domain/employee/EmploymentType';
import { clockTime } from '@domain/shared/ClockTime';
import { createShift } from '@domain/schedule/Shift';
import type { BranchId, EmployeeId, WeeklyScheduleId, AbsenceId, ShiftTemplateId } from '@domain/shared/ids';

const DB_NAME = 'pep-datenbank';

describe('PepDatabase v1 -> v2 branch migration', () => {
  it('maps a German filialen record onto the English branches shape', async () => {
    await Dexie.delete(DB_NAME);
    const seed = new Dexie(DB_NAME);
    seed.version(1).stores({
      filialen: 'id, filialnummer, aktiv',
      mitarbeiter: 'id, filialeId, aktiv, [filialeId+aktiv]',
      wochenplaene: 'id, filialeId, [filialeId+kalenderwoche.jahr+kalenderwoche.woche]',
      abwesenheiten: 'id, mitarbeiterId, art, von, [mitarbeiterId+von]',
    });
    await seed.open();
    await seed.table('filialen').add({
      id: 'b1',
      name: 'Filiale Mitte',
      filialnummer: '001',
      adresse: { strasse: 'Hauptstraße', hausnummer: '12', plz: '10115', ort: 'Berlin' },
      logoBase64: null,
      bundesland: 'Berlin',
      erlaubteVerkaufsoffeneSonntage: ['2026-12-13'],
      aktiv: true,
      erstelltAm: '2026-01-01T00:00:00.000Z',
      aktualisiertAm: '2026-01-02T00:00:00.000Z',
    });
    seed.close();

    const upgraded = new PepDatabase();
    await upgraded.open();
    const branches = await upgraded.branches.toArray();
    expect(branches).toEqual([
      {
        id: 'b1',
        name: 'Filiale Mitte',
        branchNumber: '001',
        address: { street: 'Hauptstraße', houseNumber: '12', postalCode: '10115', city: 'Berlin' },
        logoBase64: null,
        federalState: 'Berlin',
        allowedOpenSundays: ['2026-12-13'],
        active: true,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-02T00:00:00.000Z',
      },
    ]);
    upgraded.close();
  });
});

describe('PepDatabase v1 -> v2 employee migration', () => {
  it('maps a Vollzeit employee, computing holidayVacationHours during the v1 -> v2 migration', async () => {
    await Dexie.delete(DB_NAME);
    const seed = new Dexie(DB_NAME);
    seed.version(1).stores({
      filialen: 'id, filialnummer, aktiv',
      mitarbeiter: 'id, filialeId, aktiv, [filialeId+aktiv]',
      wochenplaene: 'id, filialeId, [filialeId+kalenderwoche.jahr+kalenderwoche.woche]',
      abwesenheiten: 'id, mitarbeiterId, art, von, [mitarbeiterId+von]',
    });
    await seed.open();
    await seed.table('mitarbeiter').add({
      id: 'e1',
      filialeId: 'b1',
      nachname: 'Muster',
      vorname: 'Max',
      taetigkeit: 'Verkäufer',
      beschaeftigungsart: { typ: 'Vollzeit', wochenstunden: 38 },
      urlaubsanspruchProJahr: 28,
      geburtsdatum: '1990-05-01',
      aktiv: true,
      erstelltAm: '2026-01-01T00:00:00.000Z',
      aktualisiertAm: '2026-01-02T00:00:00.000Z',
    });
    seed.close();

    const upgraded = new PepDatabase();
    await upgraded.open();
    const employees = await upgraded.employees.toArray();
    expect(employees).toHaveLength(1);
    const expectedHolidayVacationHours = defaultHolidayVacationHours({ type: 'FullTime', weeklyHours: 38 });
    expect(employees[0]).toEqual({
      id: 'e1',
      branchId: 'b1',
      lastName: 'Muster',
      firstName: 'Max',
      jobTitle: 'Verkäufer',
      employmentType: { type: 'FullTime', weeklyHours: 38 },
      vacationEntitlementPerYear: 28,
      holidayVacationHours: expectedHolidayVacationHours,
      birthDate: '1990-05-01',
      active: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
    });
    expect(typeof employees[0].holidayVacationHours).toBe('number');
    upgraded.close();
  });

  it('maps a Minijob employee', async () => {
    await Dexie.delete(DB_NAME);
    const seed = new Dexie(DB_NAME);
    seed.version(1).stores({
      filialen: 'id, filialnummer, aktiv',
      mitarbeiter: 'id, filialeId, aktiv, [filialeId+aktiv]',
      wochenplaene: 'id, filialeId, [filialeId+kalenderwoche.jahr+kalenderwoche.woche]',
      abwesenheiten: 'id, mitarbeiterId, art, von, [mitarbeiterId+von]',
    });
    await seed.open();
    await seed.table('mitarbeiter').add({
      id: 'e2',
      filialeId: 'b1',
      nachname: 'Beispiel',
      vorname: 'Erika',
      taetigkeit: 'Kassiererin',
      beschaeftigungsart: { typ: 'Minijob', minStunden: 5, maxStunden: 10 },
      urlaubsanspruchProJahr: 12,
      aktiv: true,
      erstelltAm: '2026-01-01T00:00:00.000Z',
      aktualisiertAm: '2026-01-02T00:00:00.000Z',
    });
    seed.close();

    const upgraded = new PepDatabase();
    await upgraded.open();
    const employees = await upgraded.employees.toArray();
    const expectedHolidayVacationHours = defaultHolidayVacationHours({ type: 'Minijob', minHours: 5, maxHours: 10 });
    expect(employees[0].employmentType).toEqual({ type: 'Minijob', minHours: 5, maxHours: 10 });
    expect(employees[0].holidayVacationHours).toBe(expectedHolidayVacationHours);
    expect(employees[0].birthDate).toBeUndefined();
    upgraded.close();
  });

  it('maps a Teilzeit employee', async () => {
    await Dexie.delete(DB_NAME);
    const seed = new Dexie(DB_NAME);
    seed.version(1).stores({
      filialen: 'id, filialnummer, aktiv',
      mitarbeiter: 'id, filialeId, aktiv, [filialeId+aktiv]',
      wochenplaene: 'id, filialeId, [filialeId+kalenderwoche.jahr+kalenderwoche.woche]',
      abwesenheiten: 'id, mitarbeiterId, art, von, [mitarbeiterId+von]',
    });
    await seed.open();
    await seed.table('mitarbeiter').add({
      id: 'e3',
      filialeId: 'b1',
      nachname: 'Teilzeit',
      vorname: 'Tom',
      taetigkeit: 'Lagerist',
      beschaeftigungsart: { typ: 'Teilzeit', wochenstunden: 20 },
      urlaubsanspruchProJahr: 20,
      aktiv: true,
      erstelltAm: '2026-01-01T00:00:00.000Z',
      aktualisiertAm: '2026-01-02T00:00:00.000Z',
    });
    seed.close();

    const upgraded = new PepDatabase();
    await upgraded.open();
    const employees = await upgraded.employees.toArray();
    expect(employees[0].employmentType).toEqual({ type: 'PartTime', weeklyHours: 20 });
    upgraded.close();
  });
});

describe('PepDatabase v1 -> v2 weeklySchedule migration', () => {
  it('maps calendarWeek, a Schicht day and a Frei day', async () => {
    await Dexie.delete(DB_NAME);
    const seed = new Dexie(DB_NAME);
    seed.version(1).stores({
      filialen: 'id, filialnummer, aktiv',
      mitarbeiter: 'id, filialeId, aktiv, [filialeId+aktiv]',
      wochenplaene: 'id, filialeId, [filialeId+kalenderwoche.jahr+kalenderwoche.woche]',
      abwesenheiten: 'id, mitarbeiterId, art, von, [mitarbeiterId+von]',
    });
    await seed.open();
    await seed.table('wochenplaene').add({
      id: 'w1',
      filialeId: 'b1',
      kalenderwoche: { jahr: 2026, woche: 37 },
      geplanterWochenumsatz: 50000,
      geplanteWochenstunden: 120,
      mitarbeiterEinsaetze: [
        {
          mitarbeiterId: 'e1',
          tage: {
            Montag: {
              typ: 'Schicht',
              schichten: [
                {
                  id: 's1',
                  beginn: '08:00',
                  ende: '16:00',
                  endeFolgetag: false,
                  pausen: [{ id: 'p1', beginn: '12:00', dauerMinuten: 30 }],
                },
              ],
            },
            Dienstag: { typ: 'Frei' },
          },
          sollAnpassungMinuten: 15,
        },
      ],
      erstelltAm: '2026-01-01T00:00:00.000Z',
      aktualisiertAm: '2026-01-02T00:00:00.000Z',
    });
    seed.close();

    const upgraded = new PepDatabase();
    await upgraded.open();
    const schedules = await upgraded.weeklySchedules.toArray();
    expect(schedules).toEqual([
      {
        id: 'w1',
        branchId: 'b1',
        calendarWeek: { year: 2026, week: 37 },
        plannedWeeklyRevenue: 50000,
        plannedWeeklyHours: 120,
        employeeAssignments: [
          {
            employeeId: 'e1',
            days: {
              Montag: {
                type: 'Shift',
                shifts: [
                  {
                    id: 's1',
                    start: '08:00',
                    end: '16:00',
                    endsNextDay: false,
                    breaks: [{ id: 'p1', start: '12:00', durationMinutes: 30 }],
                  },
                ],
              },
              Dienstag: { type: 'Off' },
            },
            targetAdjustmentMinutes: 15,
          },
        ],
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-02T00:00:00.000Z',
      },
    ]);
    upgraded.close();
  });
});

describe('PepDatabase v1 -> v2 absence migration', () => {
  it('maps Urlaub, Krankheit and Sonstige to Vacation, Illness and Other', async () => {
    await Dexie.delete(DB_NAME);
    const seed = new Dexie(DB_NAME);
    seed.version(1).stores({
      filialen: 'id, filialnummer, aktiv',
      mitarbeiter: 'id, filialeId, aktiv, [filialeId+aktiv]',
      wochenplaene: 'id, filialeId, [filialeId+kalenderwoche.jahr+kalenderwoche.woche]',
      abwesenheiten: 'id, mitarbeiterId, art, von, [mitarbeiterId+von]',
    });
    await seed.open();
    await seed.table('abwesenheiten').bulkAdd([
      {
        id: 'a1',
        mitarbeiterId: 'e1',
        von: '2026-07-01',
        bis: '2026-07-10',
        erstelltAm: '2026-06-01T00:00:00.000Z',
        art: 'Urlaub',
        halbtags: { amBeginn: true, amEnde: false },
        notiz: 'Sommerurlaub',
      },
      {
        id: 'a2',
        mitarbeiterId: 'e1',
        von: '2026-08-01',
        bis: '2026-08-03',
        erstelltAm: '2026-07-15T00:00:00.000Z',
        art: 'Krankheit',
      },
      {
        id: 'a3',
        mitarbeiterId: 'e1',
        von: '2026-09-01',
        bis: '2026-09-01',
        erstelltAm: '2026-08-20T00:00:00.000Z',
        art: 'Sonstige',
        bezeichnung: 'Fortbildung',
        notiz: 'Schulung',
      },
    ]);
    seed.close();

    const upgraded = new PepDatabase();
    await upgraded.open();
    const absences = await upgraded.absences.toArray();
    expect(absences).toEqual(
      expect.arrayContaining([
        {
          id: 'a1',
          employeeId: 'e1',
          from: '2026-07-01',
          to: '2026-07-10',
          createdAt: '2026-06-01T00:00:00.000Z',
          type: 'Vacation',
          halfDay: { atStart: true, atEnd: false },
          note: 'Sommerurlaub',
        },
        {
          id: 'a2',
          employeeId: 'e1',
          from: '2026-08-01',
          to: '2026-08-03',
          createdAt: '2026-07-15T00:00:00.000Z',
          type: 'Illness',
        },
        {
          id: 'a3',
          employeeId: 'e1',
          from: '2026-09-01',
          to: '2026-09-01',
          createdAt: '2026-08-20T00:00:00.000Z',
          type: 'Other',
          label: 'Fortbildung',
          note: 'Schulung',
        },
      ]),
    );
    expect(absences).toHaveLength(3);
    upgraded.close();
  });

  it('maps Urlaub without halbtags/notiz to an undefined halfDay and note', async () => {
    await Dexie.delete(DB_NAME);
    const seed = new Dexie(DB_NAME);
    seed.version(1).stores({
      filialen: 'id, filialnummer, aktiv',
      mitarbeiter: 'id, filialeId, aktiv, [filialeId+aktiv]',
      wochenplaene: 'id, filialeId, [filialeId+kalenderwoche.jahr+kalenderwoche.woche]',
      abwesenheiten: 'id, mitarbeiterId, art, von, [mitarbeiterId+von]',
    });
    await seed.open();
    await seed.table('abwesenheiten').add({
      id: 'a4',
      mitarbeiterId: 'e1',
      von: '2026-10-01',
      bis: '2026-10-05',
      erstelltAm: '2026-09-01T00:00:00.000Z',
      art: 'Urlaub',
    });
    seed.close();

    const upgraded = new PepDatabase();
    await upgraded.open();
    const absences = await upgraded.absences.toArray();
    expect(absences).toEqual([
      {
        id: 'a4',
        employeeId: 'e1',
        from: '2026-10-01',
        to: '2026-10-05',
        createdAt: '2026-09-01T00:00:00.000Z',
        type: 'Vacation',
        halfDay: undefined,
        note: undefined,
      },
    ]);
    upgraded.close();
  });
});

describe('PepDatabase v3 holidayVacationHours backfill', () => {
  it('backfills a v2-shaped employee record missing holidayVacationHours', async () => {
    await Dexie.delete(DB_NAME);
    const seed = new Dexie(DB_NAME);
    seed.version(2).stores({
      branches: 'id, branchNumber, active',
      employees: 'id, branchId, active, [branchId+active]',
      weeklySchedules: 'id, branchId, [branchId+calendarWeek.year+calendarWeek.week]',
      absences: 'id, employeeId, type, from, [employeeId+from]',
    });
    await seed.open();
    await seed.table('employees').add({
      id: 'e1',
      branchId: 'b1',
      lastName: 'Muster',
      firstName: 'Max',
      jobTitle: 'Verkäufer',
      employmentType: { type: 'PartTime', weeklyHours: 24 },
      vacationEntitlementPerYear: 26,
      birthDate: '1990-05-01',
      active: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
    });
    seed.close();

    const upgraded = new PepDatabase();
    await upgraded.open();
    const employees = await upgraded.employees.toArray();
    expect(employees).toHaveLength(1);
    expect(employees[0].holidayVacationHours).toBe(
      defaultHolidayVacationHours({ type: 'PartTime', weeklyHours: 24 }),
    );
    expect(employees[0].lastName).toBe('Muster');
    upgraded.close();
  });

  it('leaves an existing numeric holidayVacationHours untouched', async () => {
    await Dexie.delete(DB_NAME);
    const seed = new Dexie(DB_NAME);
    seed.version(2).stores({
      branches: 'id, branchNumber, active',
      employees: 'id, branchId, active, [branchId+active]',
      weeklySchedules: 'id, branchId, [branchId+calendarWeek.year+calendarWeek.week]',
      absences: 'id, employeeId, type, from, [employeeId+from]',
    });
    await seed.open();
    await seed.table('employees').add({
      id: 'e1',
      branchId: 'b1',
      lastName: 'Muster',
      firstName: 'Max',
      jobTitle: 'Verkäufer',
      employmentType: { type: 'FullTime', weeklyHours: 40 },
      vacationEntitlementPerYear: 30,
      holidayVacationHours: 7.5,
      active: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
    });
    seed.close();

    const upgraded = new PepDatabase();
    await upgraded.open();
    const employees = await upgraded.employees.toArray();
    expect(employees[0].holidayVacationHours).toBe(7.5);
    upgraded.close();
  });
});

describe('PepDatabase old stores removal', () => {
  it('drops the German v1 store names after upgrading', async () => {
    await Dexie.delete(DB_NAME);
    const seed = new Dexie(DB_NAME);
    seed.version(1).stores({
      filialen: 'id, filialnummer, aktiv',
      mitarbeiter: 'id, filialeId, aktiv, [filialeId+aktiv]',
      wochenplaene: 'id, filialeId, [filialeId+kalenderwoche.jahr+kalenderwoche.woche]',
      abwesenheiten: 'id, mitarbeiterId, art, von, [mitarbeiterId+von]',
    });
    await seed.open();
    await seed.table('filialen').add({
      id: 'b1',
      name: 'Filiale Mitte',
      filialnummer: '001',
      adresse: { strasse: 'Hauptstraße', hausnummer: '12', plz: '10115', ort: 'Berlin' },
      logoBase64: null,
      bundesland: 'Berlin',
      erlaubteVerkaufsoffeneSonntage: [],
      aktiv: true,
      erstelltAm: '2026-01-01T00:00:00.000Z',
      aktualisiertAm: '2026-01-02T00:00:00.000Z',
    });
    seed.close();

    const upgraded = new PepDatabase();
    await upgraded.open();
    const tableNames = upgraded.tables.map((t) => t.name);
    expect(tableNames).not.toContain('filialen');
    expect(tableNames).not.toContain('mitarbeiter');
    expect(tableNames).not.toContain('wochenplaene');
    expect(tableNames).not.toContain('abwesenheiten');
    expect(tableNames).toEqual(
      expect.arrayContaining(['branches', 'employees', 'weeklySchedules', 'absences', 'shiftTemplates']),
    );
    upgraded.close();
  });
});

describe('transaction()', () => {
  it('writes to all 5 stores atomically', async () => {
    await db.branches.clear();
    await db.employees.clear();
    await db.weeklySchedules.clear();
    await db.absences.clear();
    await db.shiftTemplates.clear();

    const branchId = 'tx-branch-1' as BranchId;
    const employeeId = 'tx-employee-1' as EmployeeId;
    const scheduleId = 'tx-schedule-1' as WeeklyScheduleId;
    const absenceId = 'tx-absence-1' as AbsenceId;
    const templateId = 'tx-template-1' as ShiftTemplateId;

    await transaction(() =>
      Promise.all([
        db.branches.put({
          id: branchId,
          name: 'Filiale Nord',
          branchNumber: '002',
          address: { street: 'Nordstraße', houseNumber: '5', postalCode: '20095', city: 'Hamburg' },
          logoBase64: null,
          federalState: 'Hamburg',
          allowedOpenSundays: [],
          active: true,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        }),
        db.employees.put({
          id: employeeId,
          branchId,
          lastName: 'Schmidt',
          firstName: 'Anna',
          jobTitle: 'Verkäuferin',
          employmentType: { type: 'FullTime', weeklyHours: 40 },
          vacationEntitlementPerYear: 28,
          holidayVacationHours: 6.67,
          active: true,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        }),
        db.weeklySchedules.put({
          id: scheduleId,
          branchId,
          calendarWeek: { year: 2026, week: 37 },
          employeeAssignments: [],
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        }),
        db.absences.put({
          id: absenceId,
          employeeId,
          type: 'Illness',
          from: '2026-09-07',
          to: '2026-09-08',
          createdAt: '2026-01-01T00:00:00.000Z',
        }),
        db.shiftTemplates.put({
          id: templateId,
          branchId,
          name: 'Frühschicht',
          shifts: [createShift(clockTime('08:00'), clockTime('16:00'))],
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        }),
      ]),
    );

    const [storedBranch, storedEmployee, storedSchedule, storedAbsence, storedTemplate] = await Promise.all([
      db.branches.get(branchId),
      db.employees.get(employeeId),
      db.weeklySchedules.get(scheduleId),
      db.absences.get(absenceId),
      db.shiftTemplates.get(templateId),
    ]);
    expect(storedBranch?.name).toBe('Filiale Nord');
    expect(storedEmployee?.lastName).toBe('Schmidt');
    expect(storedSchedule?.calendarWeek).toEqual({ year: 2026, week: 37 });
    expect(storedAbsence?.type).toBe('Illness');
    expect(storedTemplate?.name).toBe('Frühschicht');
  });

  it('rolls back every store when one write in the transaction fails', async () => {
    await db.branches.clear();
    await db.employees.clear();

    const branchId = 'tx-branch-2' as BranchId;
    const employeeId = 'tx-employee-2' as EmployeeId;

    await expect(
      transaction(async () => {
        await db.branches.put({
          id: branchId,
          name: 'Filiale Rollback',
          branchNumber: '003',
          address: { street: 'Teststraße', houseNumber: '1', postalCode: '10000', city: 'Berlin' },
          logoBase64: null,
          federalState: 'Berlin',
          allowedOpenSundays: [],
          active: true,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        });
        await db.employees.put({
          id: employeeId,
          branchId,
          lastName: 'Fehler',
          firstName: 'Rollback',
          jobTitle: 'Verkäufer',
          employmentType: { type: 'FullTime', weeklyHours: 40 },
          vacationEntitlementPerYear: 28,
          holidayVacationHours: 6.67,
          active: true,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        });
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    const storedBranch = await db.branches.get(branchId);
    const storedEmployee = await db.employees.get(employeeId);
    expect(storedBranch).toBeUndefined();
    expect(storedEmployee).toBeUndefined();
  });
});
