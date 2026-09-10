import { useEffect, useMemo, useState } from 'react';
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
import { shiftNetMinutes, minutesToDecimalHours } from '@domain/schedule/scheduleCalculation';
import type { Absence } from '@domain/absence/Absence';
import { formatISODateGerman } from '@domain/shared/DateFormat';
import { CREDITED_OVERRIDE_FIELD, validateAbsence } from '@domain/absence/absenceValidation';
import type { EmployeeId } from '@domain/shared/ids';
import { validateBreaks } from '@domain/validation/arbzg/breakValidation';
import { validateShiftDuration } from '@domain/validation/arbzg/shiftDurationValidation';
import { validateDailyWorkingTime } from '@domain/validation/arbzg/maxWorkingTimeValidation';
import { useFormValidation } from '@ui/hooks/useFormValidation';
import { ConfirmDialog } from '@ui/components/ConfirmDialog';
import { DecimalTextField } from '@ui/components/DecimalTextField';
import { RequiredLegend } from '@ui/components/RequiredLegend';
import { FormErrorNotice } from '@ui/components/FormErrorNotice';
import { ResponsiveDialog } from '@ui/components/ResponsiveDialog';
import { ShiftListEditor } from './ShiftListEditor';

type Mode = 'Off' | 'Shift' | 'Vacation' | 'Illness' | 'PublicHoliday' | 'Other';

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
  onAbsenceSave: (type: 'Vacation' | 'Illness' | 'PublicHoliday' | 'Other', details?: AbsenceDetails) => void;
  employeeId: EmployeeId;
  employeeName: string;
  day: string;
  date: string;
  entry: DayEntry;
  absence?: Absence;
}

function absenceTypeLabel(type: Absence['type']): string {
  switch (type) {
    case 'Vacation':
      return 'Urlaub';
    case 'Illness':
      return 'Krankheit';
    case 'PublicHoliday':
      return 'Feiertag';
    case 'Other':
      return 'Sonstige';
  }
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
}: DayEditorProps) {
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
  const liveErrors = useMemo(() => {
    if (!parsedShifts) return [];
    const context = { employeeId, date };
    const netMinutes = parsedShifts.reduce((sum, s) => sum + shiftNetMinutes(s), 0);
    return [
      ...parsedShifts.flatMap((s) => validateShiftDuration(s, context)),
      ...validateBreaks(parsedShifts, context),
      ...validateDailyWorkingTime(netMinutes, context),
    ].filter((e) => e.severity === 'error');
  }, [parsedShifts, employeeId, date]);

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
        title={`${employeeName} · ${day}`}
        subtitle={formatISODateGerman(date)}
        maxWidth="sm"
        actions={<Button onClick={onClose}>Schließen</Button>}
      >
        <Alert severity="info">
          {employeeName} ist an diesem Tag im Rahmen eines mehrtägigen Eintrags ({absenceTypeLabel(absence.type)},{' '}
          {formatISODateGerman(absence.from)} bis {formatISODateGerman(absence.to)}) abwesend. Bitte bearbeite oder lösche diesen Eintrag über den
          Tab „Abwesenheiten“.
        </Alert>
      </ResponsiveDialog>
    );
  }

  const calculatedNetText = parsedShifts
    ? minutesToDecimalHours(parsedShifts.reduce((sum, shift) => sum + shiftNetMinutes(shift), 0)).toLocaleString('de-DE')
    : '–';

  return (
    <>
      <ResponsiveDialog
        open={open}
        onClose={onClose}
        title={`${employeeName} · ${day}`}
        subtitle={formatISODateGerman(date)}
        maxWidth="sm"
        contentRef={validation.containerRef}
        actions={
          <>
            <FormErrorNotice errors={validation.errors} />
            <Button onClick={onClose}>Abbrechen</Button>
            <Button variant="contained" onClick={save}>
              Speichern
            </Button>
          </>
        }
      >
        <ToggleButtonGroup
          exclusive
          value={mode}
          onChange={(_, value) => value && setMode(value)}
          size="small"
          sx={{ mb: 2, display: 'flex', '& .MuiToggleButton-root': { flex: 1 } }}
        >
          <ToggleButton value="Off">Frei</ToggleButton>
          <ToggleButton value="Shift">Arbeitszeit</ToggleButton>
          <ToggleButton value="Vacation">Urlaub</ToggleButton>
          <ToggleButton value="Illness">Krankheit</ToggleButton>
          <ToggleButton value="PublicHoliday">Feiertag</ToggleButton>
          <ToggleButton value="Other">Sonstige</ToggleButton>
        </ToggleButtonGroup>

        {(mode === 'Shift' || mode === 'Other') && <RequiredLegend />}

        {mode === 'Off' && (
          <Typography variant="body2" color="text.secondary">
            {employeeName} ist an diesem Tag nicht eingeplant und hat keinen Eintrag (weder Arbeitszeit noch
            Abwesenheit).
          </Typography>
        )}

        {mode === 'Vacation' && (
          <Alert severity="info" sx={{ mb: 2 }}>
            Trägt für {employeeName} am {formatISODateGerman(date)} einen ganztägigen Urlaubstag ein. Halbtags-Urlaub oder
            mehrtägige Zeiträume lassen sich im Tab „Abwesenheiten“ erfassen.
          </Alert>
        )}

        {mode === 'Illness' && (
          <Alert severity="info" sx={{ mb: 2 }}>
            Trägt für {employeeName} am {formatISODateGerman(date)} einen Krankheitstag ein. Es werden bewusst keine Diagnose- oder
            Gesundheitsdetails erfasst.
          </Alert>
        )}

        {mode === 'PublicHoliday' && (
          <Alert severity="info" sx={{ mb: 2 }}>
            Trägt für {employeeName} am {formatISODateGerman(date)} einen Feiertag ein.
          </Alert>
        )}

        {(mode === 'Vacation' || mode === 'Illness' || mode === 'PublicHoliday') && (
          <DecimalTextField
            label="Angerechnete Stunden manuell (optional)"
            value={creditedHoursOverride}
            onChange={setCreditedHoursOverride}
            sx={{ maxWidth: 280, mb: 2 }}
            {...validation.fieldProps(
              CREDITED_OVERRIDE_FIELD,
              'Ersetzt die automatisch berechneten Stunden (Std. je Feier-/Urlaubstag) für diesen Tag.',
            )}
          />
        )}

        {mode === 'Other' && (
          <Stack direction="row" spacing={2} alignItems="flex-start" sx={{ mb: 2 }}>
            <TextField
              label="Bezeichnung"
              required
              placeholder="z. B. Fortbildung, Feiertag"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              fullWidth
              {...validation.fieldProps('label', `Trägt eine ganztägige Abwesenheit für ${employeeName} am ${formatISODateGerman(date)} ein.`)}
            />
            <DecimalTextField
              label="Stunden (optional)"
              value={hoursPerDay}
              onChange={setHoursPerDay}
              sx={{ width: 200 }}
              {...validation.fieldProps('hoursPerDay', 'Zählen nur für diesen Mitarbeiter.')}
            />
          </Stack>
        )}

        {mode === 'Shift' && (
          <Stack spacing={2}>
            <ShiftListEditor drafts={drafts} onChange={setDrafts} fieldProps={validation.fieldProps} />

            <Divider />
            <DecimalTextField
              label="Netto-Stunden manuell (optional)"
              value={netOverrideHours}
              onChange={setNetOverrideHours}
              sx={{ maxWidth: 280 }}
              {...validation.fieldProps(
                NET_OVERRIDE_FIELD,
                `Ersetzt die berechneten ${calculatedNetText} Std. für diesen Tag. Die Prüfung nach ArbZG bleibt bei den eingetragenen Zeiten.`,
              )}
            />
          </Stack>
        )}
      </ResponsiveDialog>

      <ConfirmDialog
        open={showConfirmation}
        title="Gesetzesverstoß trotzdem speichern?"
        text={`Diese Schicht verstößt gegen das Arbeitszeitgesetz: ${liveErrors.map((e) => e.message).join(' ')}`}
        confirmText="Trotzdem speichern"
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
