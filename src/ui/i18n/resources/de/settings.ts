/** Covers SettingsView.tsx and its two dialogs (DriveBackupDialog.tsx, BackupPasswordDialog.tsx) -
 * kept as one namespace since all three only ever render as part of the Settings feature. One
 * exception: `appStorage.installButton` is also read by InstallPromptBanner.tsx (App.tsx's
 * proactive install banner), reusing the same label rather than duplicating it under a second
 * key. */
const settings = {
  appearance: {
    heading: 'Erscheinungsbild',
    modeLabel: 'Design',
    modeLight: 'Hell',
    modeDark: 'Dunkel',
    modeSystem: 'System',
  },
  backup: {
    heading: 'Backup & Datenübertragung',
    description:
      'Alle Daten liegen ausschließlich lokal in diesem Browser. Für ein Backup oder einen Geräte-/Browserwechsel exportiere den kompletten Datenbestand als Datei und importiere ihn auf dem anderen Gerät wieder.',
    exporting: 'Export wird erstellt…',
    exportButton: 'Daten exportieren',
    importButton: 'Daten importieren',
  },
  drive: {
    heading: 'Google Drive',
    offlineAlert:
      'Ohne Internetverbindung ist Google Drive nicht erreichbar. Alles andere in dieser App funktioniert weiter, auch der Export als Datei.',
    restoring: 'Verbindung zu Google wird wiederhergestellt…',
    signedInDescription:
      'Sicherungen liegen in deinem Google Drive im Ordner „Personaleinsatzplanung“. Unter „Aus Google Drive laden“ kannst du sie auch löschen. Der Zugriff wird aus Sicherheitsgründen nicht gespeichert, sondern bei Bedarf still erneuert, solange du bei Google angemeldet bist.',
    saving: 'Wird gesichert…',
    saveButton: 'In Google Drive sichern',
    loadButton: 'Aus Google Drive laden',
    disconnectButton: 'Verbindung trennen',
    rememberedDescription:
      'Google konnte den Zugriff nicht ohne Nachfrage erneuern. Melde dich einmal neu an, dann geht es wie gewohnt weiter. Willst du Google Drive gar nicht mehr nutzen, trenne die Verbindung: Danach nimmt die App von sich aus keine Verbindung mehr zu Google auf.',
    neverConnectedDescription:
      'Statt einer Datei kannst du dein Backup auch in deinem eigenen Google Drive ablegen und es auf einem anderen Gerät von dort laden. Erst beim Klick auf „Mit Google anmelden“ nimmt die App Verbindung zu Google auf. Die App sieht dabei ausschließlich die Sicherungen, die sie selbst angelegt hat.',
    signingIn: 'Anmeldung läuft…',
    signInButton: 'Mit Google anmelden',
    stopUsingButton: 'Google Drive nicht mehr verwenden',
  },
  password: {
    heading: 'Backup-Passwort',
    description:
      'Ist ein Passwort festgelegt, werden neue Backups (als Datei und in Google Drive) automatisch damit verschlüsselt. Ein geändertes Passwort wirkt sich nur auf zukünftige Backups aus - bereits erstellte Sicherungen benötigen weiterhin das Passwort, das zum Zeitpunkt ihrer Erstellung galt.',
    status: 'Status: {{status}}',
    statusSet: 'Festgelegt',
    statusNotSet: 'Nicht festgelegt',
    changeButton: 'Passwort ändern',
    // Also BackupPasswordDialog's own title in 'set' mode - identical wording, one key.
    setLabel: 'Backup-Passwort festlegen',
    removeButton: 'Passwort entfernen',
    requiredError: 'Bitte Passwort eingeben.',
    mismatchError: 'Passwörter stimmen nicht überein.',
    showPassword: 'Passwort anzeigen',
    hidePassword: 'Passwort verbergen',
    titleConfirm: 'Backup-Passwort bestätigen',
    titleEnter: 'Backup-Passwort eingeben',
    settingBusy: 'Wird festgelegt…',
    checkingBusy: 'Wird geprüft…',
    confirmSetButton: 'Festlegen',
    setWarning:
      'Wird dieses Passwort vergessen, lassen sich damit verschlüsselte Backups nicht mehr öffnen. Es gibt keine Möglichkeit, das Passwort zurückzusetzen oder die Daten ohne das Passwort wiederherzustellen. Bewahre es an einem sicheren Ort auf.',
    confirmInfo:
      'Bitte gib das Backup-Passwort erneut ein, um dieses Backup zu verschlüsseln. So fällt ein Tippfehler schon jetzt auf, statt erst bei einem späteren Wiederherstellungsversuch.',
    passwordLabel: 'Passwort',
    confirmPasswordLabel: 'Passwort bestätigen',
  },
  appStorage: {
    heading: 'App & Speicher',
    installedDescription:
      'Die App ist auf diesem Gerät installiert. Sie startet vom Startbildschirm aus und funktioniert auch ohne Internetverbindung.',
    notInstalledDescription:
      'Du kannst die Planung als App auf dem Gerät installieren. Sie startet dann ohne Browserleiste, ist über ein eigenes Symbol erreichbar und funktioniert vollständig ohne Internetverbindung.',
    iosInstallHint:
      ' Auf iPhone und iPad geht das über Safari: unten auf das Teilen-Symbol tippen und „Zum Home-Bildschirm“ wählen.',
    unsupportedInstallHint: ' In diesem Browser ist das nicht möglich - probiere es mit Chrome oder Edge.',
    installButton: 'App installieren',
    durableStorageLabel: 'Dauerhafter Speicher:',
    durablePersistent: 'Ja. Der Browser bewahrt die Daten dieser App auf.',
    durableBestEffort: 'Nein. Der Browser darf die Daten löschen, wenn der Speicher knapp wird.',
    durableUnsupported: 'Vom Browser nicht unterstützt.',
    usageSuffix: ' Belegt: {{kb}} KB.',
    bestEffortWarning:
      'Das ist wichtiger, als es klingt: Die Daten dieser App liegen nur auf diesem Gerät. Auf iPhone und iPad räumt Safari den Speicher gewöhnlicher Webseiten nach sieben Tagen ohne Besuch weg, installierte Apps sind davon ausgenommen. Erstelle unabhängig davon regelmäßig ein Backup.',
    requestDurableButton: 'Dauerhaften Speicher anfordern',
  },
  legal: {
    // Matches nav.privacy exactly ('Datenschutz') - kept as its own key anyway since this heading
    // covers two unrelated paragraphs (privacy AND terms links), not just the privacy one.
    heading: 'Datenschutz',
    privacyIntro: 'Informationen dazu, welche Daten wo gespeichert werden, findest du in den',
    // Dative-plural form ("...in den Datenschutzhinweisen") - grammatically different from
    // privacy.heading's nominative "Datenschutzhinweise", so it stays its own key.
    privacyLinkText: 'Datenschutzhinweisen',
    termsIntro: 'Die Regeln zur Nutzung der App stehen in den',
  },
  dangerZone: {
    heading: 'Alle Daten löschen',
    description:
      'Entfernt unwiderruflich alle Filialen, Mitarbeiter, Wochenpläne, Abwesenheiten und Schichtvorlagen aus diesem Browser. Erstelle vorher ein Backup, falls du die Daten noch benötigst.',
    dialogTitle: 'Alle Daten wirklich löschen?',
    dialogBodyPrefix: 'Dieser Vorgang kann nicht rückgängig gemacht werden. Tippe zur Bestätigung',
    dialogBodySuffix: 'ein.',
    confirmWord: 'LÖSCHEN',
    confirmLabel: 'Bestätigung',
    confirmDeleteButton: 'Endgültig löschen',
  },
  version: {
    heading: 'Version',
    description:
      'Kennung des installierten Stands. Sie steht auch klein unten rechts in der Ecke, damit sie auf Screenshots mitkommt. Bei einer Rückfrage bitte diese Angaben mitschicken.',
    versionLabel: 'Version:',
    buildLabel: 'Build:',
    commitLabel: 'Commit:',
  },
  importDialog: {
    title: 'Daten importieren?',
    text: 'Der komplette lokale Datenbestand wird durch den Inhalt dieser Datei ersetzt. Dieser Vorgang kann nicht rückgängig gemacht werden.',
    confirmButton: 'Importieren',
  },
  notify: {
    persistentGranted: 'Der Browser bewahrt die Daten dieser App jetzt dauerhaft auf.',
    persistentDenied:
      'Der Browser hat den dauerhaften Speicher nicht gewährt. Installiere die App auf dem Startbildschirm, das genügt den meisten Browsern als Nachweis.',
    persistentError: 'Der dauerhafte Speicher konnte nicht angefragt werden',
    driveConnected: 'Mit Google verbunden.',
    driveConnectFailed: 'Die Anmeldung bei Google ist fehlgeschlagen.',
    driveDisconnected: 'Verbindung zu Google getrennt.',
    passwordRemoved: 'Backup-Passwort wurde entfernt.',
    passwordSet: 'Backup-Passwort wurde festgelegt.',
    driveBackupSaved: '„{{name}}“ wurde in Google Drive gesichert.',
    driveBackupFailed: 'Die Sicherung in Google Drive ist fehlgeschlagen.',
    driveLoadFailed: 'Die Sicherung konnte nicht geladen werden.',
    localBackupSaved: 'Backup wurde heruntergeladen.',
    exportFailed: 'Der Export ist fehlgeschlagen',
    importCompleteReloading: 'Import abgeschlossen. Die App wird neu geladen…',
    importFailed: 'Import fehlgeschlagen.',
    allDataDeletedReloading: 'Alle Daten wurden gelöscht. Die App wird neu geladen…',
    deleteFailed: 'Die Daten konnten nicht gelöscht werden',
  },
  driveBackupDialog: {
    loadFailedFallback: 'Die Sicherungen konnten nicht geladen werden.',
    deleteError: 'Die Sicherung konnte nicht gelöscht werden',
    title: 'Sicherung aus Google Drive laden oder löschen',
    loadingOne: 'Sicherung wird geladen…',
    loadingMany: 'Sicherungen werden geladen…',
    empty: 'In Google Drive liegt keine Sicherung. Lege über „In Google Drive sichern“ eine an.',
    deleteAriaLabel: '{{name}} löschen',
    deleteConfirmTitle: 'Sicherung löschen?',
    deleteConfirmText:
      '„{{name}}“ wird in den Papierkorb von Google Drive verschoben und dort nach 30 Tagen endgültig gelöscht. Die Daten in dieser App bleiben unverändert.',
    subtitleSavedAt: 'Gesichert am {{date}}',
    subtitleSizeKb: '{{kb}} KB',
  },
} as const;

export default settings;
