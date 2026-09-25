/** views/print - PrintPreviewView.tsx plus the two paper-form components (FullPartTimeForm.tsx,
 * MinijobForm.tsx, which share almost all of this file's keys byte-for-byte). PrintPageContent.tsx
 * has no copy of its own (pure layout/measurement). formatDateShort/formatHours (printFormat.ts)
 * are formatting functions, not translatable text, and stay untouched. */
const print = {
  loadingSchedule: 'Wochenplan wird geladen…',
  notFoundAlert: 'Wochenplan konnte nicht gefunden werden.',
  loadFailedAlert: 'Wochenplan konnte nicht geladen werden.',
  toScheduleButton: 'Zur Wochenplanung',
  backButton: 'Zurück',
  printButton: 'Drucken',

  plannedRevenueMeta: 'geplanter Wochenumsatz: {{value}}',
  plannedHoursMeta: 'geplante Wochenstunden: {{value}}',
  fullPartTimeTitle: 'Personaleinsatzplanung (PEP): Voll- und Teilzeitkräfte (Aufbewahrungsfrist: nur aktueller Monat)',
  minijobTitle: 'Personaleinsatzplanung (PEP): geringfügig Beschäftigte (Aufbewahrungsfrist: 2 Jahre)',
  logoAlt: 'Logo {{name}}',
  weekHeader: 'Woche: {{week}} / {{year}}',
  branchHeader: 'Filiale: {{number}} {{name}}',
  nameLabel: 'Name',
  jobTitleLabel: 'Tätigkeit',
  weeklyHoursLabel: 'Wochen-Std.',
  minHoursLabel: 'Min. Std.',
  maxHoursLabel: 'Max. Std.',
  targetHoursLabel: 'Soll-Std.',
  actualHoursLabel: 'Ist-Std.',
  timeLabel: 'Zeit',
  hoursLabel: 'Std.',
  breakLabel: 'Pause',
  totalWorkedLabel: 'Gesamtstunden (gearbeitet)',
  signatureMl: 'Unterschrift ML',
  signatureVl: 'Unterschrift VL',
  resetViewLabel: 'Ansicht zurücksetzen',
} as const;

export default print;
