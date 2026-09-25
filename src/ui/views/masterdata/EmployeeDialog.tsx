import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Autocomplete from '@mui/material/Autocomplete';
import Stack from '@mui/material/Stack';
import CircularProgress from '@mui/material/CircularProgress';
import type { BranchId } from '@domain/shared/ids';
import type { Employee } from '@domain/employee/Employee';
import type { EmploymentType, EmploymentTypeKind } from '@domain/employee/EmploymentType';
import { employmentTypeLabel } from '@domain/employee/EmploymentType';
import { validateEmployee } from '@domain/employee/employeeValidation';
import type { EmployeeField, EmploymentTypeDraft } from '@domain/employee/employeeValidation';
import { JOB_TITLE_SUGGESTIONS } from '@domain/employee/jobTitleSuggestions';
import { services } from '@infrastructure/services';
import { useFormValidation } from '@ui/hooks/useFormValidation';
import { DecimalTextField } from '@ui/components/DecimalTextField';
import { RequiredLegend } from '@ui/components/RequiredLegend';
import { FormErrorNotice } from '@ui/components/FormErrorNotice';
import { ResponsiveDialog } from '@ui/components/ResponsiveDialog';
import { useBreakpoint } from '@ui/hooks/useBreakpoint';
import { useDiscardConfirm } from '@ui/hooks/useDiscardConfirm';
import type { RowAction } from '@ui/components/ResponsiveList/RowAction';

interface FormState {
  lastName: string;
  firstName: string;
  jobTitle: string;
  type: EmploymentTypeKind;
  weeklyHours: number | undefined;
  minHours: number | undefined;
  maxHours: number | undefined;
  maxMonthlyHours: number | undefined;
  vacationEntitlementPerYear: number | undefined;
  holidayVacationHours: number | undefined;
  birthDate: string;
  entryDate: string;
  exitDate: string;
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
    maxMonthlyHours: undefined,
    vacationEntitlementPerYear: 28,
    holidayVacationHours: undefined,
    birthDate: '',
    entryDate: '',
    exitDate: '',
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
    maxMonthlyHours: et.type === 'Minijob' ? et.maxMonthlyHours : undefined,
    vacationEntitlementPerYear: emp.vacationEntitlementPerYear,
    holidayVacationHours: emp.holidayVacationHours,
    birthDate: emp.birthDate ?? '',
    entryDate: emp.entryDate ?? '',
    exitDate: emp.exitDate ?? '',
  };
}

function employmentTypeDraft(form: FormState): EmploymentTypeDraft {
  return form.type === 'Minijob'
    ? { type: 'Minijob', minHours: form.minHours, maxHours: form.maxHours, maxMonthlyHours: form.maxMonthlyHours }
    : { type: form.type, weeklyHours: form.weeklyHours };
}

/** Only called after validateEmployee passed, which guarantees every number is present -
 * maxMonthlyHours is the one exception, since it stays optional even then. Guards instead of a
 * bare non-null assertion: a future change to validateEmployee's rules that loosened this
 * guarantee would otherwise silently save a Minijob/weeklyHours with a missing number instead of
 * failing loudly right where the broken assumption is made (N14). */
function toEmploymentType(form: FormState): EmploymentType {
  if (form.type === 'Minijob') {
    if (form.minHours === undefined || form.maxHours === undefined) {
      throw new Error('toEmploymentType: minHours/maxHours missing despite passed validation');
    }
    return { type: 'Minijob', minHours: form.minHours, maxHours: form.maxHours, maxMonthlyHours: form.maxMonthlyHours };
  }
  if (form.weeklyHours === undefined) {
    throw new Error('toEmploymentType: weeklyHours missing despite passed validation');
  }
  return { type: form.type, weeklyHours: form.weeklyHours };
}

interface EmployeeDialogProps {
  branchId: BranchId;
  /** null creates a new employee, otherwise the given one is edited. */
  employee: Employee | null;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
  onError: (e: unknown, context?: string) => void;
  /** The same RowAction[] EmployeeMasterDataView already builds for its long-press sheet (minus
   * "Bearbeiten" - already inside this dialog), rendered as "Weitere Aktionen" on mobile/tablet.
   * Omitted (undefined) while creating a new employee - there's no status to toggle yet. */
  secondaryActions?: RowAction[];
}

/** Create/edit dialog for an employee. Mounted only while open (the parent renders it
 * conditionally), so form state and the "already tried to save" flag start fresh every time.
 * Field rules come from validateEmployee in the domain; see useFormValidation for the UX. */
export function EmployeeDialog({ branchId, employee, onClose, onSaved, onError, secondaryActions }: EmployeeDialogProps) {
  const { t } = useTranslation('masterdata');
  const { t: tCommon } = useTranslation();
  const isMobile = useBreakpoint() === 'mobile';
  const [form, setForm] = useState<FormState>(() => (employee ? formFromEmployee(employee) : emptyForm()));
  const [saving, setSaving] = useState(false);
  // A flat form of strings/numbers, so comparing the serialized form is enough.
  const [initialForm] = useState(() => JSON.stringify(form));
  const dirty = JSON.stringify(form) !== initialForm;
  const { requestClose, confirmDialog } = useDiscardConfirm(dirty, saving ? undefined : onClose);
  const validation = useFormValidation<EmployeeField>(() =>
    validateEmployee({
      firstName: form.firstName,
      lastName: form.lastName,
      jobTitle: form.jobTitle,
      employmentType: employmentTypeDraft(form),
      vacationEntitlementPerYear: form.vacationEntitlementPerYear,
      holidayVacationHours: form.holidayVacationHours,
      birthDate: form.birthDate || undefined,
      entryDate: form.entryDate || undefined,
      exitDate: form.exitDate || undefined,
    }),
  );

  const save = async () => {
    if (!validation.submit()) return;
    // Guaranteed present by validateEmployee above, same reasoning as toEmploymentType's guards.
    if (form.vacationEntitlementPerYear === undefined || form.holidayVacationHours === undefined) {
      throw new Error('save: vacationEntitlementPerYear/holidayVacationHours missing despite passed validation');
    }

    const details = {
      lastName: form.lastName.trim(),
      firstName: form.firstName.trim(),
      jobTitle: form.jobTitle.trim(),
      employmentType: toEmploymentType(form),
      vacationEntitlementPerYear: form.vacationEntitlementPerYear,
      holidayVacationHours: form.holidayVacationHours,
      birthDate: form.birthDate || undefined,
      entryDate: form.entryDate || undefined,
      exitDate: form.exitDate || undefined,
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
      onError(e, t('employee.dialog.saveError'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ResponsiveDialog
      open
      onClose={requestClose}
      title={employee ? t('employee.dialog.titleEdit') : t('employee.newButton')}
      subtitle={employee ? t('employee.dialog.subtitleEdit') : undefined}
      contentRef={validation.containerRef}
      secondaryActions={secondaryActions}
      secondaryActionsLocked={dirty ? tCommon('secondaryActionsLocked') : undefined}
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
          <Stack direction="row" spacing={2}>
            <TextField
              label={t('employee.dialog.firstNameLabel')}
              required
              value={form.firstName}
              onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
              fullWidth
              {...validation.fieldProps('firstName')}
            />
            <TextField
              label={t('employee.dialog.lastNameLabel')}
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
            renderInput={(params) => (
              <TextField {...params} label={t('employee.dialog.jobTitleLabel')} required {...validation.fieldProps('jobTitle')} />
            )}
          />

          <TextField
            select
            label={t('employee.dialog.employmentTypeLabel')}
            required
            value={form.type}
            onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as EmploymentTypeKind }))}
          >
            <MenuItem value="FullTime">{t('employee.fullTimeOption')}</MenuItem>
            <MenuItem value="PartTime">{t('employee.partTimeOption')}</MenuItem>
            <MenuItem value="Minijob">{employmentTypeLabel({ type: 'Minijob', minHours: 0, maxHours: 0 })}</MenuItem>
          </TextField>

          {form.type === 'Minijob' ? (
            <>
              <Stack direction="row" spacing={2}>
                <DecimalTextField
                  label={t('employee.dialog.minHoursLabel')}
                  required
                  value={form.minHours}
                  onChange={(value) => setForm((f) => ({ ...f, minHours: value }))}
                  fullWidth
                  {...validation.fieldProps('minHours')}
                />
                <DecimalTextField
                  label={t('employee.dialog.maxHoursLabel')}
                  required
                  value={form.maxHours}
                  onChange={(value) => setForm((f) => ({ ...f, maxHours: value }))}
                  fullWidth
                  {...validation.fieldProps('maxHours')}
                />
              </Stack>
              <DecimalTextField
                label={t('employee.dialog.maxMonthlyHoursLabel')}
                value={form.maxMonthlyHours}
                onChange={(value) => setForm((f) => ({ ...f, maxMonthlyHours: value }))}
                fullWidth
                {...validation.fieldProps('maxMonthlyHours', t('employee.dialog.maxMonthlyHoursHint'))}
              />
            </>
          ) : (
            <DecimalTextField
              label={t('employee.dialog.weeklyHoursLabel')}
              required
              value={form.weeklyHours}
              onChange={(value) => setForm((f) => ({ ...f, weeklyHours: value }))}
              fullWidth
              {...validation.fieldProps('weeklyHours')}
            />
          )}

          {/* Long labels: side by side they were cut off on a phone ("Urlaubsanspruch/Jahr…"). */}
          <Stack direction={isMobile ? 'column' : 'row'} spacing={2}>
            <DecimalTextField
              label={t('employee.dialog.vacationEntitlementLabel')}
              required
              value={form.vacationEntitlementPerYear}
              onChange={(value) => setForm((f) => ({ ...f, vacationEntitlementPerYear: value }))}
              fullWidth
              {...validation.fieldProps('vacationEntitlementPerYear')}
            />
            <DecimalTextField
              label={t('employee.dialog.holidayVacationHoursLabel')}
              required
              value={form.holidayVacationHours}
              onChange={(value) => setForm((f) => ({ ...f, holidayVacationHours: value }))}
              fullWidth
              {...validation.fieldProps('holidayVacationHours', t('employee.dialog.holidayVacationHoursHint'))}
            />
          </Stack>

          <TextField
            label={t('employee.dialog.birthDateLabel')}
            type="date"
            value={form.birthDate}
            onChange={(e) => setForm((f) => ({ ...f, birthDate: e.target.value }))}
            InputLabelProps={{ shrink: true }}
            fullWidth
            {...validation.fieldProps('birthDate', t('employee.dialog.birthDateHint'))}
          />

          <Stack direction={isMobile ? 'column' : 'row'} spacing={2}>
            <TextField
              label={t('employee.dialog.entryDateLabel')}
              type="date"
              value={form.entryDate}
              onChange={(e) => setForm((f) => ({ ...f, entryDate: e.target.value }))}
              InputLabelProps={{ shrink: true }}
              helperText={t('employee.dialog.entryDateHint')}
              fullWidth
            />
            <TextField
              label={t('employee.dialog.exitDateLabel')}
              type="date"
              value={form.exitDate}
              onChange={(e) => setForm((f) => ({ ...f, exitDate: e.target.value }))}
              InputLabelProps={{ shrink: true }}
              fullWidth
              {...validation.fieldProps('exitDate', t('employee.dialog.exitDateHint'))}
            />
          </Stack>
        </Stack>
        {confirmDialog}
    </ResponsiveDialog>
  );
}
