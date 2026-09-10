import { useState } from 'react';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import Alert from '@mui/material/Alert';
import type { EmployeeId } from '@domain/shared/ids';
import { toISODate } from '@domain/shared/DateFormat';
import type { Employee } from '@domain/employee/Employee';
import { fullName } from '@domain/employee/Employee';
import { CREDITED_OVERRIDE_FIELD, validateAbsence } from '@domain/absence/absenceValidation';
import type { AbsenceField } from '@domain/absence/absenceValidation';
import { services } from '@infrastructure/services';
import { useFormValidation } from '@ui/hooks/useFormValidation';
import { DecimalTextField } from '@ui/components/DecimalTextField';
import { RequiredLegend } from '@ui/components/RequiredLegend';
import { FormErrorNotice } from '@ui/components/FormErrorNotice';
import CircularProgress from '@mui/material/CircularProgress';
import { ResponsiveDialog } from '@ui/components/ResponsiveDialog';

type AbsenceType = 'Vacation' | 'Illness' | 'PublicHoliday' | 'Other';

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

interface AbsenceDialogProps {
  /** Active employees of the selected branch, first one preselected. */
  employees: Employee[];
  onClose: () => void;
  onSaved: () => void | Promise<void>;
  onError: (e: unknown, context?: string) => void;
}

/** "Abwesenheit erfassen" dialog. Mounted only while open, so the form and the validation's
 * "already tried to save" flag start fresh each time. Field rules come from validateAbsence. */
export function AbsenceDialog({ employees, onClose, onSaved, onError }: AbsenceDialogProps) {
  const [form, setForm] = useState<FormState>(() => emptyForm(employees[0]?.id ?? ''));
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
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!validation.submit()) return;
    const employeeId = form.employeeId as EmployeeId;

    setSaving(true);
    try {
      const creditedMinutesOverride =
        form.creditedHoursOverride !== undefined ? Math.round(form.creditedHoursOverride * 60) : undefined;
      if (form.type === 'Vacation') {
        const halfDay =
          form.halfDayAtStart || form.halfDayAtEnd ? { atStart: form.halfDayAtStart, atEnd: form.halfDayAtEnd } : undefined;
        await services.absence.create({
          employeeId,
          type: 'Vacation',
          from: form.from,
          to: form.to,
          halfDay,
          note: form.note || undefined,
          creditedMinutesOverride,
        });
      } else if (form.type === 'Illness') {
        await services.absence.create({ employeeId, type: 'Illness', from: form.from, to: form.to, creditedMinutesOverride });
      } else if (form.type === 'PublicHoliday') {
        await services.absence.create({ employeeId, type: 'PublicHoliday', from: form.from, to: form.to, creditedMinutesOverride });
      } else {
        await services.absence.create({
          employeeId,
          type: 'Other',
          from: form.from,
          to: form.to,
          label: form.label.trim(),
          hoursPerDay: form.hoursPerDay,
          note: form.note || undefined,
        });
      }
      onClose();
      await onSaved();
    } catch (e) {
      onError(e, 'Abwesenheit konnte nicht gespeichert werden');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ResponsiveDialog
      open
      onClose={saving ? undefined : onClose}
      title="Abwesenheit erfassen"
      contentRef={validation.containerRef}
      actions={
        <>
          <FormErrorNotice errors={validation.errors} />
          <Button onClick={onClose} disabled={saving}>
            Abbrechen
          </Button>
          <Button
            variant="contained"
            onClick={save}
            disabled={saving}
            startIcon={saving ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            Speichern
          </Button>
        </>
      }
    >
      <RequiredLegend />
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            select
            label="Mitarbeiter"
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
            label="Art"
            required
            value={form.type}
            onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as AbsenceType }))}
            fullWidth
          >
            <MenuItem value="Vacation">Urlaub</MenuItem>
            <MenuItem value="Illness">Krankheit</MenuItem>
            <MenuItem value="PublicHoliday">Feiertag</MenuItem>
            <MenuItem value="Other">Sonstige</MenuItem>
          </TextField>
          {(form.type === 'Vacation' || form.type === 'Illness' || form.type === 'PublicHoliday') && (
            <DecimalTextField
              label="Angerechnete Stunden manuell (optional)"
              value={form.creditedHoursOverride}
              onChange={(value) => setForm((f) => ({ ...f, creditedHoursOverride: value }))}
              sx={{ width: 280 }}
              {...validation.fieldProps(
                CREDITED_OVERRIDE_FIELD,
                'Ersetzt die automatisch berechneten Stunden (Std. je Feier-/Urlaubstag) für jeden Tag des Zeitraums.',
              )}
            />
          )}
          {form.type === 'Other' && (
            <Stack direction="row" spacing={2} alignItems="flex-start">
              <TextField
                label="Bezeichnung"
                required
                placeholder="z. B. Fortbildung, Feiertag"
                value={form.label}
                onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                fullWidth
                {...validation.fieldProps('label')}
              />
              <DecimalTextField
                label="Stunden pro Tag (optional)"
                value={form.hoursPerDay}
                onChange={(value) => setForm((f) => ({ ...f, hoursPerDay: value }))}
                sx={{ width: 220 }}
                {...validation.fieldProps('hoursPerDay', 'Zählen nur für diesen Mitarbeiter.')}
              />
            </Stack>
          )}
          <Stack direction="row" spacing={2} alignItems="flex-start">
            <TextField
              label="Von"
              type="date"
              required
              value={form.from}
              onChange={(e) => setForm((f) => ({ ...f, from: e.target.value }))}
              InputLabelProps={{ shrink: true }}
              fullWidth
              {...validation.fieldProps('from')}
            />
            <TextField
              label="Bis"
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
            <Stack direction="row" spacing={2}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={form.halfDayAtStart}
                    onChange={(e) => setForm((f) => ({ ...f, halfDayAtStart: e.target.checked, halfDayAtEnd: false }))}
                  />
                }
                label="Nur vormittags frei"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={form.halfDayAtEnd}
                    onChange={(e) => setForm((f) => ({ ...f, halfDayAtEnd: e.target.checked, halfDayAtStart: false }))}
                  />
                }
                label="Nur nachmittags frei"
              />
            </Stack>
          )}
          {form.type === 'Vacation' && (
            <TextField
              label="Notiz (optional)"
              value={form.note}
              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
              fullWidth
              multiline
              minRows={2}
            />
          )}
          {form.type === 'Illness' && (
            <Alert severity="info">Es werden bewusst keine Diagnose- oder Gesundheitsdetails erfasst.</Alert>
          )}
        </Stack>
    </ResponsiveDialog>
  );
}
