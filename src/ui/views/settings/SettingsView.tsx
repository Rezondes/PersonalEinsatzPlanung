import { useEffect, useRef, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import Paper from '@mui/material/Paper';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import TextField from '@mui/material/TextField';
import Divider from '@mui/material/Divider';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import ButtonBase from '@mui/material/ButtonBase';
import Link from '@mui/material/Link';
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined';
import UploadOutlinedIcon from '@mui/icons-material/UploadOutlined';
import DeleteForeverOutlinedIcon from '@mui/icons-material/DeleteForeverOutlined';
import InstallMobileOutlinedIcon from '@mui/icons-material/InstallMobileOutlined';
import CheckIcon from '@mui/icons-material/Check';
import CircularProgress from '@mui/material/CircularProgress';
import Backdrop from '@mui/material/Backdrop';
import { useTranslation } from 'react-i18next';
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
import VpnKeyOutlinedIcon from '@mui/icons-material/VpnKeyOutlined';
import type { RemoteBackup } from '@application/ports/BackupStorage';
import { useBreakpoint } from '@ui/hooks/useBreakpoint';
import { useThemeModeStore } from '@ui/app/store/themeModeStore';
import { useAccentColorStore } from '@ui/app/store/accentColorStore';
import { ACCENT_COLORS } from '@ui/app/theme/accentColors';
import type { AccentColorKey } from '@ui/app/theme/accentColors';
import { usePageActions } from '@ui/app/PageActionsContext';
import { ConfirmDialog } from '@ui/components/ConfirmDialog';
import { ResponsiveDialog } from '@ui/components/ResponsiveDialog';
import { useLocale } from '@ui/app/locale/useLocale';
import { buildLocalizedPath } from '@ui/app/locale/locale';
import { DriveBackupDialog } from './DriveBackupDialog';
import { BackupPasswordDialog } from './BackupPasswordDialog';
import { APP_BUILD_TIME, APP_COMMIT, APP_VERSION } from '@ui/app/buildInfo';
import {
  isBackupPasswordConfigured,
  setBackupPasswordConfigured,
  getCachedPassword,
  setCachedPassword,
} from '@infrastructure/backup/backupPasswordSession';
import { encryptBackup, decryptBackup, WrongPasswordError } from '@infrastructure/export/backupEncryption';
import { DriveSessionExpiredError, markSilentRestorePending, consumeSilentRestorePending } from '@infrastructure/backup/GoogleDriveBackupStorage';
import { isEncryptedBackupEnvelope } from '@application/export/encryptedExportFormat';
import type { EncryptedBackupEnvelope } from '@application/export/encryptedExportFormat';

/** Signals that the user cancelled an obligatory password prompt (backup encryption configured but
 * not cached this session) rather than a real export failure - thrown by getOrPromptPassword so
 * exportData/exportToDrive can bail out silently instead of showing an error notification for what
 * was a deliberate cancel. */
class PasswordPromptCancelled extends Error {}

// Fixed left-to-right order for the accent-color radiogroup below - also the wrap-around order for
// its arrow-key navigation, so visual order and keyboard order always agree.
const ACCENT_COLOR_ORDER: AccentColorKey[] = ['gruen', 'blau', 'lila', 'orange', 'petrol', 'senfgelb'];
// `as const` (not a `Record<AccentColorKey, string>` annotation) keeps each value its own string
// literal type instead of widening to `string` - t() only accepts its known literal translation
// keys, and ACCENT_COLOR_LABEL_KEY[key] must stay one of those, not a generic string.
const ACCENT_COLOR_LABEL_KEY = {
  gruen: 'appearance.accentGruen',
  blau: 'appearance.accentBlau',
  lila: 'appearance.accentLila',
  orange: 'appearance.accentOrange',
  petrol: 'appearance.accentPetrol',
  senfgelb: 'appearance.accentSenfgelb',
} as const satisfies Record<AccentColorKey, string>;

export function SettingsView() {
  const layout = useBreakpoint();
  const locale = useLocale();
  const { t } = useTranslation('settings');
  const { t: tCommon } = useTranslation();
  const { t: tNav } = useTranslation('nav');
  const themeMode = useThemeModeStore((s) => s.mode);
  const setThemeMode = useThemeModeStore((s) => s.setMode);
  const accentColor = useAccentColorStore((s) => s.accentColor);
  const setAccentColor = useAccentColorStore((s) => s.setAccentColor);
  const accentButtonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  usePageActions({ fullBleedPage: true });
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [confirmationText, setConfirmationText] = useState('');
  const [importFile, setImportFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [driveSignedIn, setDriveSignedIn] = useState(services.backupStorage.isSignedIn());
  const [driveBusy, setDriveBusy] = useState(false);
  const [drivePickerOpen, setDrivePickerOpen] = useState(false);
  const driveAvailable = services.backupStorage.isConfigured();
  // The token lives in memory only (see infrastructure/backup/googleIdentity.ts), so every reload
  // starts signed out - including the one finishImport() triggers after an import. Renewing it
  // silently here is what keeps the user from having to sign in again right after restoring a
  // backup - but ONLY right after that specific, self-triggered reload, never on an independent
  // reopening of the app: consumeSilentRestorePending() is read (and cleared) unconditionally,
  // first, as its own step, not as the last link of the && chain - otherwise a marker left over
  // from an import that happened without ever being connected to Drive would stay unconsumed and
  // later "arm" an unrelated manual refresh once the user does connect within the same tab.
  const [driveRestoring, setDriveRestoring] = useState(() => {
    const justReloadedForRestore = consumeSilentRestorePending();
    return (
      driveAvailable && !services.backupStorage.isSignedIn() && services.backupStorage.wasConnected() && justReloadedForRestore
    );
  });
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

  // 'set': the user is defining/changing the password. 'enterForExport': the password is
  // configured but not cached this session and an export needs it - rendered via the dialog's
  // 'confirm' mode (two fields, must match) since the app never stores the actual password and so
  // has no other way to catch a re-entry typo before it silently produces an unreadable backup.
  // 'enterForImport': an encrypted backup file was chosen and needs decrypting, rendered via the
  // dialog's single-field 'enter' mode. All three share one BackupPasswordDialog mount - exactly
  // one can be open at a time - so they can never disagree about what the confirm button does.
  const [passwordDialogMode, setPasswordDialogMode] = useState<'set' | 'enterForExport' | 'enterForImport' | null>(
    null,
  );
  const [passwordConfigured, setPasswordConfigured] = useState(() => isBackupPasswordConfigured());
  const [passwordDialogBusy, setPasswordDialogBusy] = useState(false);
  // 'enterForImport' only: sees a value after a wrong-password attempt so the dialog can show it
  // inline without closing.
  const [passwordDialogError, setPasswordDialogError] = useState<string | null>(null);
  // 'enterForImport' only: the envelope to decrypt once the dialog resolves. Kept in state (not
  // read again from the file) so a wrong-password retry never has to touch the file input again.
  const [pendingImportEnvelope, setPendingImportEnvelope] = useState<EncryptedBackupEnvelope | null>(null);
  // 'enterForExport' only: resolves the Promise getOrPromptPassword() is awaiting. A ref, not
  // state, because the function itself must never trigger a re-render.
  const exportPasswordResolveRef = useRef<((password: string | null) => void) | null>(null);

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
        notify.success(t('notify.persistentGranted'));
      } else {
        notify.error(t('notify.persistentDenied'));
      }
    } catch (error) {
      notify.report(error, t('notify.persistentError'));
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

  const reportDriveError = (error: unknown, fallback: string) => {
    // A DriveSessionExpiredError means the token refresh itself failed, i.e. the session is truly
    // gone, not just this one request - without this, the UI would keep showing the "signed in"
    // buttons for a connection that no longer works until the next full reload.
    if (error instanceof DriveSessionExpiredError) {
      setDriveSignedIn(false);
    }
    notify.error(error instanceof Error ? error.message : fallback);
  };

  const connectDrive = async () => {
    setDriveBusy(true);
    try {
      await services.backupStorage.signIn();
      setDriveSignedIn(true);
      setDriveRemembered(true);
      notify.success(t('notify.driveConnected'));
    } catch (error) {
      reportDriveError(error, t('notify.driveConnectFailed'));
    } finally {
      setDriveBusy(false);
    }
  };

  const disconnectDrive = () => {
    services.backupStorage.signOut();
    setDriveSignedIn(false);
    setDriveRemembered(false);
    notify.success(t('notify.driveDisconnected'));
  };

  /** Mirrors disconnectDrive()'s shape: setBackupPasswordConfigured(false) existed already but was
   * only ever called from a test, never from production code - a forgotten password left the app
   * permanently asking for it before every export/import with no way out (H9). */
  const removeBackupPassword = () => {
    setCachedPassword(null);
    setBackupPasswordConfigured(false);
    setPasswordConfigured(false);
    notify.success(t('notify.passwordRemoved'));
  };

  /**
   * Resolves to the password to encrypt a fresh export with, or `null` when encryption is off.
   * Both export call sites (local download and Drive upload) go through this one function, so they
   * can never disagree about whether encryption happens. Cheap in the common case: only opens the
   * dialog when a password is configured AND not already cached this session (e.g. right after a
   * reload, since the cache is deliberately memory-only - see backupPasswordSession.ts).
   */
  const getOrPromptPassword = async (): Promise<string | null> => {
    if (!isBackupPasswordConfigured()) {
      return null;
    }
    const cached = getCachedPassword();
    if (cached !== null) {
      return cached;
    }
    const password = await new Promise<string | null>((resolve) => {
      exportPasswordResolveRef.current = resolve;
      setPasswordDialogError(null);
      setPasswordDialogMode('enterForExport');
    });
    if (password === null) {
      throw new PasswordPromptCancelled();
    }
    return password;
  };

  /** Shared by the plain-import path and the decrypt-then-import path below, so there is only one
   * place that finishes an import (replace + reload), exactly as before this feature existed. */
  const finishImport = async (rawData: unknown) => {
    await services.dataExport.importAndReplace(rawData);
    setReloadingText(t('notify.importCompleteReloading'));
    // Arms driveRestoring's initializer for the one reload this triggers - see its own comment.
    markSilentRestorePending();
    setTimeout(() => window.location.reload(), 1200);
  };

  const closePasswordDialog = () => {
    // A cancelled export-password prompt resolves the Promise getOrPromptPassword() is awaiting
    // with null, which that function turns into a PasswordPromptCancelled throw - the export's own
    // catch then bails out silently instead of showing an error for what was a deliberate cancel.
    if (passwordDialogMode === 'enterForExport') {
      exportPasswordResolveRef.current?.(null);
      exportPasswordResolveRef.current = null;
    }
    setPasswordDialogMode(null);
    setPendingImportEnvelope(null);
    setPasswordDialogError(null);
  };

  const submitPasswordDialog = async (password: string) => {
    if (passwordDialogMode === 'set') {
      // Hash nothing yet - just cache the password and remember that one is configured. It is
      // only ever used the moment an export actually happens (getOrPromptPassword above).
      setCachedPassword(password);
      setBackupPasswordConfigured(true);
      setPasswordConfigured(true);
      setPasswordDialogMode(null);
      notify.success(t('notify.passwordSet'));
      return;
    }

    if (passwordDialogMode === 'enterForExport') {
      setCachedPassword(password);
      setPasswordDialogMode(null);
      exportPasswordResolveRef.current?.(password);
      exportPasswordResolveRef.current = null;
      return;
    }

    if (passwordDialogMode === 'enterForImport') {
      const envelope = pendingImportEnvelope;
      if (!envelope) return;
      setPasswordDialogBusy(true);
      setPasswordDialogError(null);
      try {
        const rawData = await decryptBackup(envelope, password);
        // Deliberately NOT setCachedPassword(password) here: a backup being imported can carry a
        // completely different password than this browser's own configured one (e.g. a colleague's
        // backup, or one made before a password change) - caching it would silently switch what
        // password the NEXT export uses, with no prompt and no warning. Decrypting one file must
        // have no effect on what future exports do.
        setPasswordDialogMode(null);
        setPendingImportEnvelope(null);
        await finishImport(rawData);
      } catch (error) {
        if (error instanceof WrongPasswordError) {
          // Stay open: same dialog, same envelope, just retype the password.
          setPasswordDialogError(error.message);
        } else {
          setPasswordDialogMode(null);
          setPendingImportEnvelope(null);
          notify.error(error instanceof Error ? error.message : t('notify.importFailed'));
        }
      } finally {
        setPasswordDialogBusy(false);
      }
    }
  };

  const exportToDrive = async () => {
    setDriveBusy(true);
    try {
      const password = await getOrPromptPassword();
      const file = await services.dataExport.export();
      const content = password !== null ? await encryptBackup(file, password) : file;
      const saved = await services.backupStorage.upload(backupFilename(), content);
      notify.success(t('notify.driveBackupSaved', { name: saved.name }));
    } catch (error) {
      if (!(error instanceof PasswordPromptCancelled)) {
        reportDriveError(error, t('notify.driveBackupFailed'));
      }
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
      reportDriveError(error, t('notify.driveLoadFailed'));
    } finally {
      setDriveBusy(false);
    }
  };


  const exportData = async () => {
    setExporting(true);
    try {
      const password = await getOrPromptPassword();
      const file = await services.dataExport.export();
      const content = password !== null ? await encryptBackup(file, password) : file;
      downloadFile(backupFilename(), content);
      notify.success(t('notify.localBackupSaved'));
    } catch (error) {
      if (!(error instanceof PasswordPromptCancelled)) {
        notify.report(error, t('notify.exportFailed'));
      }
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
      if (isEncryptedBackupEnvelope(rawData)) {
        // Hand off to BackupPasswordDialog ('enterForImport'), which calls finishImport itself once
        // decryptBackup succeeds. This ConfirmDialog's job - confirming the destructive replace -
        // is done; closing it now, an entirely separate dialog takes over.
        closeImportDialog();
        setPendingImportEnvelope(rawData);
        setPasswordDialogError(null);
        setPasswordDialogMode('enterForImport');
        return;
      }
      // Close first, then cover the screen: a Backdrop and an open Dialog would fight over z-index.
      closeImportDialog();
      await finishImport(rawData);
    } catch (error) {
      closeImportDialog();
      notify.error(error instanceof Error ? error.message : t('notify.importFailed'));
    } finally {
      setImporting(false);
    }
  };

  const closeDeleteDialog = () => {
    setDeleteDialogOpen(false);
    // Otherwise the typed confirmation would still be there the next time the dialog opens.
    setConfirmationText('');
  };

  const deleteConfirmWord = t('dangerZone.confirmWord');

  const deleteAllData = async () => {
    if (confirmationText !== deleteConfirmWord) return;
    setDeleting(true);
    try {
      await services.dataExport.deleteAllData();
      // The backup password and Drive connection are configuration for THIS browser, not domain
      // data deleteAllData() touches - "alle Daten löschen" should not leave a "Festgelegt"
      // password status or a remembered Drive connection behind for data that no longer exists.
      setCachedPassword(null);
      setBackupPasswordConfigured(false);
      services.backupStorage.signOut();
      closeDeleteDialog();
      setReloadingText(t('notify.allDataDeletedReloading'));
      setTimeout(() => window.location.reload(), 1200);
    } catch (error) {
      notify.report(error, t('notify.deleteFailed'));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        minHeight: 0,
        height: '100%',
        maxWidth: 760,
        mx: 'auto',
        px: layout === 'mobile' ? 1.5 : 3,
        py: layout === 'mobile' ? 1.5 : 3,
      }}
    >
      <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="subtitle1" fontWeight={500} sx={{ mb: 1 }}>
            {t('backup.heading')}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {t('backup.description')}
          </Typography>
          <Stack direction="row" spacing={2}>
            <Button
              variant="outlined"
              startIcon={exporting ? <CircularProgress size={16} color="inherit" /> : <DownloadOutlinedIcon />}
              onClick={exportData}
              disabled={exporting}
            >
              {exporting ? t('backup.exporting') : t('backup.exportButton')}
            </Button>
            <Button variant="outlined" component="label" startIcon={<UploadOutlinedIcon />}>
              {t('backup.importButton')}
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
                {t('drive.heading')}
              </Typography>
              {!online && (
                <Alert severity="info" sx={{ mb: 2 }}>
                  {t('drive.offlineAlert')}
                </Alert>
              )}
              {driveRestoring ? (
                <Typography variant="body2" color="text.secondary">
                  {t('drive.restoring')}
                </Typography>
              ) : driveSignedIn ? (
                <>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {t('drive.signedInDescription')}
                  </Typography>
                  <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
                    <Button
                      variant="outlined"
                      startIcon={driveBusy ? <CircularProgress size={16} color="inherit" /> : <CloudUploadOutlinedIcon />}
                      onClick={exportToDrive}
                      disabled={driveBusy || !online}
                    >
                      {driveBusy ? t('drive.saving') : t('drive.saveButton')}
                    </Button>
                    <Button
                      variant="outlined"
                      startIcon={<CloudDownloadOutlinedIcon />}
                      onClick={() => setDrivePickerOpen(true)}
                      disabled={driveBusy || !online}
                    >
                      {t('drive.loadButton')}
                    </Button>
                    <Button onClick={disconnectDrive} disabled={driveBusy}>
                      {t('drive.disconnectButton')}
                    </Button>
                  </Stack>
                </>
              ) : (
                <>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {driveRemembered ? t('drive.rememberedDescription') : t('drive.neverConnectedDescription')}
                  </Typography>
                  <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
                    <Button
                      variant="outlined"
                      onClick={connectDrive}
                      disabled={driveBusy || !online}
                      startIcon={driveBusy ? <CircularProgress size={16} color="inherit" /> : undefined}
                    >
                      {driveBusy ? t('drive.signingIn') : t('drive.signInButton')}
                    </Button>
                    {driveRemembered && (
                      <Button onClick={disconnectDrive} disabled={driveBusy}>
                        {t('drive.stopUsingButton')}
                      </Button>
                    )}
                  </Stack>
                </>
              )}
            </>
          )}

          <Divider sx={{ my: 3 }} />
          <Typography variant="subtitle1" fontWeight={500} sx={{ mb: 1 }}>
            {t('password.heading')}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {t('password.description')}
          </Typography>
          <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap>
            <Typography variant="body2">
              {t('password.status', { status: passwordConfigured ? t('password.statusSet') : t('password.statusNotSet') })}
            </Typography>
            <Button
              variant="outlined"
              startIcon={<VpnKeyOutlinedIcon />}
              onClick={() => {
                setPasswordDialogError(null);
                setPasswordDialogMode('set');
              }}
            >
              {passwordConfigured ? t('password.changeButton') : t('password.setLabel')}
            </Button>
            {passwordConfigured && <Button onClick={removeBackupPassword}>{t('password.removeButton')}</Button>}
          </Stack>
        </Paper>


        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="subtitle1" fontWeight={500} sx={{ mb: 1 }}>
            {t('appearance.heading')}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            {t('appearance.modeLabel')}
          </Typography>
          <ToggleButtonGroup
            exclusive
            value={themeMode}
            onChange={(_, value) => value && setThemeMode(value)}
            size="small"
            aria-label={t('appearance.modeLabel')}
          >
            <ToggleButton value="light">{t('appearance.modeLight')}</ToggleButton>
            <ToggleButton value="dark">{t('appearance.modeDark')}</ToggleButton>
            <ToggleButton value="system">{t('appearance.modeSystem')}</ToggleButton>
          </ToggleButtonGroup>

          <Typography variant="body2" color="text.secondary" sx={{ mt: 2, mb: 1 }}>
            {t('appearance.accentLabel')}
          </Typography>
          <Box role="radiogroup" aria-label={t('appearance.accentLabel')} sx={{ display: 'flex', gap: 1.5 }}>
            {ACCENT_COLOR_ORDER.map((key, index) => {
              const isSelected = accentColor === key;
              return (
                <ButtonBase
                  key={key}
                  ref={(el: HTMLButtonElement | null) => {
                    accentButtonRefs.current[index] = el;
                  }}
                  role="radio"
                  aria-checked={isSelected}
                  aria-label={t(ACCENT_COLOR_LABEL_KEY[key])}
                  tabIndex={isSelected ? 0 : -1}
                  onClick={() => setAccentColor(key)}
                  onKeyDown={(e) => {
                    const direction =
                      e.key === 'ArrowRight' || e.key === 'ArrowDown'
                        ? 1
                        : e.key === 'ArrowLeft' || e.key === 'ArrowUp'
                          ? -1
                          : 0;
                    if (direction === 0) return;
                    e.preventDefault();
                    const currentIndex = ACCENT_COLOR_ORDER.indexOf(accentColor);
                    const nextIndex =
                      (currentIndex + direction + ACCENT_COLOR_ORDER.length) % ACCENT_COLOR_ORDER.length;
                    setAccentColor(ACCENT_COLOR_ORDER[nextIndex]);
                    accentButtonRefs.current[nextIndex]?.focus();
                  }}
                  sx={(swatchTheme) => ({
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    bgcolor: ACCENT_COLORS[key].main,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    '&:focus-visible': {
                      outline: `2px solid ${swatchTheme.palette.primary.main}`,
                      outlineOffset: 2,
                    },
                  })}
                >
                  {isSelected && <CheckIcon sx={{ color: '#fff', fontSize: 20 }} />}
                </ButtonBase>
              );
            })}
          </Box>
        </Paper>

        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="subtitle1" fontWeight={500} sx={{ mb: 1 }}>
            {t('appStorage.heading')}
          </Typography>

          {installed ? (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {t('appStorage.installedDescription')}
            </Typography>
          ) : (
            <>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {t('appStorage.notInstalledDescription')}
                {installable
                  ? ''
                  : isManualInstallPlatform()
                    ? t('appStorage.iosInstallHint')
                    : t('appStorage.unsupportedInstallHint')}
              </Typography>
              {installable && (
                <Button
                  variant="outlined"
                  startIcon={<InstallMobileOutlinedIcon />}
                  onClick={() => void promptInstall()}
                  sx={{ mb: 2 }}
                >
                  {t('appStorage.installButton')}
                </Button>
              )}
            </>
          )}

          <Divider sx={{ my: 2 }} />

          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            {t('appStorage.durableStorageLabel')}{' '}
            {durability === 'persistent'
              ? t('appStorage.durablePersistent')
              : durability === 'best-effort'
                ? t('appStorage.durableBestEffort')
                : t('appStorage.durableUnsupported')}
            {usage &&
              t('appStorage.usageSuffix', { kb: Math.max(1, Math.round(usage.usedBytes / 1024)).toLocaleString('de-DE') })}
          </Typography>
          {durability === 'best-effort' && (
            <>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {t('appStorage.bestEffortWarning')}
              </Typography>
              <Button
                variant="outlined"
                onClick={askForDurableStorage}
                disabled={askingStorage}
                startIcon={askingStorage ? <CircularProgress size={16} color="inherit" /> : undefined}
              >
                {t('appStorage.requestDurableButton')}
              </Button>
            </>
          )}
        </Paper>
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="subtitle1" fontWeight={500} sx={{ mb: 1 }}>
            {t('legal.heading')}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            {t('legal.privacyIntro')}{' '}
            <Link component={RouterLink} to={buildLocalizedPath(locale, '/privacy')}>
              {t('legal.privacyLinkText')}
            </Link>
            .
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('legal.termsIntro')}{' '}
            <Link component={RouterLink} to={buildLocalizedPath(locale, '/terms')}>
              {tNav('terms')}
            </Link>
            .
          </Typography>
        </Paper>

        <Paper sx={(theme) => ({ p: 3, borderColor: theme.palette.errorSurface.border })}>
          <Typography variant="subtitle1" fontWeight={500} sx={{ mb: 1 }}>
            {t('dangerZone.heading')}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {t('dangerZone.description')}
          </Typography>
          <Button
            variant="outlined"
            color="error"
            startIcon={<DeleteForeverOutlinedIcon />}
            onClick={() => setDeleteDialogOpen(true)}
          >
            {t('dangerZone.heading')}
          </Button>
        </Paper>

        <Paper sx={{ p: 3, mt: 3 }}>
          <Typography variant="subtitle1" fontWeight={500} sx={{ mb: 1 }}>
            {t('version.heading')}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {t('version.description')}
          </Typography>
          {/* data-selectable zusaetzlich zu userSelect: Es haelt auch das native Rechtsklick-Menue
              offen, das sonst app-weit unterdrueckt wird - und "Kopieren" per Rechtsklick ist genau
              der Griff, zu dem der Satz darueber auffordert. */}
          <Stack
            data-selectable
            spacing={0.5}
            sx={{ fontFamily: 'monospace', fontSize: 14, userSelect: 'all' }}
          >
            <span>
              {t('version.versionLabel')} {APP_VERSION}
            </span>
            {/* The raw ISO timestamp on purpose: unambiguous, time-zone free, and it sidesteps the
                German date-format rules that apply to user-facing dates. */}
            <span>
              {t('version.buildLabel')} {APP_BUILD_TIME}
            </span>
            <span>
              {t('version.commitLabel')} {APP_COMMIT || '-'}
            </span>
          </Stack>
        </Paper>
      </Box>

      {/* onClose short-circuited while deleting: Escape or a click on the backdrop would otherwise
          tear the dialog down in the middle of wiping the database. */}
      <ResponsiveDialog
        open={deleteDialogOpen}
        onClose={deleting ? undefined : closeDeleteDialog}
        title={t('dangerZone.dialogTitle')}
        maxWidth="sm"
        actions={
          <>
            <Button onClick={closeDeleteDialog} disabled={deleting}>
              {tCommon('cancel')}
            </Button>
            <Button
              variant="contained"
              color="error"
              disabled={confirmationText !== deleteConfirmWord || deleting}
              onClick={deleteAllData}
              startIcon={deleting ? <CircularProgress size={16} color="inherit" /> : undefined}
            >
              {t('dangerZone.confirmDeleteButton')}
            </Button>
          </>
        }
      >
        <Typography variant="body2" sx={{ mb: 2 }}>
          {t('dangerZone.dialogBodyPrefix')} <strong>{deleteConfirmWord}</strong> {t('dangerZone.dialogBodySuffix')}
        </Typography>
        <TextField
          fullWidth
          label={t('dangerZone.confirmLabel')}
          value={confirmationText}
          onChange={(e) => setConfirmationText(e.target.value)}
          placeholder={deleteConfirmWord}
        />
      </ResponsiveDialog>

      {drivePickerOpen && (
        <DriveBackupDialog
          busy={driveBusy}
          onClose={() => setDrivePickerOpen(false)}
          onSelect={chooseDriveBackup}
          onError={notify.report}
        />
      )}

      {passwordDialogMode && (
        <BackupPasswordDialog
          mode={passwordDialogMode === 'set' ? 'set' : passwordDialogMode === 'enterForExport' ? 'confirm' : 'enter'}
          error={passwordDialogError}
          busy={passwordDialogBusy}
          onClose={closePasswordDialog}
          onSubmit={submitPasswordDialog}
        />
      )}

      <ConfirmDialog
        open={!!importFile}
        title={t('importDialog.title')}
        text={t('importDialog.text')}
        confirmText={t('importDialog.confirmButton')}
        dangerous
        busy={importing}
        onConfirm={performImport}
        onCancel={closeImportDialog}
      />

      {/* modal + 1, not drawer + 1: a standalone Backdrop has no z-index of its own and would
          otherwise sit behind the dialog that just closed, while its exit transition still runs. */}
      <Backdrop open={reloadingText !== null} sx={{ zIndex: (theme) => theme.zIndex.modal + 1, color: '#fff' }}>
        <Stack spacing={2} alignItems="center">
          <CircularProgress color="inherit" />
          <Typography variant="body2">{reloadingText}</Typography>
        </Stack>
      </Backdrop>
    </Box>
  );
}
