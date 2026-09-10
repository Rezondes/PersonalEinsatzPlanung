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
import type { FieldError } from '@domain/validation/FieldError';
import { useFormValidation } from '@ui/hooks/useFormValidation';
import { RequiredLegend } from '@ui/components/RequiredLegend';
import { ResponsiveDialog } from '@ui/components/ResponsiveDialog';

interface BackupPasswordDialogProps {
  mode: 'set' | 'enter';
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
 * session before an export when it isn't cached yet, and entering it to decrypt an import file
 * ('enter' for both). Only the last of these can fail (a wrong password), which is why `error` is a
 * prop rather than state owned here - the parent keeps the dialog mounted across retries so the
 * typed password and the file/envelope stay put.
 */
type PasswordField = 'password' | 'confirmPassword';

export function BackupPasswordDialog({ mode, error = null, busy, onClose, onSubmit }: BackupPasswordDialogProps) {
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
      errors.push({ field: 'password', message: 'Bitte Passwort eingeben.' });
    }
    if (mode === 'set' && password.length > 0 && password !== confirmPassword) {
      errors.push({ field: 'confirmPassword', message: 'Passwörter stimmen nicht überein.' });
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
          aria-label={showPassword ? 'Passwort verbergen' : 'Passwort anzeigen'}
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
      title={mode === 'set' ? 'Backup-Passwort festlegen' : 'Backup-Passwort eingeben'}
      maxWidth="xs"
      contentRef={validation.containerRef}
      actions={
        <>
          <Button onClick={onClose} disabled={busy}>
            Abbrechen
          </Button>
          <Button
            variant="contained"
            onClick={submit}
            disabled={busy}
            startIcon={busy ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            {busy
              ? mode === 'set'
                ? 'Wird festgelegt…'
                : 'Wird geprüft…'
              : mode === 'set'
                ? 'Festlegen'
                : 'Bestätigen'}
          </Button>
        </>
      }
    >
      <RequiredLegend />

      {mode === 'set' && (
        <Alert severity="warning" sx={{ mb: 2 }} data-selectable>
          Wird dieses Passwort vergessen, lassen sich damit verschlüsselte Backups nicht mehr öffnen. Es gibt
          keine Möglichkeit, das Passwort zurückzusetzen oder die Daten ohne das Passwort wiederherzustellen.
          Bewahre es an einem sicheren Ort auf.
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
          label="Passwort"
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
        {mode === 'set' && (
          <TextField
            required
            fullWidth
            label="Passwort bestätigen"
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
