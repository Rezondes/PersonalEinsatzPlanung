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
import Checkbox from '@mui/material/Checkbox';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Divider from '@mui/material/Divider';
import Alert from '@mui/material/Alert';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import AddIcon from '@mui/icons-material/Add';
import type { Shift } from '@domain/schedule/Shift';
import { createShift } from '@domain/schedule/Shift';
import { createBreak } from '@domain/schedule/Break';
import { parseClockTime, clockTime } from '@domain/shared/ClockTime';
import type { DayEntry } from '@domain/schedule/EmployeeWeekAssignment';
import { shiftNetMinutes, minutesToDecimalHours } from '@domain/schedule/scheduleCalculation';
import type { Absence } from '@domain/absence/Absence';
import type { EmployeeId } from '@domain/shared/ids';
import { validateBreaks } from '@domain/validation/arbzg/breakValidation';
import { validateShiftDuration } from '@domain/validation/arbzg/shiftDurationValidation';
import { validateDailyWorkingTime } from '@domain/validation/arbzg/maxWorkingTimeValidation';
import { ConfirmDialog } from '@ui/components/ConfirmDialog';
import { DecimalTextField } from '@ui/components/DecimalTextField';

type Mode = 'Off' | 'Shift' | 'Vacation' | 'Illness' | 'Other';

interface DayEditorProps {
  open: boolean;
  onClose: () => void;
  onSave: (entry: DayEntry) => void;
  onAbsenceSave: (type: 'Vacation' | 'Illness' | 'Other', label?: string) => void;
  onAbsenceDelete: () => void;
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

export function DayEditor({
  open,
  onClose,
  onSave,
  onAbsenceSave,
  onAbsenceDelete,
  employeeId,
  employeeName,
  day,
  date,
  entry,
  absence,
}: DayEditorProps) {
  const [mode, setMode] = useState<Mode>('Off');
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [label, setLabel] = useState('');
  const [showConfirmation, setShowConfirmation] = useState(false);

  const isSingleDayAbsence = !!absence && absence.from === date && absence.to === date;
  const isMultiDayAbsence = !!absence && !isSingleDayAbsence;

  useEffect(() => {
    if (!open) return;

    if (isSingleDayAbsence && absence) {
      setMode(absence.type);
      setLabel(absence.type === 'Other' ? absence.label : '');
      setShifts(entry.type === 'Shift' ? entry.shifts.map((s) => ({ ...s, breaks: [...s.breaks] })) : []);
    } else if (entry.type === 'Shift' && entry.shifts.length > 0) {
      setMode('Shift');
      setShifts(entry.shifts.map((s) => ({ ...s, breaks: [...s.breaks] })));
      setLabel('');
    } else {
      // Free day: suggest work time with a default shift right away instead of
      // showing "Off" first, saving a click for new entries. If the user cancels, the day stays
      // free since nothing is saved here.
      setMode('Shift');
      setShifts([createShift(clockTime('06:00'), clockTime('14:00'))]);
      setLabel('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, entry, absence, date, isSingleDayAbsence]);

  const addShift = () => {
    setShifts((list) => [...list, createShift(parseClockTime('06:00')!, parseClockTime('14:00')!)]);
  };

  const removeShift = (id: string) => {
    setShifts((list) => list.filter((s) => s.id !== id));
  };

  const updateShift = (id: string, change: Partial<Shift>) => {
    setShifts((list) => list.map((s) => (s.id === id ? { ...s, ...change } : s)));
  };

  const addBreak = (shiftId: string) => {
    setShifts((list) =>
      list.map((s) => (s.id === shiftId ? { ...s, breaks: [...s.breaks, createBreak(30)] } : s)),
    );
  };

  const removeBreak = (shiftId: string, breakId: string) => {
    setShifts((list) =>
      list.map((s) => (s.id === shiftId ? { ...s, breaks: s.breaks.filter((b) => b.id !== breakId) } : s)),
    );
  };

  const updateBreak = (shiftId: string, breakId: string, change: { durationMinutes?: number; start?: string }) => {
    setShifts((list) =>
      list.map((s) =>
        s.id === shiftId
          ? {
              ...s,
              breaks: s.breaks.map((b) => {
                if (b.id !== breakId) return b;
                const start = change.start !== undefined ? parseClockTime(change.start) ?? undefined : b.start;
                return { ...b, durationMinutes: change.durationMinutes ?? b.durationMinutes, start };
              }),
            }
          : s,
      ),
    );
  };

  // Live-validates the draft shifts against ArbZG rules before saving, so a clear legal violation
  // (severity "error") requires explicit confirmation - checked against the in-progress edit,
  // not the stale results from before the dialog opened.
  const liveErrors = useMemo(() => {
    if (mode !== 'Shift') return [];
    const context = { employeeId, date };
    const netMinutes = shifts.reduce((sum, s) => sum + shiftNetMinutes(s), 0);
    return [
      ...shifts.flatMap((s) => validateShiftDuration(s, context)),
      ...validateBreaks(shifts, context),
      ...validateDailyWorkingTime(netMinutes, context),
    ].filter((e) => e.severity === 'error');
  }, [mode, shifts, employeeId, date]);

  const actuallySave = () => {
    if (mode === 'Off') {
      if (isSingleDayAbsence) onAbsenceDelete();
      onSave({ type: 'Off' });
    } else if (mode === 'Shift') {
      if (isSingleDayAbsence) onAbsenceDelete();
      onSave({ type: 'Shift', shifts });
    } else {
      onAbsenceSave(mode, mode === 'Other' ? label || 'Sonstige Abwesenheit' : undefined);
    }
    onClose();
  };

  const save = () => {
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

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {employeeName} · {day}
        <Typography variant="body2" color="text.secondary">
          {date}
        </Typography>
      </DialogTitle>
      <DialogContent>
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
          <TextField
            label="Bezeichnung"
            placeholder="z. B. Fortbildung, Sonderurlaub"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            helperText={`Trägt eine ganztägige Abwesenheit für ${employeeName} am ${date} ein.`}
            fullWidth
            sx={{ mb: 2 }}
          />
        )}

        {mode === 'Shift' && (
          <Stack spacing={2}>
            {shifts.map((shift, index) => {
              const netMinutes = shiftNetMinutes(shift);
              return (
                <Stack key={shift.id} spacing={1.5} sx={{ p: 2, border: '1px solid #e0e0dc', borderRadius: 2 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="subtitle2">
                      Schicht {index + 1} · {minutesToDecimalHours(netMinutes).toLocaleString('de-DE')} Std. netto
                    </Typography>
                    {shifts.length > 1 && (
                      <IconButton size="small" onClick={() => removeShift(shift.id)} aria-label="Schicht entfernen">
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    )}
                  </Stack>

                  <Stack direction="row" spacing={2}>
                    <TextField
                      label="Beginn"
                      type="time"
                      value={shift.start}
                      onChange={(e) => {
                        const value = parseClockTime(e.target.value);
                        if (value) updateShift(shift.id, { start: value });
                      }}
                      InputLabelProps={{ shrink: true }}
                      fullWidth
                    />
                    <TextField
                      label="Ende"
                      type="time"
                      value={shift.end}
                      onChange={(e) => {
                        const value = parseClockTime(e.target.value);
                        if (value) updateShift(shift.id, { end: value });
                      }}
                      InputLabelProps={{ shrink: true }}
                      fullWidth
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
                    <Stack key={brk.id} direction="row" spacing={1.5} alignItems="center">
                      <TextField
                        label="Beginn (optional)"
                        type="time"
                        size="small"
                        value={brk.start ?? ''}
                        onChange={(e) => updateBreak(shift.id, brk.id, { start: e.target.value })}
                        InputLabelProps={{ shrink: true }}
                        sx={{ width: 170 }}
                      />
                      <DecimalTextField
                        label="Dauer (Min.)"
                        size="small"
                        value={brk.durationMinutes}
                        onChange={(value) => updateBreak(shift.id, brk.id, { durationMinutes: value ?? 0 })}
                        sx={{ width: 140 }}
                      />
                      <IconButton size="small" onClick={() => removeBreak(shift.id, brk.id)} aria-label="Pause entfernen">
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

            <Button size="small" startIcon={<AddIcon />} onClick={addShift} sx={{ alignSelf: 'flex-start' }}>
              {shifts.length === 0 ? 'Schicht hinzufügen' : 'Weitere Schicht hinzufügen (Split-Shift)'}
            </Button>
          </Stack>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
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
