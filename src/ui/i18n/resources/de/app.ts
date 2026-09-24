/** App-chrome copy specific to AppHeader/UpdatePrompt/InstallPromptBanner - not reused elsewhere,
 * unlike `common`. */
const app = {
  branchSelect: 'Filiale auswählen',
  updateAvailable: 'Version {{version}} ist verfügbar.',
  updateLater: 'Später',
  updateNow: 'Jetzt laden',
  viewChanges: 'Änderungen ansehen',
  installAvailable: 'Diese App kann installiert werden.',
  installLater: 'Nicht jetzt',
  notFoundTitle: 'Seite nicht gefunden',
  notFoundText: 'Diese Adresse gibt es in der App nicht.',
  notFoundAction: 'Zur Wochenplanung',
  errorTitle: 'Etwas ist schiefgelaufen',
  errorText: 'Beim Anzeigen dieser Seite ist ein Fehler aufgetreten.',
  errorAction: 'Neu laden',
} as const;

export default app;
