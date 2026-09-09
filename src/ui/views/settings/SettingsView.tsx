import { useEffect, useRef, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import Paper from '@mui/material/Paper';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import Divider from '@mui/material/Divider';
import Link from '@mui/material/Link';
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined';
import UploadOutlinedIcon from '@mui/icons-material/UploadOutlined';
import DeleteForeverOutlinedIcon from '@mui/icons-material/DeleteForeverOutlined';
import InstallMobileOutlinedIcon from '@mui/icons-material/InstallMobileOutlined';
import CircularProgress from '@mui/material/CircularProgress';
import Backdrop from '@mui/material/Backdrop';
import { services } from '@infrastructure/services';
import { notify } from '@ui/app/store/notificationStore';
import {
  requestPersistentStorage,
  storageDurability,
  storageUsage,
  type StorageDurability,
  type StorageUsage,
} from '@infrastructure/persistence/storagePersistence';
import { useOnlineStatus } from '@ui/hooks/useOnlineStatus';
import { useInstallPrompt } from '@ui/hooks/useInstallPrompt';
import { isManualInstallPlatform, isStandalone, promptInstall } from '@ui/app/installPrompt';
import { downloadFile, backupFilename, readDataFile } from '@infrastructure/export/fileAccess';
import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined';
import CloudDownloadOutlinedIcon from '@mui/icons-material/CloudDownloadOutlined';
import type { RemoteBackup } from '@application/ports/BackupStorage';
import { ConfirmDialog } from '@ui/components/ConfirmDialog';
import { DriveBackupDialog } from './DriveBackupDialog';
import { APP_BUILD_TIME, APP_COMMIT, APP_VERSION } from '@ui/app/buildInfo';

export function SettingsView() {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [confirmationText, setConfirmationText] = useState('');
  const [importFile, setImportFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [driveSignedIn, setDriveSignedIn] = useState(services.backupStorage.isSignedIn());
  const [driveBusy, setDriveBusy] = useState(false);
  const [drivePickerOpen, setDrivePickerOpen] = useState(false);
  const driveAvailable = services.backupStorage.isConfigured();
  // The token lives in memory only (see infrastructure/backup/googleIdentity.ts), so every reload
  // starts signed out - including the one this very page triggers after an import. Renewing it
  // silently here is what keeps the user from having to sign in again right after restoring a
  // backup. Only "this user uses Drive" was remembered, never the token itself.
  const [driveRestoring, setDriveRestoring] = useState(
    () => driveAvailable && !services.backupStorage.isSignedIn() && services.backupStorage.wasConnected(),
  );
  // Whether the app still remembers this as a Drive user. Kept separately from driveSignedIn so the
  // signed-out fallback can still offer a way out - otherwise someone who connected once and then
  // let the authorisation lapse would have the Google script fetched on every single page load with
  // no button anywhere to stop it.
  const [driveRemembered, setDriveRemembered] = useState(() => services.backupStorage.wasConnected());
  const online = useOnlineStatus();
  const installable = useInstallPrompt();
  const [durability, setDurability] = useState<StorageDurability>('unsupported');
  const [usage, setUsage] = useState<StorageUsage | null>(null);
  const [installed] = useState(() => isStandalone());
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [askingStorage, setAskingStorage] = useState(false);
  // Covers the screen for the last moment before window.location.reload(), so the 1200 ms are a
  // readable "this worked, hold on" instead of a page that just sits there and then jumps.
  const [reloadingText, setReloadingText] = useState<string | null>(null);

  useEffect(() => {
    void storageDurability().then(setDurability);
    void storageUsage().then(setUsage);
  }, []);

  const askForDurableStorage = async () => {
    setAskingStorage(true);
    try {
      const result = await requestPersistentStorage();
      setDurability(result);
      if (result === 'persistent') {
        notify.success('Der Browser bewahrt die Daten dieser App jetzt dauerhaft auf.');
      } else {
        notify.error(
          'Der Browser hat den dauerhaften Speicher nicht gewährt. Installiere die App auf dem Startbildschirm, das genügt den meisten Browsern als Nachweis.',
        );
      }
    } catch (error) {
      notify.report(error, 'Der dauerhafte Speicher konnte nicht angefragt werden');
    } finally {
      setAskingStorage(false);
    }
  };

  useEffect(() => {
    // Ohne Netz wuerde das Google-Skript ins Leere laufen und die Anzeige landete bei "Melde dich
    // einmal neu an", was offline unmoeglich ist. driveRestoring bleibt der Wiederholungsschutz -
    // es geht nur einmal von true auf false -, also ist ein erneuter Lauf beim Wiederverbinden
    // genau der gewuenschte zweite Versuch.
    if (!driveRestoring || !online) {
      return;
    }
    let cancelled = false;
    void services.backupStorage
      .restoreSession()
      .catch(() => false)
      .then((restored) => {
        if (cancelled) {
          return;
        }
        setDriveSignedIn(restored);
        setDriveRestoring(false);
      });
    return () => {
      cancelled = true;
    };
  }, [driveRestoring, online]);

  const reportDriveError = (error: unknown, fallback: string) =>
    notify.error(error instanceof Error ? error.message : fallback);

  const connectDrive = async () => {
    setDriveBusy(true);
    try {
      await services.backupStorage.signIn();
      setDriveSignedIn(true);
      setDriveRemembered(true);
      notify.success('Mit Google verbunden.');
    } catch (error) {
      reportDriveError(error, 'Die Anmeldung bei Google ist fehlgeschlagen.');
    } finally {
      setDriveBusy(false);
    }
  };

  const disconnectDrive = () => {
    services.backupStorage.signOut();
    setDriveSignedIn(false);
    setDriveRemembered(false);
    notify.success('Verbindung zu Google getrennt.');
  };

  const exportToDrive = async () => {
    setDriveBusy(true);
    try {
      const file = await services.dataExport.export();
      const saved = await services.backupStorage.upload(backupFilename(), file);
      notify.success(`„${saved.name}“ wurde in Google Drive gesichert.`);
    } catch (error) {
      reportDriveError(error, 'Die Sicherung in Google Drive ist fehlgeschlagen.');
    } finally {
      setDriveBusy(false);
    }
  };

  /** Downloads the chosen backup and routes it into the SAME confirmation and import path the
   * local file uses, so there is only one place that replaces the dataset. */
  const chooseDriveBackup = async (backup: RemoteBackup) => {
    // The picker deliberately stays open during the download - it is the only thing on screen that
    // can show the wait. Closing first, as this did, left the user in front of an unchanged page.
    setDriveBusy(true);
    try {
      const rawData = await services.backupStorage.download(backup.id);
      setDrivePickerOpen(false);
      setImportFile(new File([JSON.stringify(rawData)], backup.name, { type: 'application/json' }));
    } catch (error) {
      reportDriveError(error, 'Die Sicherung konnte nicht geladen werden.');
    } finally {
      setDriveBusy(false);
    }
  };


  const exportData = async () => {
    setExporting(true);
    try {
      const file = await services.dataExport.export();
      downloadFile(backupFilename(), file);
      notify.success('Backup wurde heruntergeladen.');
    } catch (error) {
      notify.report(error, 'Der Export ist fehlgeschlagen');
    } finally {
      setExporting(false);
    }
  };

  const closeImportDialog = () => {
    setImportFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const performImport = async () => {
    const file = importFile;
    if (!file) return;
    // Set AFTER the guard: a busy dialog whose onClose is short-circuited, entered by an action that
    // returned early, would have no way out at all.
    setImporting(true);
    try {
      const rawData = await readDataFile(file);
      await services.dataExport.importAndReplace(rawData);
      // Close first, then cover the screen: a Backdrop and an open Dialog would fight over z-index.
      closeImportDialog();
      setReloadingText('Import abgeschlossen. Die App wird neu geladen…');
      setTimeout(() => window.location.reload(), 1200);
    } catch (error) {
      closeImportDialog();
      notify.error(error instanceof Error ? error.message : 'Import fehlgeschlagen.');
    } finally {
      setImporting(false);
    }
  };

  const closeDeleteDialog = () => {
    setDeleteDialogOpen(false);
    // Otherwise the typed confirmation would still be there the next time the dialog opens.
    setConfirmationText('');
  };

  const deleteAllData = async () => {
    if (confirmationText !== 'LÖSCHEN') return;
    setDeleting(true);
    try {
      await services.dataExport.deleteAllData();
      closeDeleteDialog();
      setReloadingText('Alle Daten wurden gelöscht. Die App wird neu geladen…');
      setTimeout(() => window.location.reload(), 1200);
    } catch (error) {
      notify.report(error, 'Die Daten konnten nicht gelöscht werden');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 640 }}>
      <Typography variant="h5" fontWeight={500} sx={{ mb: 3 }}>
        Einstellungen
      </Typography>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="subtitle1" fontWeight={500} sx={{ mb: 1 }}>
          Backup & Datenübertragung
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Alle Daten liegen ausschließlich lokal in diesem Browser. Für ein Backup oder einen Geräte-/Browserwechsel
          exportiere den kompletten Datenbestand als Datei und importiere ihn auf dem anderen Gerät wieder.
        </Typography>
        <Stack direction="row" spacing={2}>
          <Button
            variant="outlined"
            startIcon={exporting ? <CircularProgress size={16} color="inherit" /> : <DownloadOutlinedIcon />}
            onClick={exportData}
            disabled={exporting}
          >
            {exporting ? 'Export wird erstellt…' : 'Daten exportieren'}
          </Button>
          <Button variant="outlined" component="label" startIcon={<UploadOutlinedIcon />}>
            Daten importieren
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json"
              hidden
              onChange={(e) => setImportFile(e.target.files?.[0] ?? null)}
            />
          </Button>
        </Stack>

        {driveAvailable && (
          <>
            <Divider sx={{ my: 3 }} />
            <Typography variant="subtitle1" fontWeight={500} sx={{ mb: 1 }}>
              Google Drive
            </Typography>
            {!online && (
              <Alert severity="info" sx={{ mb: 2 }}>
                Ohne Internetverbindung ist Google Drive nicht erreichbar. Alles andere in dieser App
                funktioniert weiter, auch der Export als Datei.
              </Alert>
            )}
            {driveRestoring ? (
              <Typography variant="body2" color="text.secondary">
                Verbindung zu Google wird wiederhergestellt…
              </Typography>
            ) : driveSignedIn ? (
              <>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Sicherungen liegen in deinem Google Drive im Ordner „Personaleinsatzplanung“. Unter „Aus Google Drive laden“ kannst du sie auch löschen. Der Zugriff wird
                  aus Sicherheitsgründen nicht gespeichert, sondern bei Bedarf still erneuert, solange du bei
                  Google angemeldet bist.
                </Typography>
                <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
                  <Button
                    variant="outlined"
                    startIcon={driveBusy ? <CircularProgress size={16} color="inherit" /> : <CloudUploadOutlinedIcon />}
                    onClick={exportToDrive}
                    disabled={driveBusy || !online}
                  >
                    {driveBusy ? 'Wird gesichert…' : 'In Google Drive sichern'}
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<CloudDownloadOutlinedIcon />}
                    onClick={() => setDrivePickerOpen(true)}
                    disabled={driveBusy || !online}
                  >
                    Aus Google Drive laden
                  </Button>
                  <Button onClick={disconnectDrive} disabled={driveBusy}>
                    Verbindung trennen
                  </Button>
                </Stack>
              </>
            ) : (
              <>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {driveRemembered
                    ? 'Google konnte den Zugriff nicht ohne Nachfrage erneuern. Melde dich einmal neu an, dann geht es wie gewohnt weiter. Willst du Google Drive gar nicht mehr nutzen, trenne die Verbindung: Danach nimmt die App von sich aus keine Verbindung mehr zu Google auf.'
                    : 'Statt einer Datei kannst du dein Backup auch in deinem eigenen Google Drive ablegen und es auf einem anderen Gerät von dort laden. Erst beim Klick auf „Mit Google anmelden“ nimmt die App Verbindung zu Google auf. Die App sieht dabei ausschließlich die Sicherungen, die sie selbst angelegt hat.'}
                </Typography>
                <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
                  <Button
                    variant="outlined"
                    onClick={connectDrive}
                    disabled={driveBusy || !online}
                    startIcon={driveBusy ? <CircularProgress size={16} color="inherit" /> : undefined}
                  >
                    {driveBusy ? 'Anmeldung läuft…' : 'Mit Google anmelden'}
                  </Button>
                  {driveRemembered && (
                    <Button onClick={disconnectDrive} disabled={driveBusy}>
                      Google Drive nicht mehr verwenden
                    </Button>
                  )}
                </Stack>
              </>
            )}
          </>
        )}
      </Paper>


      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="subtitle1" fontWeight={500} sx={{ mb: 1 }}>
          App & Speicher
        </Typography>

        {installed ? (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Die App ist auf diesem Gerät installiert. Sie startet vom Startbildschirm aus und funktioniert auch
            ohne Internetverbindung.
          </Typography>
        ) : (
          <>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Du kannst die Planung als App auf dem Gerät installieren. Sie startet dann ohne Browserleiste, ist
              über ein eigenes Symbol erreichbar und funktioniert vollständig ohne Internetverbindung.
              {isManualInstallPlatform() && !installable
                ? ' Auf iPhone und iPad geht das über Safari: unten auf das Teilen-Symbol tippen und „Zum Home-Bildschirm“ wählen.'
                : ''}
            </Typography>
            {installable && (
              <Button
                variant="outlined"
                startIcon={<InstallMobileOutlinedIcon />}
                onClick={() => void promptInstall()}
                sx={{ mb: 2 }}
              >
                App installieren
              </Button>
            )}
          </>
        )}

        <Divider sx={{ my: 2 }} />

        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          Dauerhafter Speicher:{' '}
          {durability === 'persistent'
            ? 'Ja. Der Browser bewahrt die Daten dieser App auf.'
            : durability === 'best-effort'
              ? 'Nein. Der Browser darf die Daten löschen, wenn der Speicher knapp wird.'
              : 'Vom Browser nicht unterstützt.'}
          {usage &&
            ` Belegt: ${Math.max(1, Math.round(usage.usedBytes / 1024)).toLocaleString('de-DE')} KB.`}
        </Typography>
        {durability === 'best-effort' && (
          <>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Das ist wichtiger, als es klingt: Die Daten dieser App liegen nur auf diesem Gerät. Auf iPhone und
              iPad räumt Safari den Speicher gewöhnlicher Webseiten nach sieben Tagen ohne Besuch weg,
              installierte Apps sind davon ausgenommen. Erstelle unabhängig davon regelmäßig ein Backup.
            </Typography>
            <Button
              variant="outlined"
              onClick={askForDurableStorage}
              disabled={askingStorage}
              startIcon={askingStorage ? <CircularProgress size={16} color="inherit" /> : undefined}
            >
              Dauerhaften Speicher anfordern
            </Button>
          </>
        )}
      </Paper>
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="subtitle1" fontWeight={500} sx={{ mb: 1 }}>
          Datenschutz
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          Informationen dazu, welche Daten wo gespeichert werden, findest du in den{' '}
          <Link component={RouterLink} to="/privacy">
            Datenschutzhinweisen
          </Link>
          .
        </Typography>
      </Paper>

      <Paper sx={{ p: 3, borderColor: '#e5a3a0' }}>
        <Typography variant="subtitle1" fontWeight={500} sx={{ mb: 1 }}>
          Alle Daten löschen
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Entfernt unwiderruflich alle Filialen, Mitarbeiter, Wochenpläne, Abwesenheiten und Schichtvorlagen aus
          diesem Browser.
          Erstelle vorher ein Backup, falls du die Daten noch benötigst.
        </Typography>
        <Button
          variant="outlined"
          color="error"
          startIcon={<DeleteForeverOutlinedIcon />}
          onClick={() => setDeleteDialogOpen(true)}
        >
          Alle Daten löschen
        </Button>
      </Paper>

      <Paper sx={{ p: 3, mt: 3 }}>
        <Typography variant="subtitle1" fontWeight={500} sx={{ mb: 1 }}>
          Version
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Kennung des installierten Stands. Sie steht auch klein unten rechts in der Ecke, damit sie auf
          Screenshots mitkommt. Bei einer Rückfrage bitte diese Angaben mitschicken.
        </Typography>
        {/* data-selectable zusaetzlich zu userSelect: Es haelt auch das native Rechtsklick-Menue
            offen, das sonst app-weit unterdrueckt wird - und "Kopieren" per Rechtsklick ist genau
            der Griff, zu dem der Satz darueber auffordert. */}
        <Stack
          data-selectable
          spacing={0.5}
          sx={{ fontFamily: 'monospace', fontSize: 14, userSelect: 'all' }}
        >
          <span>Version: {APP_VERSION}</span>
          {/* The raw ISO timestamp on purpose: unambiguous, time-zone free, and it sidesteps the
              German date-format rules that apply to user-facing dates. */}
          <span>Build: {APP_BUILD_TIME}</span>
          <span>Commit: {APP_COMMIT || '-'}</span>
        </Stack>
      </Paper>

      {/* onClose short-circuited while deleting: Escape or a click on the backdrop would otherwise
          tear the dialog down in the middle of wiping the database. */}
      <Dialog open={deleteDialogOpen} onClose={deleting ? undefined : closeDeleteDialog}>
        <DialogTitle>Alle Daten wirklich löschen?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Dieser Vorgang kann nicht rückgängig gemacht werden. Tippe zur Bestätigung <strong>LÖSCHEN</strong> ein.
          </Typography>
          <TextField
            fullWidth
            value={confirmationText}
            onChange={(e) => setConfirmationText(e.target.value)}
            placeholder="LÖSCHEN"
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={closeDeleteDialog} disabled={deleting}>
            Abbrechen
          </Button>
          <Button
            variant="contained"
            color="error"
            disabled={confirmationText !== 'LÖSCHEN' || deleting}
            onClick={deleteAllData}
            startIcon={deleting ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            Endgültig löschen
          </Button>
        </DialogActions>
      </Dialog>

      {drivePickerOpen && (
        <DriveBackupDialog
          busy={driveBusy}
          onClose={() => setDrivePickerOpen(false)}
          onSelect={chooseDriveBackup}
          onError={notify.report}
        />
      )}

      <ConfirmDialog
        open={!!importFile}
        title="Daten importieren?"
        text="Der komplette lokale Datenbestand wird durch den Inhalt dieser Datei ersetzt. Dieser Vorgang kann nicht rückgängig gemacht werden."
        confirmText="Importieren"
        dangerous
        busy={importing}
        onConfirm={performImport}
        onCancel={closeImportDialog}
      />

      {/* modal + 1, not drawer + 1: a standalone Backdrop has no z-index of its own and would
          otherwise sit behind the dialog that just closed, while its exit transition still runs. */}
      <Backdrop open={reloadingText !== null} sx={{ zIndex: (t) => t.zIndex.modal + 1, color: '#fff' }}>
        <Stack spacing={2} alignItems="center">
          <CircularProgress color="inherit" />
          <Typography variant="body2">{reloadingText}</Typography>
        </Stack>
      </Backdrop>
    </Box>
  );
}
