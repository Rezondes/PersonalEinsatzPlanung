import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Stack from '@mui/material/Stack';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import CircularProgress from '@mui/material/CircularProgress';
import FormControl from '@mui/material/FormControl';
import FormLabel from '@mui/material/FormLabel';
import RadioGroup from '@mui/material/RadioGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import Radio from '@mui/material/Radio';
import type { BranchId } from '@domain/shared/ids';
import type { ShiftTemplate, VacationHalfDay } from '@domain/schedule/ShiftTemplate';
import { minutesToDecimalHours } from '@domain/schedule/scheduleCalculation';
import { validateShiftTemplate } from '@domain/schedule/shiftTemplateValidation';
import type { ShiftTemplateDraft } from '@domain/schedule/shiftTemplateValidation';
import type { ShiftDraft } from '@domain/schedule/shiftDraft';
import {
  SHIFT_LIST_FIELD,
  newShiftDraft,
  shiftDraftsToShifts,
  shiftToDraft,
  validateShiftDrafts,
} from '@domain/schedule/shiftDraft';
import { services } from '@infrastructure/services';
import { useFormValidation } from '@ui/hooks/useFormValidation';
import { RequiredLegend } from '@ui/components/RequiredLegend';
import { FormErrorNotice } from '@ui/components/FormErrorNotice';
import { ResponsiveDialog } from '@ui/components/ResponsiveDialog';
import { useDiscardConfirm } from '@ui/hooks/useDiscardConfirm';
import { DecimalTextField } from '@ui/components/DecimalTextField';
import { useBreakpoint } from '@ui/hooks/useBreakpoint';
import { ABSENCE_KIND_KEY } from '../scheduleTools';
import type { CellAbsenceDraft } from '../scheduleTools';
import { ShiftListEditor } from './ShiftListEditor';
import { entryTypeToggleSx } from './entryTypeToggleSx';

type TemplateKind = ShiftTemplateDraft['kind'];
type CreditedKind = Exclude<TemplateKind, 'Shift' | 'Other'>;

const isCreditedKind = (kind: TemplateKind): kind is CreditedKind => kind !== 'Shift' && kind !== 'Other';

interface ShiftTemplateDialogProps {
  branchId: BranchId;
  /** null creates a new template, otherwise the given one is edited. */
  template: ShiftTemplate | null;
  /** Prefilled shifts when the template is being created from an existing day
   * ("Als Vorlage speichern"). Ignored while editing. */
  initialDrafts?: ShiftDraft[];
  /** Prefilled kind and fields when the template is being created from a day with an absence
   * ("Als Vorlage speichern"). Ignored while editing. */
  initialAbsence?: CellAbsenceDraft;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
  onError: (e: unknown, context?: string) => void;
}

/** Create/edit dialog for a reusable shift template. Mounted only while open (the parent renders it
 * conditionally), so form state and the "already tried to save" flag start fresh every time.
 * Field rules come from validateShiftTemplate/validateShiftDrafts in the domain. */
export function ShiftTemplateDialog({
  branchId,
  template,
  initialDrafts,
  initialAbsence,
  onClose,
  onSaved,
  onError,
}: ShiftTemplateDialogProps) {
  const { t } = useTranslation('schedule');
  const { t: tCommon } = useTranslation();
  const { t: tAbsences } = useTranslation('absences');
  const isMobile = useBreakpoint() === 'mobile';
  // An absence kind starts out named after its type ("Urlaub"). Switching kind only replaces a
  // name that is still empty or that default, never one the user typed.
  const defaultName = (k: TemplateKind) => (isCreditedKind(k) ? tCommon(ABSENCE_KIND_KEY[k]) : '');
  // An absence's type names its template kind one to one ('Other' is Sonstiges either way).
  const initialKind: TemplateKind = template?.kind ?? initialAbsence?.type ?? 'Shift';
  const [kind, setKind] = useState<TemplateKind>(initialKind);
  // A Sonstiges absence's Bezeichnung is the template's name too (see the validation comment below).
  const [name, setName] = useState(template?.name ?? initialAbsence?.label ?? defaultName(initialKind));
  const [drafts, setDrafts] = useState<ShiftDraft[]>(() => {
    if (template?.kind === 'Shift') {
      return template.shifts.map(shiftToDraft);
    }
    return initialDrafts && initialDrafts.length > 0 ? initialDrafts : [newShiftDraft()];
  });
  const [hoursPerDay, setHoursPerDay] = useState<number | undefined>(
    template ? (template.kind === 'Other' ? template.hoursPerDay : undefined) : initialAbsence?.hoursPerDay,
  );
  const [halfDay, setHalfDay] = useState<VacationHalfDay | undefined>(
    template ? (template.kind === 'Vacation' ? template.halfDay : undefined) : initialAbsence?.halfDay,
  );
  // Entered in hours like every other hours field, stored in minutes like Absence's own override.
  const [creditedHours, setCreditedHours] = useState<number | undefined>(() => {
    const minutes =
      template
        ? 'creditedMinutesOverride' in template
          ? template.creditedMinutesOverride
          : undefined
        : initialAbsence?.creditedMinutesOverride;
    return minutes === undefined ? undefined : minutesToDecimalHours(minutes);
  });
  const creditedMinutesOverride = creditedHours === undefined ? undefined : Math.round(creditedHours * 60);
  const [saving, setSaving] = useState(false);
  // Drafts are raw input strings, so comparing the serialized fields is enough.
  const current = JSON.stringify({ kind, name, drafts, hoursPerDay, halfDay, creditedHours });
  const [initialState] = useState(current);
  const { requestClose, confirmDialog } = useDiscardConfirm(current !== initialState, saving ? undefined : onClose);

  const changeKind = (next: TemplateKind) => {
    if (!name.trim() || name === defaultName(kind)) {
      setName(defaultName(next));
    }
    setKind(next);
  };

  // Other-kind templates use the single "Bezeichnung" field for both the toolbar tile's own name
  // AND the absence's label applied to a day - asking for the same text twice would be pointless
  // friction, unlike the other kinds where the name is toolbar-only organization and never appears
  // on the day itself (the shift times or the absence type do).
  const validation = useFormValidation<string>(() => {
    if (kind === 'Shift') {
      return [
        ...validateShiftTemplate({ kind: 'Shift', name, shiftCount: drafts.length }),
        // validateShiftDrafts reports an empty list on the same field, so that one message is
        // dropped here - the template rule above already covers it and two identical texts would
        // be noise.
        ...validateShiftDrafts(drafts).filter((e) => e.field !== SHIFT_LIST_FIELD),
      ];
    }
    if (kind === 'Other') {
      // The 'label' field error is always identical to the 'name' one here (same value) - dropped
      // the same way the Shift-kind branch above drops validateShiftDrafts' duplicate message.
      return validateShiftTemplate({ kind: 'Other', name, label: name, hoursPerDay }).filter((e) => e.field !== 'label');
    }
    return validateShiftTemplate({ kind, name, creditedMinutesOverride });
  });

  /** The kind's own fields. Built from scratch rather than spread over `template`: the kind may have
   * changed while editing, and spreading would leave the old kind's fields (a stale label, shifts)
   * on the persisted object even though TypeScript no longer names them. */
  const kindFields = (trimmedName: string) => {
    switch (kind) {
      case 'Shift':
        return { kind, shifts: shiftDraftsToShifts(drafts) };
      case 'Other':
        return { kind, label: trimmedName, hoursPerDay };
      case 'Vacation':
        return { kind, halfDay, creditedMinutesOverride };
      default:
        return { kind, creditedMinutesOverride };
    }
  };

  const save = async () => {
    if (!validation.submit()) return;
    const trimmedName = name.trim();

    setSaving(true);
    try {
      const fields = kindFields(trimmedName);
      if (template) {
        await services.shiftTemplate.update({
          id: template.id,
          branchId: template.branchId,
          createdAt: template.createdAt,
          updatedAt: template.updatedAt,
          name: trimmedName,
          ...fields,
        });
      } else {
        await services.shiftTemplate.create({ branchId, name: trimmedName, ...fields });
      }
      onClose();
      await onSaved();
    } catch (e) {
      onError(e, t('templateSaveError'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ResponsiveDialog
      open
      onClose={requestClose}
      title={template ? t('templateDialogTitleEdit') : t('templateDialogTitleNew')}
      contentRef={validation.containerRef}
      actions={
        <>
          <FormErrorNotice errors={validation.errors} />
          <Button onClick={requestClose} disabled={saving}>
            {tCommon('cancel')}
          </Button>
          <Button
            variant="contained"
            onClick={save}
            disabled={saving}
            startIcon={saving ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            {tCommon('save')}
          </Button>
        </>
      }
    >
      <RequiredLegend />
        <Stack spacing={2} sx={{ mt: 1 }}>
          <ToggleButtonGroup
            value={kind}
            exclusive
            onChange={(_e, value: TemplateKind | null) => value && changeKind(value)}
            aria-label={t('templateKindAriaLabel')}
            size="small"
            sx={entryTypeToggleSx(isMobile)}
          >
            <ToggleButton value="Shift">{t('arbeitszeitOption')}</ToggleButton>
            <ToggleButton value="Other">{t('otherKindOption')}</ToggleButton>
            <ToggleButton value="Vacation">{tCommon('absenceKind.vacation')}</ToggleButton>
            <ToggleButton value="Illness">{tCommon('absenceKind.illness')}</ToggleButton>
            <ToggleButton value="PublicHoliday">{tCommon('absenceKind.publicHoliday')}</ToggleButton>
          </ToggleButtonGroup>
          <TextField
            label={t('labelFieldLabel')}
            required
            placeholder={t('templateNamePlaceholder')}
            value={name}
            onChange={(e) => setName(e.target.value)}
            fullWidth
            {...validation.fieldProps('name')}
          />
          {kind === 'Shift' && (
            <ShiftListEditor drafts={drafts} onChange={setDrafts} fieldProps={validation.fieldProps} />
          )}
          {kind === 'Other' && (
            <DecimalTextField
              label={t('hoursOptionalLabel')}
              value={hoursPerDay}
              onChange={setHoursPerDay}
              sx={{ width: 200 }}
              helperText={t('templateHoursHint')}
              {...validation.fieldProps('hoursPerDay')}
            />
          )}
          {kind === 'Vacation' && (
            // Same radio group and wording as the Abwesenheiten dialog's half day.
            <FormControl>
              <FormLabel id="template-half-day-label">{tAbsences('dialog.halfDayGroupLabel')}</FormLabel>
              <RadioGroup
                row
                aria-labelledby="template-half-day-label"
                value={halfDay ?? 'full'}
                onChange={(e) => setHalfDay(e.target.value === 'full' ? undefined : (e.target.value as VacationHalfDay))}
              >
                <FormControlLabel value="full" control={<Radio />} label={tAbsences('dialog.halfDayNone')} />
                <FormControlLabel value="morning" control={<Radio />} label={tAbsences('dialog.halfDayMorningCheckbox')} />
                <FormControlLabel value="afternoon" control={<Radio />} label={tAbsences('dialog.halfDayAfternoonCheckbox')} />
              </RadioGroup>
            </FormControl>
          )}
          {isCreditedKind(kind) && (
            <DecimalTextField
              label={t('dayEditorCreditedHoursLabel')}
              value={creditedHours}
              onChange={setCreditedHours}
              sx={{ maxWidth: 280 }}
              // Always shrunk, same reason as in DayEditor: the label is wider than the field.
              slotProps={{ inputLabel: { shrink: true } }}
              {...validation.fieldProps('creditedMinutesOverride', t('dayEditorCreditedHoursHint'))}
            />
          )}
        </Stack>
      {confirmDialog}
    </ResponsiveDialog>
  );
}
