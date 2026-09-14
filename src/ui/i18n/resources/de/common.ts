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
  formErrorNotice: 'Bitte die rot markierten Felder prüfen.',
  secondaryActions: 'Weitere Aktionen',
} as const;

export default common;
