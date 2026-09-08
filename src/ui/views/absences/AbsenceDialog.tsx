import { useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import Alert from '@mui/material/Alert';
import type { EmployeeId } from '@domain/shared/ids';
import type { Employee } from '@domain/employee/Employee';
import { fullName } from '@domain/employee/Employee';
import { validateAbsence } from '@domain/absence/absenceValidation';
import type { AbsenceField } from '@domain/absence/absenceValidation';
import { services } from '@infrastructure/services';
import { useFormValidation } from '@ui/hooks/useFormValidation';
import { DecimalTextField } from '@ui/components/DecimalTextField';
import { RequiredLegend } from '@ui/components/RequiredLegend';
import { FormErrorNotice } from '@ui/components/FormErrorNotice';

type AbsenceType = 'Vacation' | 'Illness' | 'Other';

interface FormState {
  employeeId: string;
  type: AbsenceType;
  from: string;
  to: string;
  label: string;
  hoursPerDay: number | undefined;
  note: string;
  halfDayAtStart: boolean;
  halfDayAtEnd: boolean;
}

function emptyForm(firstEmployeeId: string): FormState {
  const today = new Date().toISOString().slice(0, 10);
  return {
    employeeId: firstEmployeeId,
    type: 'Vacation',
    from: today,
    to: today,
    label: '',
    hoursPerDay: undefined,
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
      // Lets the domain reject a range outside the employee's Eintritt/Austritt at the field,
      // instead of an inline guard here (see the forms section of src/ui/CLAUDE.md).
      employment: selectedEmployee
        ? { entryDate: selectedEmployee.entryDate, exitDate: selectedEmployee.exitDate }
        : undefined,
    }),
  );

  const singleDay = form.from === form.to;

  const save = async () => {
    if (!validation.submit()) return;
    const employeeId = form.employeeId as EmployeeId;

    try {
      if (form.type === 'Vacation') {
        const halfDay =
          form.halfDayAtStart || form.halfDayAtEnd ? { atStart: form.halfDayAtStart, atEnd: form.halfDayAtEnd } : undefined;
        await services.absence.create({ employeeId, type: 'Vacation', from: form.from, to: form.to, halfDay, note: form.note || undefined });
      } else if (form.type === 'Illness') {
        await services.absence.create({ employeeId, type: 'Illness', from: form.from, to: form.to });
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
    }
  };

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Abwesenheit erfassen</DialogTitle>
      <DialogContent ref={validation.containerRef}>
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
            <MenuItem value="Other">Sonstige</MenuItem>
          </TextField>
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
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <FormErrorNotice errors={validation.errors} />
        <Button onClick={onClose}>Abbrechen</Button>
        <Button variant="contained" onClick={save}>
          Speichern
        </Button>
      </DialogActions>
    </Dialog>
  );
}
