import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Divider from '@mui/material/Divider';
import Alert from '@mui/material/Alert';
import type { ShiftDraft } from '@domain/schedule/shiftDraft';
import {
  NET_OVERRIDE_FIELD,
  newShiftDraft,
  shiftDraftsToShifts,
  shiftToDraft,
  validateNetMinutesOverride,
  validateShiftDrafts,
} from '@domain/schedule/shiftDraft';
import type { DayEntry } from '@domain/schedule/EmployeeWeekAssignment';
import { shiftNetMinutes, minutesToDecimalHours, formatHoursGerman } from '@domain/schedule/scheduleCalculation';
import type { Absence, AbsenceType } from '@domain/absence/Absence';
import { absenceKindLabel } from '@domain/absence/Absence';
import { formatISODateGerman } from '@domain/shared/DateFormat';
import type { Weekday } from '@domain/shared/CalendarWeek';
import { CREDITED_OVERRIDE_FIELD, validateAbsence } from '@domain/absence/absenceValidation';
import type { EmployeeId } from '@domain/shared/ids';
import { validateBreaks } from '@domain/validation/arbzg/breakValidation';
import { validateShiftDuration } from '@domain/validation/arbzg/shiftDurationValidation';
import { validateDailyWorkingTime } from '@domain/validation/arbzg/maxWorkingTimeValidation';
import {
  validateYouthDailyWorkingTime,
  validateYouthBreaks,
  validateYouthShiftSpan,
  validateYouthNightWork,
  validateYouthSundayWork,
  validateChildEmploymentBan,
} from '@domain/validation/arbzg/youthProtection';
import { useFormValidation } from '@ui/hooks/useFormValidation';
import { ConfirmDialog } from '@ui/components/ConfirmDialog';
import { DecimalTextField } from '@ui/components/DecimalTextField';
import { RequiredLegend } from '@ui/components/RequiredLegend';
import { FormErrorNotice } from '@ui/components/FormErrorNotice';
import { ResponsiveDialog } from '@ui/components/ResponsiveDialog';
import { ShiftListEditor } from './ShiftListEditor';

type Mode = 'Off' | 'Shift' | AbsenceType;

/** Extra fields "Sonstige" and the credited-hours variants carry. The label is always a
 * non-empty, trimmed string here (validated before saving) for "Sonstige"; hoursPerDay is
 * optional and counts towards the employee's own weekly hours, never towards the branch total.
 * creditedMinutesOverride (in minutes) is only meaningful for Vacation/Illness/PublicHoliday -
 * it replaces the automatically calculated credited hours for that day. */
export interface AbsenceDetails {
  label?: string;
  hoursPerDay?: number;
  creditedMinutesOverride?: number;
}

interface DayEditorProps {
  open: boolean;
  onClose: () => void;
  /** Saving a Shift/Off entry also clears a single-day Absence on that cell - handled by the
   * parent, which records both as one undoable step. */
  onSave: (entry: DayEntry) => void;
  onAbsenceSave: (type: AbsenceType, details?: AbsenceDetails) => void;
  employeeId: EmployeeId;
  employeeName: string;
  day: Weekday;
  date: string;
  entry: DayEntry;
  absence?: Absence;
  /** Only relevant for the youth-protection live check below; omitted entirely for an employee
   * with no birth date on file, same as everywhere else in the app (see Employee.birthDate). */
  birthDate?: string;
}

export function DayEditor({
  open,
  onClose,
  onSave,
  onAbsenceSave,
  employeeId,
  employeeName,
  day,
  date,
  entry,
  absence,
  birthDate,
}: DayEditorProps) {
  const { t } = useTranslation('schedule');
  const { t: tCommon } = useTranslation();
  const [mode, setMode] = useState<Mode>('Off');
  // Raw input values (see shiftDraft.ts): a cleared time field stays empty and gets marked,
  // instead of being parsed away on every keystroke.
  const [drafts, setDrafts] = useState<ShiftDraft[]>([]);
  const [label, setLabel] = useState('');
  const [hoursPerDay, setHoursPerDay] = useState<number | undefined>(undefined);
  // Manual correction of the whole day's net hours. Empty means "use the calculated value".
  const [netOverrideHours, setNetOverrideHours] = useState<number | undefined>(undefined);
  // Manual correction of the day's credited hours (Vacation/Illness/PublicHoliday only). Kept in
  // hours here, same as netOverrideHours, and converted to minutes right before saving.
  const [creditedHoursOverride, setCreditedHoursOverride] = useState<number | undefined>(undefined);
  const [showConfirmation, setShowConfirmation] = useState(false);

  const isSingleDayAbsence = !!absence && absence.from === date && absence.to === date;
  const isMultiDayAbsence = !!absence && !isSingleDayAbsence;

  const validation = useFormValidation<string>(() => [
    ...(mode === 'Other'
      ? validateAbsence({ employeeId, type: 'Other', from: date, to: date, label, hoursPerDay })
      : []),
    ...(mode === 'Vacation' || mode === 'Illness' || mode === 'PublicHoliday'
      ? validateAbsence({
          employeeId,
          type: mode,
          from: date,
          to: date,
          creditedMinutesOverride:
            creditedHoursOverride !== undefined ? Math.round(creditedHoursOverride * 60) : undefined,
        })
      : []),
    ...(mode === 'Shift' ? validateShiftDrafts(drafts) : []),
    ...(mode === 'Shift' ? validateNetMinutesOverride(netOverrideHours) : []),
  ]);
  const { reset: resetValidation } = validation;

  useEffect(() => {
    if (!open) return;
    resetValidation();

    setNetOverrideHours(
      entry.type === 'Shift' && entry.netMinutesOverride !== undefined
        ? minutesToDecimalHours(entry.netMinutesOverride)
        : undefined,
    );

    if (isSingleDayAbsence && absence) {
      setMode(absence.type);
      setLabel(absence.type === 'Other' ? absence.label : '');
      setHoursPerDay(absence.type === 'Other' ? absence.hoursPerDay : undefined);
      setCreditedHoursOverride(
        absence.type !== 'Other' && absence.creditedMinutesOverride !== undefined
          ? minutesToDecimalHours(absence.creditedMinutesOverride)
          : undefined,
      );
      setDrafts(entry.type === 'Shift' ? entry.shifts.map(shiftToDraft) : []);
    } else if (entry.type === 'Shift' && entry.shifts.length > 0) {
      setMode('Shift');
      setDrafts(entry.shifts.map(shiftToDraft));
      setLabel('');
      setHoursPerDay(undefined);
      setCreditedHoursOverride(undefined);
    } else {
      // Free day: suggest work time with a default shift right away instead of
      // showing "Off" first, saving a click for new entries. If the user cancels, the day stays
      // free since nothing is saved here.
      setMode('Shift');
      setDrafts([newShiftDraft()]);
      setLabel('');
      setHoursPerDay(undefined);
      setCreditedHoursOverride(undefined);
    }
    // Deliberately excludes `resetValidation`: useFormValidation returns a fresh `reset` closure
    // every render (not memoized, see its own comment), so listing it here would either re-run
    // this effect every render or require memoizing the hook for no real benefit - this effect
    // only needs to run again when the dialog reopens for a (possibly different) day.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, entry, absence, date, isSingleDayAbsence]);

  // Only complete drafts can be checked against ArbZG rules; while a field is still empty the
  // field validation below blocks saving anyway.
  const parsedShifts = useMemo(
    () => (mode === 'Shift' && validateShiftDrafts(drafts).length === 0 ? shiftDraftsToShifts(drafts) : null),
    [mode, drafts],
  );

  // Live-validates the draft shifts against ArbZG rules before saving, so a clear legal violation
  // (severity "error") requires explicit confirmation - checked against the in-progress edit,
  // not the stale results from before the dialog opened.
  //
  // Includes the day-scoped JArbSchG youth checks alongside the adult ones, for the same reason:
  // without them, a pure youth-protection violation (e.g. a minor scheduled past 20:00) saved
  // silently and only turned up red afterwards via the post-save week validation. Deliberately
  // mirrors the adult set's own scope, not all of youthProtection.ts: validateYouthWeeklyWorkingTime
  // and validateYouthRestPeriodSequence need the whole week's minutes / cross-week shift sequence,
  // neither of which this single-day editor has (same reason validateWeeklyWorkingTime and the
  // async rest-period check aren't in the adult list above either).
  const liveErrors = useMemo(() => {
    if (!parsedShifts) return [];
    const context = { employeeId, date };
    const netMinutes = parsedShifts.reduce((sum, s) => sum + shiftNetMinutes(s), 0);
    return [
      ...parsedShifts.flatMap((s) => validateShiftDuration(s, context)),
      ...validateBreaks(parsedShifts, context),
      ...validateDailyWorkingTime(netMinutes, context),
      ...parsedShifts.flatMap((s) => validateYouthNightWork(s, birthDate, context)),
      ...validateYouthBreaks(parsedShifts, birthDate, context),
      ...validateYouthShiftSpan(parsedShifts, birthDate, context),
      ...validateYouthDailyWorkingTime(netMinutes, birthDate, context),
      ...validateYouthSundayWork(date, day, birthDate, { employeeId }),
      ...validateChildEmploymentBan(date, birthDate, { employeeId }),
    ].filter((e) => e.severity === 'error');
  }, [parsedShifts, employeeId, date, day, birthDate]);

  const actuallySave = () => {
    if (mode === 'Off') {
      onSave({ type: 'Off' });
    } else if (mode === 'Shift') {
      if (!parsedShifts) return;
      onSave({
        type: 'Shift',
        shifts: parsedShifts,
        // Spread instead of an explicit undefined, so a day without a correction stores no key at all.
        ...(netOverrideHours !== undefined
          ? { netMinutesOverride: Math.round(netOverrideHours * 60) }
          : {}),
      });
    } else if (mode === 'Other') {
      onAbsenceSave(mode, { label: label.trim(), hoursPerDay });
    } else {
      // Vacation | Illness | PublicHoliday
      onAbsenceSave(
        mode,
        creditedHoursOverride !== undefined
          ? { creditedMinutesOverride: Math.round(creditedHoursOverride * 60) }
          : undefined,
      );
    }
    onClose();
  };

  const save = () => {
    // Empty or invalid fields block saving and are shown at the field (unlike ArbZG results,
    // which never block and only ask for confirmation below).
    if (!validation.submit()) return;
    if (liveErrors.length > 0) {
      setShowConfirmation(true);
      return;
    }
    actuallySave();
  };

  if (isMultiDayAbsence && absence) {
    return (
      <ResponsiveDialog
        open={open}
        onClose={onClose}
        title={t('dialogTitle', { name: employeeName, day })}
        subtitle={formatISODateGerman(date)}
        maxWidth="sm"
        actions={null}
      >
        <Alert severity="info">
          {t('multiDayAbsenceAlert', {
            name: employeeName,
            kind: absenceKindLabel(absence.type),
            from: formatISODateGerman(absence.from),
            to: formatISODateGerman(absence.to),
          })}
        </Alert>
      </ResponsiveDialog>
    );
  }

  const calculatedNetText = parsedShifts
    ? formatHoursGerman(parsedShifts.reduce((sum, shift) => sum + shiftNetMinutes(shift), 0))
    : '–';

  return (
    <>
      <ResponsiveDialog
        open={open}
        onClose={onClose}
        title={t('dialogTitle', { name: employeeName, day })}
        subtitle={formatISODateGerman(date)}
        maxWidth="sm"
        contentRef={validation.containerRef}
        actions={
          <>
            <FormErrorNotice errors={validation.errors} />
            <Button onClick={onClose}>{tCommon('cancel')}</Button>
            <Button variant="contained" onClick={save}>
              {tCommon('save')}
            </Button>
          </>
        }
      >
        <ToggleButtonGroup
          exclusive
          value={mode}
          onChange={(_, value) => value && setMode(value)}
          size="small"
          aria-label={t('entryTypeAriaLabel')}
          sx={{ mb: 2, display: 'flex', '& .MuiToggleButton-root': { flex: 1, minWidth: 0 } }}
        >
          <ToggleButton value="Off">{t('offMenuItem')}</ToggleButton>
          <ToggleButton value="Shift">{t('arbeitszeitOption')}</ToggleButton>
          <ToggleButton value="Vacation">{tCommon('absenceKind.vacation')}</ToggleButton>
          <ToggleButton value="Illness">{tCommon('absenceKind.illness')}</ToggleButton>
          <ToggleButton value="PublicHoliday">{tCommon('absenceKind.publicHoliday')}</ToggleButton>
          <ToggleButton value="Other">{tCommon('absenceKind.other')}</ToggleButton>
        </ToggleButtonGroup>

        {(mode === 'Shift' || mode === 'Other') && <RequiredLegend />}

        {mode === 'Off' && (
          <Typography variant="body2" color="text.secondary">
            {t('offDayText', { name: employeeName })}
          </Typography>
        )}

        {mode === 'Vacation' && (
          <Alert severity="info" sx={{ mb: 2 }}>
            {t('vacationAlert', { name: employeeName, date: formatISODateGerman(date) })}
          </Alert>
        )}

        {mode === 'Illness' && (
          <Alert severity="info" sx={{ mb: 2 }}>
            {t('illnessAlert', { name: employeeName, date: formatISODateGerman(date) })}
          </Alert>
        )}

        {mode === 'PublicHoliday' && (
          <Alert severity="info" sx={{ mb: 2 }}>
            {t('publicHolidayAlert', { name: employeeName, date: formatISODateGerman(date) })}
          </Alert>
        )}

        {(mode === 'Vacation' || mode === 'Illness' || mode === 'PublicHoliday') && (
          <DecimalTextField
            label={t('dayEditorCreditedHoursLabel')}
            value={creditedHoursOverride}
            onChange={setCreditedHoursOverride}
            sx={{ maxWidth: 280, mb: 2 }}
            {...validation.fieldProps(CREDITED_OVERRIDE_FIELD, t('dayEditorCreditedHoursHint'))}
          />
        )}

        {mode === 'Other' && (
          <Stack direction="row" spacing={2} alignItems="flex-start" sx={{ mb: 2 }}>
            <TextField
              label={t('labelFieldLabel')}
              required
              placeholder={t('dayEditorLabelPlaceholder')}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              fullWidth
              {...validation.fieldProps('label', t('dayEditorLabelHint', { name: employeeName, date: formatISODateGerman(date) }))}
            />
            <DecimalTextField
              label={t('hoursOptionalLabel')}
              value={hoursPerDay}
              onChange={setHoursPerDay}
              sx={{ width: 200 }}
              {...validation.fieldProps('hoursPerDay', t('dayEditorHoursHint'))}
            />
          </Stack>
        )}

        {mode === 'Shift' && (
          <Stack spacing={2}>
            <ShiftListEditor drafts={drafts} onChange={setDrafts} fieldProps={validation.fieldProps} />

            <Divider />
            <DecimalTextField
              label={t('netHoursLabel')}
              value={netOverrideHours}
              onChange={setNetOverrideHours}
              sx={{ maxWidth: 280 }}
              {...validation.fieldProps(NET_OVERRIDE_FIELD, t('netHoursHint', { hours: calculatedNetText }))}
            />
          </Stack>
        )}
      </ResponsiveDialog>

      <ConfirmDialog
        open={showConfirmation}
        title={t('arbzgViolationTitle')}
        text={t('arbzgViolationText', { messages: liveErrors.map((e) => e.message).join(' ') })}
        confirmText={t('saveAnywayButton')}
        dangerous
        onConfirm={() => {
          setShowConfirmation(false);
          actuallySave();
        }}
        onCancel={() => setShowConfirmation(false)}
      />
    </>
  );
}
