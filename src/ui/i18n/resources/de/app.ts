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
} as const;

export default app;
