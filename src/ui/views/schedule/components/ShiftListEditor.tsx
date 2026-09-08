import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Divider from '@mui/material/Divider';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormHelperText from '@mui/material/FormHelperText';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import AddIcon from '@mui/icons-material/Add';
import type { Shift } from '@domain/schedule/Shift';
import type { ShiftDraft, BreakDraft } from '@domain/schedule/shiftDraft';
import {
  SHIFT_LIST_FIELD,
  breakFieldKey,
  newBreakDraft,
  newShiftDraft,
  shiftDraftsToShifts,
  shiftFieldKey,
  validateShiftDrafts,
} from '@domain/schedule/shiftDraft';
import { shiftNetMinutes, minutesToDecimalHours } from '@domain/schedule/scheduleCalculation';
import type { FieldValidationProps } from '@ui/hooks/useFormValidation';
import { DecimalTextField } from '@ui/components/DecimalTextField';

interface ShiftListEditorProps {
  drafts: ShiftDraft[];
  onChange: (drafts: ShiftDraft[]) => void;
  /** The fieldProps function from useFormValidation, so the owning dialog keeps one validation run
   * across its own fields and the shifts. */
  fieldProps: (field: string, defaultHelperText?: string) => FieldValidationProps;
}

/** A single draft parsed on its own, so each shift card can show its net hours while another
 * card is still incomplete. */
function parseShiftDraft(draft: ShiftDraft): Shift | null {
  return validateShiftDrafts([draft]).length === 0 ? shiftDraftsToShifts([draft])[0] : null;
}

/**
 * The shift list with its breaks, shared by the Tageseditor and the shift-template dialog - both
 * edit exactly the same thing, one for a concrete day and one for a reusable template.
 *
 * Returns a Fragment on purpose, not its own wrapper element: the cards have to stay DIRECT
 * children of the caller's Stack, otherwise that Stack's spacing no longer applies and the layout
 * shifts.
 *
 * Deliberately does NOT contain the "Netto-Stunden manuell" override: that corrects one specific
 * day and has no meaning for a template.
 */
export function ShiftListEditor({ drafts, onChange, fieldProps }: ShiftListEditorProps) {
  const addShift = () => onChange([...drafts, newShiftDraft()]);
  const removeShift = (id: string) => onChange(drafts.filter((s) => s.id !== id));
  const updateShift = (id: string, change: Partial<ShiftDraft>) =>
    onChange(drafts.map((s) => (s.id === id ? { ...s, ...change } : s)));

  const addBreak = (shiftId: string) =>
    onChange(drafts.map((s) => (s.id === shiftId ? { ...s, breaks: [...s.breaks, newBreakDraft()] } : s)));
  const removeBreak = (shiftId: string, breakId: string) =>
    onChange(
      drafts.map((s) => (s.id === shiftId ? { ...s, breaks: s.breaks.filter((b) => b.id !== breakId) } : s)),
    );
  const updateBreak = (shiftId: string, breakId: string, change: Partial<BreakDraft>) =>
    onChange(
      drafts.map((s) =>
        s.id === shiftId ? { ...s, breaks: s.breaks.map((b) => (b.id === breakId ? { ...b, ...change } : b)) } : s,
      ),
    );

  const shiftListError = fieldProps(SHIFT_LIST_FIELD);

  return (
    <>
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
                {...fieldProps(shiftFieldKey(shift.id, 'start'))}
              />
              <TextField
                label="Ende"
                type="time"
                required
                value={shift.end}
                onChange={(e) => updateShift(shift.id, { end: e.target.value })}
                InputLabelProps={{ shrink: true }}
                fullWidth
                {...fieldProps(shiftFieldKey(shift.id, 'end'))}
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
                  {...fieldProps(breakFieldKey(brk.id, 'start'))}
                />
                <DecimalTextField
                  label="Dauer (Min.)"
                  size="small"
                  required
                  value={brk.durationMinutes}
                  onChange={(value) => updateBreak(shift.id, brk.id, { durationMinutes: value })}
                  sx={{ width: 140 }}
                  {...fieldProps(breakFieldKey(brk.id, 'durationMinutes'))}
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
    </>
  );
}
