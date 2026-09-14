import { useState } from 'react';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import IconButton from '@mui/material/IconButton';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import CircularProgress from '@mui/material/CircularProgress';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import { useTranslation } from 'react-i18next';
import type { FieldError } from '@domain/validation/FieldError';
import { useFormValidation } from '@ui/hooks/useFormValidation';
import { RequiredLegend } from '@ui/components/RequiredLegend';
import { ResponsiveDialog } from '@ui/components/ResponsiveDialog';

interface BackupPasswordDialogProps {
  mode: 'set' | 'enter' | 'confirm';
  /** 'enter' mode only: message from a failed decrypt attempt on the SAME envelope, passed back in
   * by the parent after it catches `WrongPasswordError` so the dialog can show it inline and let
   * the user retry without closing the dialog or re-selecting the file. */
  error?: string | null;
  /** Spinner + disabled confirm button while the parent runs the PBKDF2 derive and
   * encrypt/decrypt - deliberately slow (several hundred ms), so this must never look frozen. */
  busy: boolean;
  onClose: () => void;
  onSubmit: (password: string) => void | Promise<void>;
}

/**
 * Sets or asks for the password a backup is encrypted with - never the backup content itself. Used
 * for three flows in `SettingsView`: setting/changing the password ('set'), obtaining it once per
 * session before an export when it isn't cached yet ('confirm'), and entering it to decrypt an
 * import file ('enter'). 'confirm' shows the same two-field, must-match layout as 'set' - the app
 * never stores the actual password (see `backupPasswordSession.ts`), so re-typing it and comparing
 * the two entries against EACH OTHER is the only way to catch a typo before it silently produces a
 * backup nobody can open again - but unlike 'set' it must never call `setBackupPasswordConfigured`,
 * since the password was already configured; this dialog is only confirming it, not (re)defining
 * it. Only 'enter' can fail asynchronously (a wrong password against a real file), which is why
 * `error` is a prop rather than state owned here - the parent keeps the dialog mounted across
 * retries so the typed password and the file/envelope stay put.
 */
type PasswordField = 'password' | 'confirmPassword';

export function BackupPasswordDialog({ mode, error = null, busy, onClose, onSubmit }: BackupPasswordDialogProps) {
  const { t } = useTranslation('settings');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Same shared hook every other data-entry dialog in the app uses (EmployeeDialog, BranchDialog,
  // AbsenceDialog, DayEditor, ShiftTemplateDialog) instead of a hand-rolled touched/mismatch pair -
  // gets the "errors only after first Speichern attempt" gating and the focus-first-invalid-field
  // behavior for free, matching src/ui/CLAUDE.md's "Forms and dialogs" convention.
  const validation = useFormValidation<PasswordField>((): FieldError<PasswordField>[] => {
    const errors: FieldError<PasswordField>[] = [];
    if (password.length === 0) {
      errors.push({ field: 'password', message: t('password.requiredError') });
    }
    if ((mode === 'set' || mode === 'confirm') && password.length > 0 && password !== confirmPassword) {
      errors.push({ field: 'confirmPassword', message: t('password.mismatchError') });
    }
    return errors;
  });

  const submit = () => {
    if (!validation.submit()) return;
    void onSubmit(password);
  };

  const visibilityToggle = {
    endAdornment: (
      <InputAdornment position="end">
        <IconButton
          aria-label={showPassword ? t('password.hidePassword') : t('password.showPassword')}
          onClick={() => setShowPassword((current) => !current)}
          edge="end"
          disabled={busy}
        >
          {showPassword ? <VisibilityOff /> : <Visibility />}
        </IconButton>
      </InputAdornment>
    ),
  };

  return (
    <ResponsiveDialog
      open
      onClose={busy ? undefined : onClose}
      title={
        mode === 'set'
          ? t('password.setLabel')
          : mode === 'confirm'
            ? t('password.titleConfirm')
            : t('password.titleEnter')
      }
      maxWidth="xs"
      contentRef={validation.containerRef}
      actions={
        <>
          <Button onClick={onClose} disabled={busy}>
            {t('cancel', { ns: 'common' })}
          </Button>
          <Button
            variant="contained"
            onClick={submit}
            disabled={busy}
            startIcon={busy ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            {busy
              ? mode === 'set'
                ? t('password.settingBusy')
                : t('password.checkingBusy')
              : mode === 'set'
                ? t('password.confirmSetButton')
                : t('confirm', { ns: 'common' })}
          </Button>
        </>
      }
    >
      <RequiredLegend />

      {mode === 'set' && (
        <Alert severity="warning" sx={{ mb: 2 }} data-selectable>
          {t('password.setWarning')}
        </Alert>
      )}

      {mode === 'confirm' && (
        <Alert severity="info" sx={{ mb: 2 }} data-selectable>
          {t('password.confirmInfo')}
        </Alert>
      )}

      {mode === 'enter' && error && (
        <Alert severity="error" sx={{ mb: 2 }} data-selectable>
          {error}
        </Alert>
      )}

      <Stack spacing={2}>
        <TextField
          required
          fullWidth
          label={t('password.passwordLabel')}
          type={showPassword ? 'text' : 'password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && mode === 'enter') submit();
          }}
          InputProps={visibilityToggle}
          disabled={busy}
          {...validation.fieldProps('password', ' ')}
        />
        {(mode === 'set' || mode === 'confirm') && (
          <TextField
            required
            fullWidth
            label={t('password.confirmPasswordLabel')}
            type={showPassword ? 'text' : 'password'}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit();
            }}
            InputProps={visibilityToggle}
            disabled={busy}
            {...validation.fieldProps('confirmPassword', ' ')}
          />
        )}
      </Stack>
    </ResponsiveDialog>
  );
}
