/** German copy for navItems.ts's NavItem.label/shortLabel keys - this file's key set IS the
 * NavKey union those fields are typed against. */
const nav = {
  schedule: 'Wochenplanung',
  scheduleShort: 'Woche',
  month: 'Monatsübersicht',
  monthShort: 'Monat',
  employees: 'Mitarbeiter',
  employeesShort: 'Team',
  absences: 'Abwesenheiten',
  absencesShort: 'Abwesend',
  branches: 'Filialen',
  changelog: 'Änderungen',
  privacy: 'Datenschutz',
  terms: 'Nutzungsbedingungen',
  settings: 'Einstellungen',
  more: 'Mehr',
  expandNavAriaLabel: 'Navigation ausklappen',
  collapseNavAriaLabel: 'Navigation einklappen',
  skipToContent: 'Zum Hauptinhalt springen',
} as const;

export default nav;
export type NavKey = keyof typeof nav;
