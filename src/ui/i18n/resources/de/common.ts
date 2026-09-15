/** Shared/reused UI copy with no single feature owner. Feature-specific strings belong in their
 * own namespace even when only one string lives there today. */
const common = {
  requiredLegend: '* Pflichtfeld',
  noBranchSelected: 'Bitte zuerst oben eine Filiale auswählen oder anlegen.',
  goToBranches: 'Zu den Filialen',
  confirm: 'Bestätigen',
  cancel: 'Abbrechen',
  close: 'Schließen',
  delete: 'Löschen',
  save: 'Speichern',
  edit: 'Bearbeiten',
  activate: 'Aktivieren',
  deactivate: 'Deaktivieren',
  active: 'Aktiv',
  inactive: 'Inaktiv',
  activatedNotice: '{{entityLabel}} wurde aktiviert.',
  deactivatedNotice: '{{entityLabel}} wurde deaktiviert.',
  statusChangeError: 'Status konnte nicht geändert werden',
  formErrorNotice: 'Bitte die rot markierten Felder prüfen.',
  secondaryActions: 'Weitere Aktionen',
  otherActionsFor: 'Weitere Aktionen für {{name}}',
  columnActions: 'Aktionen',
  yearLabel: 'Jahr',
  absenceKind: {
    vacation: 'Urlaub',
    illness: 'Krankheit',
    publicHoliday: 'Feiertag',
    other: 'Sonstige',
  },
} as const;

export default common;
