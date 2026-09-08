import { useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Autocomplete from '@mui/material/Autocomplete';
import Stack from '@mui/material/Stack';
import type { BranchId } from '@domain/shared/ids';
import type { Employee } from '@domain/employee/Employee';
import type { EmploymentType } from '@domain/employee/EmploymentType';
import { validateEmployee } from '@domain/employee/employeeValidation';
import type { EmployeeField, EmploymentTypeDraft } from '@domain/employee/employeeValidation';
import { JOB_TITLE_SUGGESTIONS } from '@domain/employee/jobTitleSuggestions';
import { services } from '@infrastructure/services';
import { useFormValidation } from '@ui/hooks/useFormValidation';
import { DecimalTextField } from '@ui/components/DecimalTextField';
import { RequiredLegend } from '@ui/components/RequiredLegend';
import { FormErrorNotice } from '@ui/components/FormErrorNotice';

type EmploymentTypeSelection = 'FullTime' | 'PartTime' | 'Minijob';

interface FormState {
  lastName: string;
  firstName: string;
  jobTitle: string;
  type: EmploymentTypeSelection;
  weeklyHours: number | undefined;
  minHours: number | undefined;
  maxHours: number | undefined;
  vacationEntitlementPerYear: number | undefined;
  birthDate: string;
}

function emptyForm(): FormState {
  return {
    lastName: '',
    firstName: '',
    jobTitle: '',
    type: 'PartTime',
    weeklyHours: undefined,
    minHours: undefined,
    maxHours: undefined,
    vacationEntitlementPerYear: 28,
    birthDate: '',
  };
}

function formFromEmployee(emp: Employee): FormState {
  const et = emp.employmentType;
  return {
    lastName: emp.lastName,
    firstName: emp.firstName,
    jobTitle: emp.jobTitle,
    type: et.type,
    weeklyHours: et.type !== 'Minijob' ? et.weeklyHours : undefined,
    minHours: et.type === 'Minijob' ? et.minHours : undefined,
    maxHours: et.type === 'Minijob' ? et.maxHours : undefined,
    vacationEntitlementPerYear: emp.vacationEntitlementPerYear,
    birthDate: emp.birthDate ?? '',
  };
}

function employmentTypeDraft(form: FormState): EmploymentTypeDraft {
  return form.type === 'Minijob'
    ? { type: 'Minijob', minHours: form.minHours, maxHours: form.maxHours }
    : { type: form.type, weeklyHours: form.weeklyHours };
}

/** Only called after validateEmployee passed, which guarantees every number is present. */
function toEmploymentType(form: FormState): EmploymentType {
  return form.type === 'Minijob'
    ? { type: 'Minijob', minHours: form.minHours!, maxHours: form.maxHours! }
    : { type: form.type, weeklyHours: form.weeklyHours! };
}

interface EmployeeDialogProps {
  branchId: BranchId;
  /** null creates a new employee, otherwise the given one is edited. */
  employee: Employee | null;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
  onError: (e: unknown, context?: string) => void;
}

/** Create/edit dialog for an employee. Mounted only while open (the parent renders it
 * conditionally), so form state and the "already tried to save" flag start fresh every time.
 * Field rules come from validateEmployee in the domain; see useFormValidation for the UX. */
export function EmployeeDialog({ branchId, employee, onClose, onSaved, onError }: EmployeeDialogProps) {
  const [form, setForm] = useState<FormState>(() => (employee ? formFromEmployee(employee) : emptyForm()));
  const [saving, setSaving] = useState(false);
  const validation = useFormValidation<EmployeeField>(() =>
    validateEmployee({
      firstName: form.firstName,
      lastName: form.lastName,
      jobTitle: form.jobTitle,
      employmentType: employmentTypeDraft(form),
      vacationEntitlementPerYear: form.vacationEntitlementPerYear,
    }),
  );

  const save = async () => {
    if (!validation.submit()) return;

    const details = {
      lastName: form.lastName.trim(),
      firstName: form.firstName.trim(),
      jobTitle: form.jobTitle.trim(),
      employmentType: toEmploymentType(form),
      vacationEntitlementPerYear: form.vacationEntitlementPerYear!,
      birthDate: form.birthDate || undefined,
    };

    setSaving(true);
    try {
      if (employee) {
        await services.employee.update({ ...employee, ...details });
      } else {
        await services.employee.create({ branchId, ...details });
      }
      onClose();
      await onSaved();
    } catch (e) {
      onError(e, 'Mitarbeiter konnte nicht gespeichert werden');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{employee ? 'Mitarbeiter bearbeiten' : 'Neuer Mitarbeiter'}</DialogTitle>
      <DialogContent ref={validation.containerRef}>
        <RequiredLegend />
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Stack direction="row" spacing={2}>
            <TextField
              label="Vorname"
              required
              value={form.firstName}
              onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
              fullWidth
              {...validation.fieldProps('firstName')}
            />
            <TextField
              label="Nachname"
              required
              value={form.lastName}
              onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
              fullWidth
              {...validation.fieldProps('lastName')}
            />
          </Stack>

          <Autocomplete
            freeSolo
            options={[...JOB_TITLE_SUGGESTIONS]}
            value={form.jobTitle}
            onInputChange={(_, value) => setForm((f) => ({ ...f, jobTitle: value }))}
            renderInput={(params) => <TextField {...params} label="Tätigkeit" required {...validation.fieldProps('jobTitle')} />}
          />

          <TextField
            select
            label="Beschäftigungsart"
            required
            value={form.type}
            onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as EmploymentTypeSelection }))}
          >
            <MenuItem value="FullTime">Vollzeit</MenuItem>
            <MenuItem value="PartTime">Teilzeit</MenuItem>
            <MenuItem value="Minijob">Geringfügig beschäftigt (Minijob)</MenuItem>
          </TextField>

          {form.type === 'Minijob' ? (
            <Stack direction="row" spacing={2}>
              <DecimalTextField
                label="Min. Std./Woche"
                required
                value={form.minHours}
                onChange={(value) => setForm((f) => ({ ...f, minHours: value }))}
                fullWidth
                {...validation.fieldProps('minHours')}
              />
              <DecimalTextField
                label="Max. Std./Woche"
                required
                value={form.maxHours}
                onChange={(value) => setForm((f) => ({ ...f, maxHours: value }))}
                fullWidth
                {...validation.fieldProps('maxHours')}
              />
            </Stack>
          ) : (
            <DecimalTextField
              label="Wochenstunden"
              required
              value={form.weeklyHours}
              onChange={(value) => setForm((f) => ({ ...f, weeklyHours: value }))}
              fullWidth
              {...validation.fieldProps('weeklyHours')}
            />
          )}

          <Stack direction="row" spacing={2}>
            <DecimalTextField
              label="Urlaubsanspruch/Jahr (Tage)"
              required
              value={form.vacationEntitlementPerYear}
              onChange={(value) => setForm((f) => ({ ...f, vacationEntitlementPerYear: value }))}
              fullWidth
              {...validation.fieldProps('vacationEntitlementPerYear')}
            />
            <TextField
              label="Geburtsdatum (optional)"
              type="date"
              value={form.birthDate}
              onChange={(e) => setForm((f) => ({ ...f, birthDate: e.target.value }))}
              InputLabelProps={{ shrink: true }}
              helperText="Nur für Jugendarbeitsschutz relevant"
              fullWidth
            />
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <FormErrorNotice errors={validation.errors} />
        <Button onClick={onClose}>Abbrechen</Button>
        <Button variant="contained" onClick={save} disabled={saving}>
          Speichern
        </Button>
      </DialogActions>
    </Dialog>
  );
}
