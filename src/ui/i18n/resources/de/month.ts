/** MonthOverviewView.tsx copy. MONTH_NAMES and every ValidationResult.message shown in the
 * per-week tooltip are domain-layer (out of scope, see ui/CLAUDE.md's i18n section). */
const month = {
  previousMonth: 'Vorheriger Monat',
  nextMonth: 'Nächster Monat',
  monthLabel: 'Monat',
  exportButton: 'Exportieren',
  infoCaption:
    'Zeigt je Kalenderwoche nur Tages-/Wochenprüfungen auf ArbZG-/JArbSchG-Verstöße; eine Ruhezeit-Prüfung über Wochengrenzen hinweg findet hier nicht statt.',
  loading: 'Wird geladen…',
  columnEmployee: 'Mitarbeiter',
  columnTargetWeekly: 'Soll/Woche',
  columnTotal: 'Gesamt Monat',
  weekPrefix: 'KW {{week}}',
  jumpToWeekAriaLabel: 'Zu Kalenderwoche {{week}} springen',
  weekActionsAriaLabel: 'Aktionen für Kalenderwoche {{week}}',
  noEntries: 'keine Einträge',
  emptyNoEmployees: 'Noch kein Mitarbeiter für diese Filiale angelegt.',
  hoursValue: '{{hours}} Std.',
  showHintAriaLabel: 'Hinweis anzeigen',
  monthlyLimitTooltip: '{{hours}} Std. diesen Monat, Grenze {{limit}} Std./Monat',
  monthlyLimitAriaLabel: 'Monatsgrenze überschritten anzeigen',
  exportError: 'Die Monatsübersicht konnte nicht exportiert werden',
} as const;

export default month;
