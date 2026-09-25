import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import FormControlLabel from '@mui/material/FormControlLabel';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import FormControl from '@mui/material/FormControl';
import FormLabel from '@mui/material/FormLabel';
import Alert from '@mui/material/Alert';
import type { EmployeeId } from '@domain/shared/ids';
import { toISODate, formatISODateGerman } from '@domain/shared/DateFormat';
import type { Employee } from '@domain/employee/Employee';
import { fullName } from '@domain/employee/Employee';
import type { Absence, AbsenceInput, AbsenceType } from '@domain/absence/Absence';
import { absenceTypeLabel } from '@domain/absence/Absence';
import { CREDITED_OVERRIDE_FIELD, validateAbsence } from '@domain/absence/absenceValidation';
import type { AbsenceField } from '@domain/absence/absenceValidation';
import { findConflictingAbsences } from '@domain/absence/absenceOverlap';
import { services } from '@infrastructure/services';
import { useFormValidation } from '@ui/hooks/useFormValidation';
import { DecimalTextField } from '@ui/components/DecimalTextField';
import { RequiredLegend } from '@ui/components/RequiredLegend';
import { FormErrorNotice } from '@ui/components/FormErrorNotice';
import CircularProgress from '@mui/material/CircularProgress';
import { ResponsiveDialog } from '@ui/components/ResponsiveDialog';
import { useDiscardConfirm } from '@ui/hooks/useDiscardConfirm';
import { ConfirmDialog } from '@ui/components/ConfirmDialog';
import { useBreakpoint } from '@ui/hooks/useBreakpoint';

/** "Urlaub (01.06.2026 – 05.06.2026)": names one absence, for the conflict and delete questions. */
export function formatAbsenceEntry(a: Absence): string {
  const range =
    a.from === a.to ? formatISODateGerman(a.from) : `${formatISODateGerman(a.from)} – ${formatISODateGerman(a.to)}`;
  return `${absenceTypeLabel(a)} (${range})`;
}

interface FormState {
  employeeId: string;
  type: AbsenceType;
  from: string;
  to: string;
  label: string;
  hoursPerDay: number | undefined;
  /** Vacation/Illness/PublicHoliday only: replaces the automatically calculated credited hours
   * for every day of the range. Kept in hours here, converted to minutes right before saving. */
  creditedHoursOverride: number | undefined;
  note: string;
  halfDayAtStart: boolean;
  halfDayAtEnd: boolean;
}

function emptyForm(firstEmployeeId: string): FormState {
  // toISODate, not toISOString(): the latter is UTC, so during German summer time it would
  // prefill tomorrow's date for anyone opening the dialog after 22:00 local.
  const today = toISODate(new Date());
  return {
    employeeId: firstEmployeeId,
    type: 'Vacation',
    from: today,
    to: today,
    label: '',
    hoursPerDay: undefined,
    creditedHoursOverride: undefined,
    note: '',
    halfDayAtStart: false,
    halfDayAtEnd: false,
  };
}

function formFromAbsence(absence: Absence): FormState {
  return {
    employeeId: absence.employeeId,
    type: absence.type,
    from: absence.from,
    to: absence.to,
    label: absence.type === 'Other' ? absence.label : '',
    hoursPerDay: absence.type === 'Other' ? absence.hoursPerDay : undefined,
    creditedHoursOverride:
      absence.type !== 'Other' && absence.creditedMinutesOverride !== undefined
        ? absence.creditedMinutesOverride / 60
        : undefined,
    // Other carries a note too (domain-wise), even though today's dialog has no UI field to edit it
    // while Sonstige is selected - prefilling it here means an unrelated edit (e.g. just the dates)
    // roundtrips an existing Other's note unchanged instead of silently dropping it.
    note: (absence.type === 'Vacation' || absence.type === 'Other') && absence.note ? absence.note : '',
    halfDayAtStart: absence.type === 'Vacation' ? !!absence.halfDay?.atStart : false,
    halfDayAtEnd: absence.type === 'Vacation' ? !!absence.halfDay?.atEnd : false,
  };
}

interface AbsenceDialogProps {
  /** Active employees of the selected branch, first one preselected. */
  employees: Employee[];
  /** Every absence of the branch (all employees, all years) - used only to warn about a plausible
   * double-booking, never to restrict what can be entered. */
  absences: Absence[];
  /** null creates a new absence, otherwise the given one is edited. */
  absence: Absence | null;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
  onError: (e: unknown, context?: string) => void;
}

/** "Abwesenheit erfassen"/"Abwesenheit bearbeiten" dialog. Mounted only while open, so the form and
 * the validation's "already tried to save" flag start fresh each time. Field rules come from
 * validateAbsence - deliberately not re-applied stricter on edit than on create (see
 * domain/CLAUDE.md's "update paths ... deliberately do NOT re-validate" rule). */
export function AbsenceDialog({ employees, absences, absence, onClose, onSaved, onError }: AbsenceDialogProps) {
  const isMobile = useBreakpoint() === 'mobile';
  const { t } = useTranslation('absences');
  const { t: tCommon } = useTranslation();
  const [form, setForm] = useState<FormState>(() => (absence ? formFromAbsence(absence) : emptyForm(employees[0]?.id ?? '')));
  const selectedEmployee = employees.find((emp) => emp.id === form.employeeId);
  const validation = useFormValidation<AbsenceField>(() =>
    validateAbsence({
      employeeId: form.employeeId,
      type: form.type,
      from: form.from,
      to: form.to,
      label: form.label,
      hoursPerDay: form.hoursPerDay,
      creditedMinutesOverride:
        form.creditedHoursOverride !== undefined ? Math.round(form.creditedHoursOverride * 60) : undefined,
      // Lets the domain reject a range outside the employee's Eintritt/Austritt at the field,
      // instead of an inline guard here (see the forms section of src/ui/CLAUDE.md).
      employment: selectedEmployee
        ? { entryDate: selectedEmployee.entryDate, exitDate: selectedEmployee.exitDate }
        : undefined,
    }),
  );

  const singleDay = form.from === form.to;

  // The half-day checkboxes are only rendered for a single-day Vacation (see below). Once the
  // range becomes multi-day they disappear, but without this the checked value would silently
  // survive in state and still be submitted on save - reset it the moment singleDay turns false.
  useEffect(() => {
    if (singleDay) return;
    setForm((f) => (f.halfDayAtStart || f.halfDayAtEnd ? { ...f, halfDayAtStart: false, halfDayAtEnd: false } : f));
  }, [singleDay]);

  // The note field is only rendered for Vacation (see below); Sonstige's own note is domain-real
  // but has no editing UI here (see formFromAbsence's comment) and Illness/PublicHoliday never save
  // one at all. Without this, a note typed while Vacation was selected would silently survive a
  // switch to Sonstige and get saved under it (M16) - the leak this specifically guards against.
  // Keyed on the ACTUAL transition (was Vacation, now isn't), not "currently isn't Vacation": the
  // latter would also fire on the very first render whenever editing an existing non-Vacation
  // absence, wiping the exact prefilled note formFromAbsence deliberately roundtrips unchanged.
  const previousTypeRef = useRef(form.type);
  useEffect(() => {
    const wasVacation = previousTypeRef.current === 'Vacation';
    previousTypeRef.current = form.type;
    if (wasVacation && form.type !== 'Vacation') {
      setForm((f) => (f.note ? { ...f, note: '' } : f));
    }
  }, [form.type]);

  const [saving, setSaving] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  // A flat form of strings/numbers/booleans, so comparing the serialized form is enough.
  const [initialForm] = useState(() => JSON.stringify(form));
  const { requestClose, confirmDialog } = useDiscardConfirm(
    JSON.stringify(form) !== initialForm,
    saving ? undefined : onClose,
  );

  // Deliberately NOT the raw findOverlappingAbsences: a single-day absence intentionally nested
  // inside a longer one (e.g. a Feiertag inside a booked Urlaubswoche) is an established, valid
  // pattern and must not require a confirmation click every time (see absenceOverlap.ts).
  const conflicts = useMemo(
    () =>
      findConflictingAbsences(
        { employeeId: form.employeeId as EmployeeId, from: form.from, to: form.to },
        absences,
        absence?.id,
      ),
    [form.employeeId, form.from, form.to, absences, absence?.id],
  );

  const actuallySave = async () => {
    const employeeId = form.employeeId as EmployeeId;

    setSaving(true);
    try {
      const creditedMinutesOverride =
        form.creditedHoursOverride !== undefined ? Math.round(form.creditedHoursOverride * 60) : undefined;
      let fields: AbsenceInput;
      if (form.type === 'Vacation') {
        const halfDay =
          form.halfDayAtStart || form.halfDayAtEnd ? { atStart: form.halfDayAtStart, atEnd: form.halfDayAtEnd } : undefined;
        fields = {
          employeeId,
          type: 'Vacation',
          from: form.from,
          to: form.to,
          halfDay,
          note: form.note || undefined,
          creditedMinutesOverride,
        };
      } else if (form.type === 'Illness') {
        fields = { employeeId, type: 'Illness', from: form.from, to: form.to, creditedMinutesOverride };
      } else if (form.type === 'PublicHoliday') {
        fields = { employeeId, type: 'PublicHoliday', from: form.from, to: form.to, creditedMinutesOverride };
      } else {
        fields = {
          employeeId,
          type: 'Other',
          from: form.from,
          to: form.to,
          label: form.label.trim(),
          hoursPerDay: form.hoursPerDay,
          note: form.note || undefined,
        };
      }

      if (absence) {
        await services.absence.update({ ...fields, id: absence.id, createdAt: absence.createdAt } as Absence);
      } else {
        await services.absence.create(fields);
      }
      onClose();
      await onSaved();
    } catch (e) {
      onError(e, t('dialog.saveError'));
    } finally {
      setSaving(false);
    }
  };

  const save = () => {
    if (!validation.submit()) return;
    if (conflicts.length > 0) {
      setShowConfirmation(true);
      return;
    }
    void actuallySave();
  };

  return (
    <>
    <ResponsiveDialog
      open
      onClose={requestClose}
      title={absence ? t('dialog.titleEdit') : t('dialog.titleNew')}
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
          <TextField
            select
            label={t('employeeLabel')}
            required
            value={form.employeeId}
            onChange={(e) => setForm((f) => ({ ...f, employeeId: e.target.value }))}
            fullWidth
            {...validation.fieldProps('employeeId')}
          >
            {employees.map((emp) => (
              <MenuItem key={emp.id} value={emp.id}>
                {fullName(emp)}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label={t('typeLabel')}
            required
            value={form.type}
            onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as AbsenceType }))}
            fullWidth
          >
            <MenuItem value="Vacation">{tCommon('absenceKind.vacation')}</MenuItem>
            <MenuItem value="Illness">{tCommon('absenceKind.illness')}</MenuItem>
            <MenuItem value="PublicHoliday">{tCommon('absenceKind.publicHoliday')}</MenuItem>
            <MenuItem value="Other">{tCommon('absenceKind.other')}</MenuItem>
          </TextField>
          {(form.type === 'Vacation' || form.type === 'Illness' || form.type === 'PublicHoliday') && (
            <DecimalTextField
              label={t('dialog.creditedHoursLabel')}
              value={form.creditedHoursOverride}
              onChange={(value) => setForm((f) => ({ ...f, creditedHoursOverride: value }))}
              sx={{ width: 280 }}
              // Always shrunk: resting, an outlined label only gets the field width minus 24px, and
              // this one (314px) was cut off in the 280px field.
              slotProps={{ inputLabel: { shrink: true } }}
              {...validation.fieldProps(CREDITED_OVERRIDE_FIELD, t('dialog.creditedHoursHint'))}
            />
          )}
          {form.type === 'Other' && (
            // Stacked on a phone: next to a fixed 220px hours field the required Bezeichnung got
            // ~100px, and the hours label was cut off.
            <Stack direction={isMobile ? 'column' : 'row'} spacing={2} alignItems={isMobile ? 'stretch' : 'flex-start'}>
              <TextField
                label={t('dialog.labelLabel')}
                required
                placeholder={t('dialog.labelPlaceholder')}
                value={form.label}
                onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                fullWidth
                {...validation.fieldProps('label')}
              />
              <DecimalTextField
                label={t('dialog.hoursPerDayLabel')}
                value={form.hoursPerDay}
                onChange={(value) => setForm((f) => ({ ...f, hoursPerDay: value }))}
                sx={isMobile ? undefined : { width: 220 }}
                fullWidth={isMobile}
                {...validation.fieldProps('hoursPerDay', t('dialog.hoursPerDayHint'))}
              />
            </Stack>
          )}
          <Stack direction="row" spacing={2} alignItems="flex-start">
            <TextField
              label={t('dialog.fromLabel')}
              type="date"
              required
              value={form.from}
              onChange={(e) => setForm((f) => ({ ...f, from: e.target.value }))}
              InputLabelProps={{ shrink: true }}
              fullWidth
              {...validation.fieldProps('from')}
            />
            <TextField
              label={t('dialog.toLabel')}
              type="date"
              required
              value={form.to}
              onChange={(e) => setForm((f) => ({ ...f, to: e.target.value }))}
              InputLabelProps={{ shrink: true }}
              fullWidth
              {...validation.fieldProps('to')}
            />
          </Stack>
          {form.type === 'Vacation' && singleDay && (
            // One radio group, not two checkboxes that cleared each other: that behaved like radios but
            // was announced as two independent choices. The data model keeps its two flags.
            <FormControl>
              <FormLabel id="absence-half-day-label">{t('dialog.halfDayGroupLabel')}</FormLabel>
              <RadioGroup
                row
                aria-labelledby="absence-half-day-label"
                value={form.halfDayAtStart ? 'morning' : form.halfDayAtEnd ? 'afternoon' : 'full'}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    halfDayAtStart: e.target.value === 'morning',
                    halfDayAtEnd: e.target.value === 'afternoon',
                  }))
                }
              >
                <FormControlLabel value="full" control={<Radio />} label={t('dialog.halfDayNone')} />
                <FormControlLabel value="morning" control={<Radio />} label={t('dialog.halfDayMorningCheckbox')} />
                <FormControlLabel value="afternoon" control={<Radio />} label={t('dialog.halfDayAfternoonCheckbox')} />
              </RadioGroup>
            </FormControl>
          )}
          {form.type === 'Vacation' && (
            <TextField
              label={t('dialog.noteLabel')}
              value={form.note}
              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
              fullWidth
              multiline
              minRows={2}
            />
          )}
          {form.type === 'Illness' && <Alert severity="info">{t('dialog.illnessNotice')}</Alert>}
        </Stack>
      {confirmDialog}
    </ResponsiveDialog>

    <ConfirmDialog
      open={showConfirmation}
      title={t('dialog.conflictTitle')}
      text={t('dialog.conflictText', { conflicts: conflicts.map(formatAbsenceEntry).join(', ') })}
      confirmText={t('dialog.conflictConfirmButton')}
      onConfirm={() => {
        setShowConfirmation(false);
        void actuallySave();
      }}
      onCancel={() => setShowConfirmation(false)}
    />
    </>
  );
}
