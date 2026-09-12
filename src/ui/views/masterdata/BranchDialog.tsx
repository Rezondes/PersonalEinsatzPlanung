import { useState } from 'react';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Divider from '@mui/material/Divider';
import Avatar from '@mui/material/Avatar';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import StoreOutlinedIcon from '@mui/icons-material/StoreOutlined';
import type { Branch, FederalState } from '@domain/branch/Branch';
import { FEDERAL_STATES } from '@domain/branch/Branch';
import { validateBranch, validateOpenSundayDate } from '@domain/branch/branchValidation';
import type { BranchField, OpenSundayField } from '@domain/branch/branchValidation';
import { formatISODateGerman } from '@domain/shared/DateFormat';
import { services } from '@infrastructure/services';
import { useFormValidation } from '@ui/hooks/useFormValidation';
import { RequiredLegend } from '@ui/components/RequiredLegend';
import { FormErrorNotice } from '@ui/components/FormErrorNotice';
import { ResponsiveDialog } from '@ui/components/ResponsiveDialog';
import type { RowAction } from '@ui/components/ResponsiveList/RowAction';

interface FormState {
  name: string;
  branchNumber: string;
  federalState: FederalState;
  street: string;
  houseNumber: string;
  postalCode: string;
  city: string;
  logoBase64: string | null;
  allowedOpenSundays: string[];
}

function emptyForm(): FormState {
  return {
    name: '',
    branchNumber: '',
    federalState: 'Niedersachsen',
    street: '',
    houseNumber: '',
    postalCode: '',
    city: '',
    logoBase64: null,
    allowedOpenSundays: [],
  };
}

function formFromBranch(b: Branch): FormState {
  return {
    name: b.name,
    branchNumber: b.branchNumber,
    federalState: b.federalState,
    street: b.address.street,
    houseNumber: b.address.houseNumber,
    postalCode: b.address.postalCode,
    city: b.address.city,
    logoBase64: b.logoBase64,
    allowedOpenSundays: b.allowedOpenSundays,
  };
}

/** 500 KB: generous for a small store-front logo, small enough that a mis-selected multi-MB photo
 * doesn't silently bloat every future JSON export/import and Dexie record it now rides along in. */
const MAX_LOGO_SIZE_BYTES = 500 * 1024;

function readLogoAsBase64(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    return Promise.reject(new Error('Bitte eine Bilddatei auswählen.'));
  }
  if (file.size > MAX_LOGO_SIZE_BYTES) {
    return Promise.reject(new Error('Das Logo darf höchstens 500 KB groß sein.'));
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Logo konnte nicht gelesen werden.'));
    reader.readAsDataURL(file);
  });
}

interface BranchDialogProps {
  /** null creates a new branch, otherwise the given one is edited. */
  branch: Branch | null;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
  onError: (e: unknown, context?: string) => void;
  /** Same RowAction[] BranchMasterDataView builds for its long-press sheet (minus "Bearbeiten"),
   * rendered as "Weitere Aktionen" on mobile/tablet. Omitted while creating a new branch. */
  secondaryActions?: RowAction[];
}

/** Create/edit dialog for a branch. Mounted only while open, so form state and the validation's
 * "already tried to save" flag start fresh every time. The open-Sundays list has its own small
 * sub-form ("Datum hinzufügen") with its own validation, independent of Speichern. */
export function BranchDialog({ branch, onClose, onSaved, onError, secondaryActions }: BranchDialogProps) {
  const [form, setForm] = useState<FormState>(() => (branch ? formFromBranch(branch) : emptyForm()));
  const [saving, setSaving] = useState(false);
  const [logoReading, setLogoReading] = useState(false);
  const [newSunday, setNewSunday] = useState('');
  const validation = useFormValidation<BranchField>(() => validateBranch({ name: form.name, branchNumber: form.branchNumber }));
  const sundayValidation = useFormValidation<OpenSundayField>(() => validateOpenSundayDate(newSunday, form.allowedOpenSundays));

  const save = async () => {
    if (!validation.submit()) return;

    const address = {
      street: form.street,
      houseNumber: form.houseNumber,
      postalCode: form.postalCode,
      city: form.city,
    };
    const name = form.name.trim();
    const branchNumber = form.branchNumber.trim();

    setSaving(true);
    try {
      if (branch) {
        await services.branch.update({
          ...branch,
          name,
          branchNumber,
          federalState: form.federalState,
          address,
          logoBase64: form.logoBase64,
          allowedOpenSundays: form.allowedOpenSundays,
        });
      } else {
        const created = await services.branch.create({
          name,
          branchNumber,
          federalState: form.federalState,
          address,
          logoBase64: form.logoBase64,
        });
        if (form.allowedOpenSundays.length > 0) {
          await services.branch.update({ ...created, allowedOpenSundays: form.allowedOpenSundays });
        }
      }
      onClose();
      await onSaved();
    } catch (e) {
      onError(e, 'Filiale konnte nicht gespeichert werden');
    } finally {
      setSaving(false);
    }
  };

  const uploadLogo = async (file: File | null) => {
    if (!file) return;
    setLogoReading(true);
    try {
      const base64 = await readLogoAsBase64(file);
      setForm((f) => ({ ...f, logoBase64: base64 }));
    } catch (e) {
      onError(e, 'Logo konnte nicht gelesen werden');
    } finally {
      setLogoReading(false);
    }
  };

  const addSunday = () => {
    if (!sundayValidation.submit()) return;
    setForm((f) => ({ ...f, allowedOpenSundays: [...f.allowedOpenSundays, newSunday].sort() }));
    setNewSunday('');
    sundayValidation.reset();
  };

  const removeSunday = (date: string) => {
    setForm((f) => ({ ...f, allowedOpenSundays: f.allowedOpenSundays.filter((d) => d !== date) }));
  };

  return (
    <ResponsiveDialog
      open
      onClose={saving ? undefined : onClose}
      title={branch ? 'Filiale bearbeiten' : 'Neue Filiale'}
      contentRef={validation.containerRef}
      secondaryActions={secondaryActions}
      actions={
        <>
          <FormErrorNotice errors={validation.errors} />
          <Button onClick={onClose} disabled={saving}>
            Abbrechen
          </Button>
          <Button
            variant="contained"
            onClick={save}
            disabled={saving || logoReading}
            startIcon={saving ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            Speichern
          </Button>
        </>
      }
    >
      <RequiredLegend />
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Stack direction="row" spacing={2} alignItems="center">
            <Avatar src={form.logoBase64 ?? undefined} variant="rounded" sx={{ width: 56, height: 56, bgcolor: '#eef3f1' }}>
              <StoreOutlinedIcon sx={{ color: '#2f5d50' }} />
            </Avatar>
            <Button variant="text" component="label" size="small" disabled={logoReading}>
              {logoReading ? 'Logo wird gelesen…' : 'Logo hochladen (optional)'}
              <input type="file" accept="image/*" hidden onChange={(e) => uploadLogo(e.target.files?.[0] ?? null)} />
            </Button>
          </Stack>
          <TextField
            label="Name"
            required
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Velpke - Weidenweg"
            fullWidth
            {...validation.fieldProps('name')}
          />
          <TextField
            label="Filialnummer"
            required
            value={form.branchNumber}
            onChange={(e) => setForm((f) => ({ ...f, branchNumber: e.target.value }))}
            placeholder="2504"
            fullWidth
            {...validation.fieldProps('branchNumber')}
          />
          <TextField
            select
            label="Bundesland"
            required
            value={form.federalState}
            onChange={(e) => setForm((f) => ({ ...f, federalState: e.target.value as FederalState }))}
            fullWidth
          >
            {FEDERAL_STATES.map((state) => (
              <MenuItem key={state} value={state}>
                {state}
              </MenuItem>
            ))}
          </TextField>
          <Stack direction="row" spacing={2}>
            <TextField
              label="Straße (optional)"
              value={form.street}
              onChange={(e) => setForm((f) => ({ ...f, street: e.target.value }))}
              fullWidth
            />
            <TextField
              label="Nr. (optional)"
              value={form.houseNumber}
              onChange={(e) => setForm((f) => ({ ...f, houseNumber: e.target.value }))}
              sx={{ width: 130 }}
            />
          </Stack>
          <Stack direction="row" spacing={2}>
            <TextField
              label="PLZ (optional)"
              value={form.postalCode}
              onChange={(e) => setForm((f) => ({ ...f, postalCode: e.target.value }))}
              sx={{ width: 160 }}
            />
            <TextField
              label="Ort (optional)"
              value={form.city}
              onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
              fullWidth
            />
          </Stack>

          <Divider />
          <Typography variant="subtitle2">Verkaufsoffene Sonntage</Typography>
          <Typography variant="caption" color="text.secondary">
            Nur an diesen Terminen wird Sonntagsarbeit nicht als rechtlicher Hinweis markiert.
          </Typography>
          <Stack direction="row" spacing={2} alignItems="flex-start" ref={sundayValidation.containerRef}>
            <TextField
              label="Datum hinzufügen"
              type="date"
              required
              size="small"
              value={newSunday}
              onChange={(e) => setNewSunday(e.target.value)}
              InputLabelProps={{ shrink: true }}
              fullWidth
              {...sundayValidation.fieldProps('newSunday')}
            />
            <Button onClick={addSunday} sx={{ mt: 0.5 }}>
              Hinzufügen
            </Button>
          </Stack>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {form.allowedOpenSundays.length === 0 && (
              <Typography variant="body2" color="text.secondary">
                Keine verkaufsoffenen Sonntage hinterlegt.
              </Typography>
            )}
            {form.allowedOpenSundays.map((date) => (
              <Chip key={date} label={formatISODateGerman(date)} onDelete={() => removeSunday(date)} size="small" />
            ))}
          </Stack>
        </Stack>
    </ResponsiveDialog>
  );
}
