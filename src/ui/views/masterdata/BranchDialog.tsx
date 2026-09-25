import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
import type { TFunction } from 'i18next';
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
import { useDiscardConfirm } from '@ui/hooks/useDiscardConfirm';
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

function readLogoAsBase64(file: File, t: TFunction<'masterdata'>): Promise<string> {
  if (!file.type.startsWith('image/')) {
    return Promise.reject(new Error(t('branch.dialog.imageOnlyError')));
  }
  if (file.size > MAX_LOGO_SIZE_BYTES) {
    return Promise.reject(new Error(t('branch.dialog.logoTooLarge')));
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error(t('branch.dialog.logoReadError')));
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
  const { t } = useTranslation('masterdata');
  const { t: tCommon } = useTranslation();
  const [form, setForm] = useState<FormState>(() => (branch ? formFromBranch(branch) : emptyForm()));
  const [saving, setSaving] = useState(false);
  const [logoReading, setLogoReading] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [newSunday, setNewSunday] = useState('');
  // Flat values only (the logo is a data-URL string), so comparing the serialized state is enough.
  // A picked but not yet added Sonntag counts as input too.
  const [initialState] = useState(() => JSON.stringify({ form, newSunday: '' }));
  const dirty = JSON.stringify({ form, newSunday }) !== initialState;
  const { requestClose, confirmDialog } = useDiscardConfirm(dirty, saving ? undefined : onClose);
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
      onError(e, t('branch.dialog.saveError'));
    } finally {
      setSaving(false);
    }
  };

  const uploadLogo = async (file: File | null) => {
    if (!file) return;
    setLogoReading(true);
    try {
      const base64 = await readLogoAsBase64(file, t);
      setForm((f) => ({ ...f, logoBase64: base64 }));
    } catch (e) {
      onError(e, t('branch.dialog.logoUploadError'));
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
      onClose={requestClose}
      title={branch ? t('branch.dialog.titleEdit') : t('branch.newButton')}
      contentRef={validation.containerRef}
      secondaryActions={secondaryActions}
      secondaryActionsLocked={dirty ? tCommon('secondaryActionsLocked') : undefined}
      actions={
        <>
          <FormErrorNotice errors={validation.errors} />
          <Button onClick={requestClose} disabled={saving}>
            {tCommon('cancel')}
          </Button>
          <Button
            variant="contained"
            onClick={save}
            disabled={saving || logoReading}
            startIcon={saving ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            {tCommon('save')}
          </Button>
        </>
      }
    >
      <RequiredLegend />
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Stack direction="row" spacing={2} alignItems="center">
            <Avatar
              src={form.logoBase64 ?? undefined}
              alt=""
              variant="rounded"
              sx={(theme) => ({ width: 56, height: 56, bgcolor: theme.palette.accentSurface.subtle })}
            >
              <StoreOutlinedIcon sx={(theme) => ({ color: theme.palette.primary.main })} />
            </Avatar>
            {/* Not component="label": Enter on a label-rendered Button calls its (missing) onClick,
                so the picker never opened from the keyboard. */}
            <Button variant="text" size="small" disabled={logoReading} onClick={() => logoInputRef.current?.click()}>
              {logoReading ? t('branch.dialog.logoReading') : t('branch.dialog.logoUploadLabel')}
            </Button>
            <input
              ref={logoInputRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => uploadLogo(e.target.files?.[0] ?? null)}
            />
          </Stack>
          <TextField
            label={t('branch.dialog.nameLabel')}
            required
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder={t('branch.dialog.namePlaceholder')}
            fullWidth
            {...validation.fieldProps('name')}
          />
          <TextField
            label={t('branch.dialog.numberLabel')}
            required
            value={form.branchNumber}
            onChange={(e) => setForm((f) => ({ ...f, branchNumber: e.target.value }))}
            placeholder={t('branch.dialog.numberPlaceholder')}
            fullWidth
            {...validation.fieldProps('branchNumber')}
          />
          <TextField
            select
            label={t('branch.dialog.federalStateLabel')}
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
              label={t('branch.dialog.streetLabel')}
              value={form.street}
              onChange={(e) => setForm((f) => ({ ...f, street: e.target.value }))}
              fullWidth
            />
            <TextField
              label={t('branch.dialog.houseNumberLabel')}
              value={form.houseNumber}
              onChange={(e) => setForm((f) => ({ ...f, houseNumber: e.target.value }))}
              // flexShrink 0 here and on PLZ: the fullWidth neighbour squeezed them on a phone until
              // their labels were cut off - the neighbour gives way instead.
              sx={{ width: 130, flexShrink: 0 }}
            />
          </Stack>
          <Stack direction="row" spacing={2}>
            <TextField
              label={t('branch.dialog.postalCodeLabel')}
              value={form.postalCode}
              onChange={(e) => setForm((f) => ({ ...f, postalCode: e.target.value }))}
              sx={{ width: 160, flexShrink: 0 }}
            />
            <TextField
              label={t('branch.dialog.cityLabel')}
              value={form.city}
              onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
              fullWidth
            />
          </Stack>

          <Divider />
          <Typography variant="subtitle2">{t('branch.dialog.openSundaysHeading')}</Typography>
          <Typography variant="caption" color="text.secondary">
            {t('branch.dialog.openSundaysCaption')}
          </Typography>
          <Stack direction="row" spacing={2} alignItems="flex-start" ref={sundayValidation.containerRef}>
            <TextField
              label={t('branch.dialog.addDateLabel')}
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
              {t('branch.dialog.addButton')}
            </Button>
          </Stack>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {form.allowedOpenSundays.length === 0 && (
              <Typography variant="body2" color="text.secondary">
                {t('branch.dialog.noOpenSundays')}
              </Typography>
            )}
            {form.allowedOpenSundays.map((date) => (
              <Chip key={date} label={formatISODateGerman(date)} onDelete={() => removeSunday(date)} size="small" />
            ))}
          </Stack>
        </Stack>
      {confirmDialog}
    </ResponsiveDialog>
  );
}
