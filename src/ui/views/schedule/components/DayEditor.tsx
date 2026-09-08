import { useEffect, useMemo, useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormHelperText from '@mui/material/FormHelperText';
import Checkbox from '@mui/material/Checkbox';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Divider from '@mui/material/Divider';
import Alert from '@mui/material/Alert';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import AddIcon from '@mui/icons-material/Add';
import type { Shift } from '@domain/schedule/Shift';
import type { ShiftDraft, BreakDraft } from '@domain/schedule/shiftDraft';
import {
  NET_OVERRIDE_FIELD,
  SHIFT_LIST_FIELD,
  breakFieldKey,
  newBreakDraft,
  newShiftDraft,
  shiftDraftsToShifts,
  shiftFieldKey,
  shiftToDraft,
  validateNetMinutesOverride,
  validateShiftDrafts,
} from '@domain/schedule/shiftDraft';
import type { DayEntry } from '@domain/schedule/EmployeeWeekAssignment';
import { shiftNetMinutes, minutesToDecimalHours } from '@domain/schedule/scheduleCalculation';
import type { Absence } from '@domain/absence/Absence';
import { validateAbsence } from '@domain/absence/absenceValidation';
import type { EmployeeId } from '@domain/shared/ids';
import { validateBreaks } from '@domain/validation/arbzg/breakValidation';
import { validateShiftDuration } from '@domain/validation/arbzg/shiftDurationValidation';
import { validateDailyWorkingTime } from '@domain/validation/arbzg/maxWorkingTimeValidation';
import { useFormValidation } from '@ui/hooks/useFormValidation';
import { ConfirmDialog } from '@ui/components/ConfirmDialog';
import { DecimalTextField } from '@ui/components/DecimalTextField';
import { RequiredLegend } from '@ui/components/RequiredLegend';
import { FormErrorNotice } from '@ui/components/FormErrorNotice';

type Mode = 'Off' | 'Shift' | 'Vacation' | 'Illness' | 'Other';

/** Extra fields only "Sonstige" carries. The label is always a non-empty, trimmed string here
 * (validated before saving); hoursPerDay is optional and counts towards the employee's own weekly
 * hours, never towards the branch total. */
export interface AbsenceDetails {
  label?: string;
  hoursPerDay?: number;
}

interface DayEditorProps {
  open: boolean;
  onClose: () => void;
  /** Saving a Shift/Off entry also clears a single-day Absence on that cell - handled by the
   * parent, which records both as one undoable step. */
  onSave: (entry: DayEntry) => void;
  onAbsenceSave: (type: 'Vacation' | 'Illness' | 'Other', details?: AbsenceDetails) => void;
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
    case 'Other':
      return 'Sonstige';
  }
}

/** A single draft parsed on its own, so each shift card can show its net hours while another
 * card is still incomplete. */
function parseShiftDraft(draft: ShiftDraft): Shift | null {
  return validateShiftDrafts([draft]).length === 0 ? shiftDraftsToShifts([draft])[0] : null;
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
  const [showConfirmation, setShowConfirmation] = useState(false);

  const isSingleDayAbsence = !!absence && absence.from === date && absence.to === date;
  const isMultiDayAbsence = !!absence && !isSingleDayAbsence;

  const validation = useFormValidation<string>(() => [
    ...(mode === 'Other'
      ? validateAbsence({ employeeId, type: 'Other', from: date, to: date, label, hoursPerDay })
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
      setDrafts(entry.type === 'Shift' ? entry.shifts.map(shiftToDraft) : []);
    } else if (entry.type === 'Shift' && entry.shifts.length > 0) {
      setMode('Shift');
      setDrafts(entry.shifts.map(shiftToDraft));
      setLabel('');
      setHoursPerDay(undefined);
    } else {
      // Free day: suggest work time with a default shift right away instead of
      // showing "Off" first, saving a click for new entries. If the user cancels, the day stays
      // free since nothing is saved here.
      setMode('Shift');
      setDrafts([newShiftDraft()]);
      setLabel('');
      setHoursPerDay(undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, entry, absence, date, isSingleDayAbsence]);

  const addShift = () => setDrafts((list) => [...list, newShiftDraft()]);
  const removeShift = (id: string) => setDrafts((list) => list.filter((s) => s.id !== id));
  const updateShift = (id: string, change: Partial<ShiftDraft>) =>
    setDrafts((list) => list.map((s) => (s.id === id ? { ...s, ...change } : s)));

  const addBreak = (shiftId: string) =>
    setDrafts((list) => list.map((s) => (s.id === shiftId ? { ...s, breaks: [...s.breaks, newBreakDraft()] } : s)));
  const removeBreak = (shiftId: string, breakId: string) =>
    setDrafts((list) =>
      list.map((s) => (s.id === shiftId ? { ...s, breaks: s.breaks.filter((b) => b.id !== breakId) } : s)),
    );
  const updateBreak = (shiftId: string, breakId: string, change: Partial<BreakDraft>) =>
    setDrafts((list) =>
      list.map((s) =>
        s.id === shiftId ? { ...s, breaks: s.breaks.map((b) => (b.id === breakId ? { ...b, ...change } : b)) } : s,
      ),
    );

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
      onAbsenceSave(mode);
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
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogTitle>
          {employeeName} · {day}
          <Typography variant="body2" color="text.secondary">
            {date}
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Alert severity="info">
            {employeeName} ist an diesem Tag im Rahmen eines mehrtägigen Eintrags ({absenceTypeLabel(absence.type)},{' '}
            {absence.from} bis {absence.to}) abwesend. Bitte bearbeite oder lösche diesen Eintrag über den
            Tab „Abwesenheiten“.
          </Alert>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onClose}>Schließen</Button>
        </DialogActions>
      </Dialog>
    );
  }

  const shiftListError = validation.fieldProps(SHIFT_LIST_FIELD);
  const calculatedNetText = parsedShifts
    ? minutesToDecimalHours(parsedShifts.reduce((sum, shift) => sum + shiftNetMinutes(shift), 0)).toLocaleString('de-DE')
    : '–';

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {employeeName} · {day}
        <Typography variant="body2" color="text.secondary">
          {date}
        </Typography>
      </DialogTitle>
      <DialogContent ref={validation.containerRef}>
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
            Trägt für {employeeName} am {date} einen ganztägigen Urlaubstag ein. Halbtags-Urlaub oder
            mehrtägige Zeiträume lassen sich im Tab „Abwesenheiten“ erfassen.
          </Alert>
        )}

        {mode === 'Illness' && (
          <Alert severity="info" sx={{ mb: 2 }}>
            Trägt für {employeeName} am {date} einen Krankheitstag ein. Es werden bewusst keine Diagnose- oder
            Gesundheitsdetails erfasst.
          </Alert>
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
              {...validation.fieldProps('label', `Trägt eine ganztägige Abwesenheit für ${employeeName} am ${date} ein.`)}
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
            {drafts.map((shift, index) => {
              const parsed = parseShiftDraft(shift);
              const netText = parsed ? minutesToDecimalHours(shiftNetMinutes(parsed)).toLocaleString('de-DE') : '–';
              return (
                <Stack key={shift.id} spacing={1.5} sx={{ p: 2, border: '1px solid #e0e0dc', borderRadius: 2 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="subtitle2">
                      Schicht {index + 1} · {netText} Std. netto
                    </Typography>
                    {drafts.length > 1 && (
                      <IconButton size="small" onClick={() => removeShift(shift.id)} aria-label="Schicht entfernen">
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    )}
                  </Stack>

                  <Stack direction="row" spacing={2} alignItems="flex-start">
                    <TextField
                      label="Beginn"
                      type="time"
                      required
                      value={shift.start}
                      onChange={(e) => updateShift(shift.id, { start: e.target.value })}
                      InputLabelProps={{ shrink: true }}
                      fullWidth
                      {...validation.fieldProps(shiftFieldKey(shift.id, 'start'))}
                    />
                    <TextField
                      label="Ende"
                      type="time"
                      required
                      value={shift.end}
                      onChange={(e) => updateShift(shift.id, { end: e.target.value })}
                      InputLabelProps={{ shrink: true }}
                      fullWidth
                      {...validation.fieldProps(shiftFieldKey(shift.id, 'end'))}
                    />
                  </Stack>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={shift.endsNextDay}
                        onChange={(e) => updateShift(shift.id, { endsNextDay: e.target.checked })}
                      />
                    }
                    label="Ende liegt am Folgetag (Nachtschicht)"
                  />

                  <Divider />
                  <Typography variant="body2" fontWeight={500}>
                    Pausen
                  </Typography>
                  {shift.breaks.length === 0 && (
                    <Typography variant="body2" color="text.secondary">
                      Keine Pause eingetragen.
                    </Typography>
                  )}
                  {shift.breaks.map((brk) => (
                    <Stack key={brk.id} direction="row" spacing={1.5} alignItems="flex-start">
                      <TextField
                        label="Beginn (optional)"
                        type="time"
                        size="small"
                        value={brk.start}
                        onChange={(e) => updateBreak(shift.id, brk.id, { start: e.target.value })}
                        InputLabelProps={{ shrink: true }}
                        sx={{ width: 170 }}
                        {...validation.fieldProps(breakFieldKey(brk.id, 'start'))}
                      />
                      <DecimalTextField
                        label="Dauer (Min.)"
                        size="small"
                        required
                        value={brk.durationMinutes}
                        onChange={(value) => updateBreak(shift.id, brk.id, { durationMinutes: value })}
                        sx={{ width: 140 }}
                        {...validation.fieldProps(breakFieldKey(brk.id, 'durationMinutes'))}
                      />
                      <IconButton size="small" onClick={() => removeBreak(shift.id, brk.id)} aria-label="Pause entfernen" sx={{ mt: 0.5 }}>
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </Stack>
                  ))}
                  <Button size="small" startIcon={<AddIcon />} onClick={() => addBreak(shift.id)} sx={{ alignSelf: 'flex-start' }}>
                    Pause hinzufügen
                  </Button>
                </Stack>
              );
            })}

            {shiftListError.error && <FormHelperText error>{shiftListError.helperText}</FormHelperText>}
            <Button size="small" startIcon={<AddIcon />} onClick={addShift} sx={{ alignSelf: 'flex-start' }}>
              {drafts.length === 0 ? 'Schicht hinzufügen' : 'Weitere Schicht hinzufügen (Split-Shift)'}
            </Button>

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
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <FormErrorNotice errors={validation.errors} />
        <Button onClick={onClose}>Abbrechen</Button>
        <Button variant="contained" onClick={save}>
          Speichern
        </Button>
      </DialogActions>

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
    </Dialog>
  );
}
