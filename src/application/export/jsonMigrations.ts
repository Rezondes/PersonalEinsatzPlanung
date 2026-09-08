import { DomainError } from '@domain/shared/DomainError';
import type { Employee } from '@domain/employee/Employee';
import { defaultHolidayVacationHours } from '@domain/employee/EmploymentType';
import type { PepExportFile } from './jsonExportFormat';
import { CURRENT_FORMAT_VERSION } from './jsonExportFormat';

/**
 * Shape of a formatVersion-1 export file, exactly as produced by the app before the German->English
 * rename (field names only - the German UI-facing string values inside, e.g. weekday keys or
 * Bundesland names, are unaffected and copied through as-is). Kept here only so old backups made
 * before the rename can still be imported - never used for anything else, and never exported to.
 */
interface PepExportFileV1 {
  formatVersion: 1;
  exportiertAm: string;
  daten: {
    filialen: FilialeV1[];
    mitarbeiter: MitarbeiterV1[];
    wochenplaene: WochenplanV1[];
    abwesenheiten: AbwesenheitV1[];
  };
}

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
  // Keys are the (unchanged, German) Wochentag values 'Montag'..'Sonntag'.
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

function migrateAddressV1(a: AdresseV1) {
  return { street: a.strasse, houseNumber: a.hausnummer, postalCode: a.plz, city: a.ort };
}

function migrateBranchV1(f: FilialeV1) {
  return {
    id: f.id,
    name: f.name,
    branchNumber: f.filialnummer,
    address: migrateAddressV1(f.adresse),
    logoBase64: f.logoBase64,
    federalState: f.bundesland,
    allowedOpenSundays: f.erlaubteVerkaufsoffeneSonntage,
    active: f.aktiv,
    createdAt: f.erstelltAm,
    updatedAt: f.aktualisiertAm,
  };
}

function migrateEmploymentTypeV1(b: BeschaeftigungsartV1) {
  if (b.typ === 'Minijob') {
    return { type: 'Minijob' as const, minHours: b.minStunden, maxHours: b.maxStunden };
  }
  return { type: b.typ === 'Vollzeit' ? ('FullTime' as const) : ('PartTime' as const), weeklyHours: b.wochenstunden };
}

function migrateEmployeeV1(m: MitarbeiterV1) {
  return {
    id: m.id,
    branchId: m.filialeId,
    lastName: m.nachname,
    firstName: m.vorname,
    jobTitle: m.taetigkeit,
    employmentType: migrateEmploymentTypeV1(m.beschaeftigungsart),
    vacationEntitlementPerYear: m.urlaubsanspruchProJahr,
    // Did not exist in v1; the v2->v3 step below would fill it anyway, this just keeps the
    // intermediate v2 object complete.
    holidayVacationHours: defaultHolidayVacationHours(migrateEmploymentTypeV1(m.beschaeftigungsart)),
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

function migrateWeeklyScheduleV1(w: WochenplanV1) {
  return {
    id: w.id,
    branchId: w.filialeId,
    calendarWeek: { year: w.kalenderwoche.jahr, week: w.kalenderwoche.woche },
    plannedWeeklyRevenue: w.geplanterWochenumsatz,
    plannedWeeklyHours: w.geplanteWochenstunden,
    employeeAssignments: w.mitarbeiterEinsaetze.map(migrateWeekAssignmentV1),
    createdAt: w.erstelltAm,
    updatedAt: w.aktualisiertAm,
  };
}

function migrateAbsenceV1(a: AbwesenheitV1) {
  const base = { id: a.id, employeeId: a.mitarbeiterId, from: a.von, to: a.bis, createdAt: a.erstelltAm };
  switch (a.art) {
    case 'Urlaub':
      return {
        ...base,
        type: 'Vacation' as const,
        halfDay: a.halbtags ? { atStart: a.halbtags.amBeginn, atEnd: a.halbtags.amEnde } : undefined,
        note: a.notiz,
      };
    case 'Krankheit':
      return { ...base, type: 'Illness' as const };
    case 'Sonstige':
      return { ...base, type: 'Other' as const, label: a.bezeichnung, note: a.notiz };
  }
}

/**
 * Shape of a formatVersion-2 export file: identical to the current one except that Employee did not
 * have holidayVacationHours yet. Only the fields the v2->v3 step touches are spelled out; the rest
 * is copied through untouched.
 */
type EmployeeV2 = Omit<Employee, 'holidayVacationHours'> & { holidayVacationHours?: number };

interface PepExportFileV2 {
  formatVersion: 2;
  exportedAt: string;
  data: Omit<PepExportFile['data'], 'employees'> & { employees: EmployeeV2[] };
}

/** Migrates a formatVersion-1 file (German field names, pre-rename) to the v2 structure
 * (English field names). Only field renames - no value transformations, since the rename left every
 * stored value (dates, minutes, weekday keys, federal-state names) unchanged. */
function migrateV1ToV2(fileV1: PepExportFileV1): PepExportFileV2 {
  return {
    formatVersion: 2,
    exportedAt: fileV1.exportiertAm,
    data: {
      branches: fileV1.daten.filialen.map(migrateBranchV1),
      employees: fileV1.daten.mitarbeiter.map(migrateEmployeeV1),
      weeklySchedules: fileV1.daten.wochenplaene.map(migrateWeeklyScheduleV1),
      absences: fileV1.daten.abwesenheiten.map(migrateAbsenceV1),
    },
  } as PepExportFileV2;
}

/** Migrates a formatVersion-2 file to v3: Employee.holidayVacationHours became a required field.
 * Backfills it with the same default as the Dexie version(3) upgrade, so a restored backup and a
 * locally upgraded database end up with identical values. */
function migrateV2ToV3(fileV2: PepExportFileV2): PepExportFile {
  return {
    formatVersion: CURRENT_FORMAT_VERSION,
    exportedAt: fileV2.exportedAt,
    data: {
      ...fileV2.data,
      employees: fileV2.data.employees.map((employee) => ({
        ...employee,
        holidayVacationHours:
          employee.holidayVacationHours ?? defaultHolidayVacationHours(employee.employmentType),
      })),
    },
  };
}

function isValidDataStructure(data: unknown): data is PepExportFile['data'] {
  if (typeof data !== 'object' || data === null) {
    return false;
  }
  const d = data as Record<string, unknown>;
  return (
    Array.isArray(d.branches) &&
    Array.isArray(d.employees) &&
    Array.isArray(d.weeklySchedules) &&
    Array.isArray(d.absences)
  );
}

function isValidV1DataStructure(daten: unknown): daten is PepExportFileV1['daten'] {
  if (typeof daten !== 'object' || daten === null) {
    return false;
  }
  const d = daten as Record<string, unknown>;
  return (
    Array.isArray(d.filialen) &&
    Array.isArray(d.mitarbeiter) &&
    Array.isArray(d.wochenplaene) &&
    Array.isArray(d.abwesenheiten)
  );
}

/**
 * Brings an imported export file up to the current formatVersion by running the migrations in
 * sequence: v1 (pre-rename, German field names) -> v2 -> v3. Future versions add another
 * migrateVxToVy(data) step to the chain, before the data is written to Dexie.
 *
 * Only checks the top-level shape (formatVersion + the 4 data arrays exist and are arrays), not
 * every field of every record - deep per-record validation is out of scope (YAGNI, the file only
 * ever comes from this app's own export). Without even this shallow check, a malformed file would
 * previously reach `file.data.branches.map(...)` in dataExportService and throw a raw, unhelpful
 * TypeError instead of a clear German error message - and since the atomic import transaction rolls
 * back on any thrown error, no data is lost either way, but the error message matters for the user.
 */
export function migrateToCurrentVersion(rawData: unknown): PepExportFile {
  if (typeof rawData !== 'object' || rawData === null || !('formatVersion' in rawData)) {
    throw new DomainError('Die Datei enthält kein gültiges PEP-Exportformat.');
  }

  const rawFile = rawData as { formatVersion: unknown };

  if (typeof rawFile.formatVersion !== 'number') {
    throw new DomainError('Die Datei enthält kein gültiges PEP-Exportformat.');
  }

  if (rawFile.formatVersion === 1) {
    const fileV1 = rawData as unknown as { exportiertAm: unknown; daten: unknown };
    if (typeof fileV1.exportiertAm !== 'string' || !isValidV1DataStructure(fileV1.daten)) {
      throw new DomainError('Die Datei enthält kein gültiges PEP-Exportformat (fehlende oder beschädigte Datenfelder).');
    }
    return migrateV2ToV3(migrateV1ToV2(rawData as PepExportFileV1));
  }

  if (rawFile.formatVersion > CURRENT_FORMAT_VERSION) {
    throw new DomainError(
      `Diese Datei wurde mit einer neueren App-Version exportiert (Format ${rawFile.formatVersion}) und kann von dieser Version nicht importiert werden.`,
    );
  }

  const file = rawData as PepExportFile;

  if (!isValidDataStructure(file.data)) {
    throw new DomainError('Die Datei enthält kein gültiges PEP-Exportformat (fehlende oder beschädigte Datenfelder).');
  }

  // v2 and v3 share the same top-level shape, so the check above covers both.
  if (rawFile.formatVersion === 2) {
    return migrateV2ToV3(rawData as unknown as PepExportFileV2);
  }

  return file;
}
