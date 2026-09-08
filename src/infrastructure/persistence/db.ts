import Dexie, { type Table } from 'dexie';
import type { Branch } from '@domain/branch/Branch';
import type { Employee } from '@domain/employee/Employee';
import type { WeeklySchedule } from '@domain/schedule/WeeklySchedule';
import type { Absence } from '@domain/absence/Absence';

// --- v1 -> v2 record shapes (pre-rename, German field names) -------------------------------
// Kept only so the version(2) upgrade below can transform existing local IndexedDB records from
// the old German field names to the current English ones. Field renames only - no value
// transformations, since the code rename left every stored value (dates, minutes, weekday keys,
// federal-state names) unchanged. Mirrors application/export/jsonMigrations.ts's v1 shapes, but is
// kept independent since the Dexie schema and the JSON export format can evolve separately.

interface AdresseV1 {
  strasse: string;
  hausnummer: string;
  plz: string;
  ort: string;
}

interface FilialeV1 {
  id: string;
  name: string;
  filialnummer: string;
  adresse: AdresseV1;
  logoBase64: string | null;
  bundesland: string;
  erlaubteVerkaufsoffeneSonntage: string[];
  aktiv: boolean;
  erstelltAm: string;
  aktualisiertAm: string;
}

type BeschaeftigungsartV1 =
  | { typ: 'Vollzeit' | 'Teilzeit'; wochenstunden: number }
  | { typ: 'Minijob'; minStunden: number; maxStunden: number };

interface MitarbeiterV1 {
  id: string;
  filialeId: string;
  nachname: string;
  vorname: string;
  taetigkeit: string;
  beschaeftigungsart: BeschaeftigungsartV1;
  urlaubsanspruchProJahr: number;
  geburtsdatum?: string;
  aktiv: boolean;
  erstelltAm: string;
  aktualisiertAm: string;
}

interface PauseV1 {
  id: string;
  beginn?: string;
  dauerMinuten: number;
}

interface SchichtV1 {
  id: string;
  beginn: string;
  ende: string;
  endeFolgetag: boolean;
  pausen: PauseV1[];
}

type TageseintragV1 = { typ: 'Schicht'; schichten: SchichtV1[] } | { typ: 'Frei' };

interface MitarbeiterWocheneinsatzV1 {
  mitarbeiterId: string;
  tage: Record<string, TageseintragV1>;
  sollAnpassungMinuten?: number;
}

interface WochenplanV1 {
  id: string;
  filialeId: string;
  kalenderwoche: { jahr: number; woche: number };
  geplanterWochenumsatz?: number;
  geplanteWochenstunden?: number;
  mitarbeiterEinsaetze: MitarbeiterWocheneinsatzV1[];
  erstelltAm: string;
  aktualisiertAm: string;
}

type AbwesenheitV1 =
  | { id: string; mitarbeiterId: string; von: string; bis: string; erstelltAm: string; art: 'Urlaub'; halbtags?: { amBeginn: boolean; amEnde: boolean }; notiz?: string }
  | { id: string; mitarbeiterId: string; von: string; bis: string; erstelltAm: string; art: 'Krankheit' }
  | { id: string; mitarbeiterId: string; von: string; bis: string; erstelltAm: string; art: 'Sonstige'; bezeichnung: string; notiz?: string };

function migrateBranchV1(f: FilialeV1): Branch {
  return {
    id: f.id as Branch['id'],
    name: f.name,
    branchNumber: f.filialnummer,
    address: { street: f.adresse.strasse, houseNumber: f.adresse.hausnummer, postalCode: f.adresse.plz, city: f.adresse.ort },
    logoBase64: f.logoBase64,
    federalState: f.bundesland as Branch['federalState'],
    allowedOpenSundays: f.erlaubteVerkaufsoffeneSonntage,
    active: f.aktiv,
    createdAt: f.erstelltAm,
    updatedAt: f.aktualisiertAm,
  };
}

function migrateEmploymentTypeV1(b: BeschaeftigungsartV1): Employee['employmentType'] {
  if (b.typ === 'Minijob') {
    return { type: 'Minijob', minHours: b.minStunden, maxHours: b.maxStunden };
  }
  return { type: b.typ === 'Vollzeit' ? 'FullTime' : 'PartTime', weeklyHours: b.wochenstunden };
}

function migrateEmployeeV1(m: MitarbeiterV1): Employee {
  return {
    id: m.id as Employee['id'],
    branchId: m.filialeId as Employee['branchId'],
    lastName: m.nachname,
    firstName: m.vorname,
    jobTitle: m.taetigkeit,
    employmentType: migrateEmploymentTypeV1(m.beschaeftigungsart),
    vacationEntitlementPerYear: m.urlaubsanspruchProJahr,
    birthDate: m.geburtsdatum,
    active: m.aktiv,
    createdAt: m.erstelltAm,
    updatedAt: m.aktualisiertAm,
  };
}

function migrateBreakV1(p: PauseV1) {
  return { id: p.id, start: p.beginn, durationMinutes: p.dauerMinuten };
}

function migrateShiftV1(s: SchichtV1) {
  return { id: s.id, start: s.beginn, end: s.ende, endsNextDay: s.endeFolgetag, breaks: s.pausen.map(migrateBreakV1) };
}

function migrateDayEntryV1(t: TageseintragV1) {
  return t.typ === 'Schicht' ? { type: 'Shift' as const, shifts: t.schichten.map(migrateShiftV1) } : { type: 'Off' as const };
}

function migrateWeekAssignmentV1(e: MitarbeiterWocheneinsatzV1) {
  const days = Object.fromEntries(Object.entries(e.tage).map(([day, entry]) => [day, migrateDayEntryV1(entry)]));
  return { employeeId: e.mitarbeiterId, days, targetAdjustmentMinutes: e.sollAnpassungMinuten };
}

function migrateWeeklyScheduleV1(w: WochenplanV1): WeeklySchedule {
  return {
    id: w.id as WeeklySchedule['id'],
    branchId: w.filialeId as WeeklySchedule['branchId'],
    calendarWeek: { year: w.kalenderwoche.jahr, week: w.kalenderwoche.woche },
    plannedWeeklyRevenue: w.geplanterWochenumsatz,
    plannedWeeklyHours: w.geplanteWochenstunden,
    employeeAssignments: w.mitarbeiterEinsaetze.map(migrateWeekAssignmentV1) as WeeklySchedule['employeeAssignments'],
    createdAt: w.erstelltAm,
    updatedAt: w.aktualisiertAm,
  };
}

function migrateAbsenceV1(a: AbwesenheitV1): Absence {
  const base = { id: a.id as Absence['id'], employeeId: a.mitarbeiterId as Absence['employeeId'], from: a.von, to: a.bis, createdAt: a.erstelltAm };
  switch (a.art) {
    case 'Urlaub':
      return {
        ...base,
        type: 'Vacation',
        halfDay: a.halbtags ? { atStart: a.halbtags.amBeginn, atEnd: a.halbtags.amEnde } : undefined,
        note: a.notiz,
      };
    case 'Krankheit':
      return { ...base, type: 'Illness' };
    case 'Sonstige':
      return { ...base, type: 'Other', label: a.bezeichnung, note: a.notiz };
  }
}

export class PepDatabase extends Dexie {
  branches!: Table<Branch, string>;
  employees!: Table<Employee, string>;
  weeklySchedules!: Table<WeeklySchedule, string>;
  absences!: Table<Absence, string>;

  constructor() {
    super('pep-datenbank');
    this.version(1).stores({
      filialen: 'id, filialnummer, aktiv',
      mitarbeiter: 'id, filialeId, aktiv, [filialeId+aktiv]',
      wochenplaene: 'id, filialeId, [filialeId+kalenderwoche.jahr+kalenderwoche.woche]',
      abwesenheiten: 'id, mitarbeiterId, art, von, [mitarbeiterId+von]',
    });

    // v2: renames every store (and every record's fields) from German to English, following the
    // code-level German->English rename. Old stores are read, transformed, and copied into the new
    // ones, then dropped (Dexie's documented table-rename pattern: set the old name to null while
    // declaring the new one in the same .stores() call) - without this, existing local data would
    // silently end up orphaned under the old German store names after the rename.
    this.version(2)
      .stores({
        filialen: null,
        mitarbeiter: null,
        wochenplaene: null,
        abwesenheiten: null,
        branches: 'id, branchNumber, active',
        employees: 'id, branchId, active, [branchId+active]',
        weeklySchedules: 'id, branchId, [branchId+calendarWeek.year+calendarWeek.week]',
        absences: 'id, employeeId, type, from, [employeeId+from]',
      })
      .upgrade(async (tx) => {
        const [oldBranches, oldEmployees, oldSchedules, oldAbsences] = await Promise.all([
          tx.table<FilialeV1, string>('filialen').toArray(),
          tx.table<MitarbeiterV1, string>('mitarbeiter').toArray(),
          tx.table<WochenplanV1, string>('wochenplaene').toArray(),
          tx.table<AbwesenheitV1, string>('abwesenheiten').toArray(),
        ]);

        await Promise.all([
          tx.table<Branch, string>('branches').bulkAdd(oldBranches.map(migrateBranchV1)),
          tx.table<Employee, string>('employees').bulkAdd(oldEmployees.map(migrateEmployeeV1)),
          tx.table<WeeklySchedule, string>('weeklySchedules').bulkAdd(oldSchedules.map(migrateWeeklyScheduleV1)),
          tx.table<Absence, string>('absences').bulkAdd(oldAbsences.map(migrateAbsenceV1)),
        ]);
      });
    // Further structural changes to the IndexedDB schema are added as their own version, e.g.:
    // this.version(3).stores({ ... }).upgrade(tx => { ... });
  }
}

export const db = new PepDatabase();

/** Runs `fn` inside a single Dexie transaction spanning all 4 stores, so a multi-store write (e.g.
 * JSON import replace) either fully applies or fully rolls back - a failure partway through can
 * never leave the database with some stores cleared and others not yet repopulated. */
export function transaction<T>(fn: () => Promise<T>): Promise<T> {
  return db.transaction('rw', db.branches, db.employees, db.weeklySchedules, db.absences, fn);
}
