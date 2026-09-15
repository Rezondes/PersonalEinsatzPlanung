import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import type { Branch } from '@domain/branch/Branch';
import type { Employee } from '@domain/employee/Employee';
import type { Absence } from '@domain/absence/Absence';
import { holidaysForYearAndFederalState } from '@infrastructure/holidays/germanHolidays';
import { services } from '@infrastructure/services';
import { ResponsiveDialog } from '@ui/components/ResponsiveDialog';

interface CreateHolidaysDialogProps {
  onClose: () => void;
  branch: Branch;
  /** Already active-filtered by the caller (AbsencesView) - this dialog has no opinion on what
   * "aktiv" means, same convention as application/absence/holidayBulkCreation.ts itself. */
  employees: Employee[];
  absences: Absence[];
  onApplied: (result: { created: number; skipped: number }) => void;
  onError: (e: unknown, context?: string) => void;
}

/**
 * "Feiertage anlegen": creates a PublicHoliday absence for every legal holiday of the branch's
 * federal state, for every given employee, in one bulk run with no per-holiday confirmation - see
 * application/absence/holidayBulkCreation.ts for the skip rules that make repeated runs safe
 * (idempotent) and never double-book a day already covered by another absence.
 *
 * Resolves the year's holiday dates here, not in the application layer: application/ may not import
 * infrastructure/holidays/germanHolidays.ts directly (see that file's own doc comment), the same
 * reason application/schedule/scheduleAssessment.ts takes an injected `isHoliday` instead of calling
 * the holiday calculator itself.
 */
export function CreateHolidaysDialog({ onClose, branch, employees, absences, onApplied, onError }: CreateHolidaysDialogProps) {
  const { t } = useTranslation('absences');
  const { t: tCommon } = useTranslation();
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [applying, setApplying] = useState(false);

  const apply = async () => {
    setApplying(true);
    try {
      const holidayDates = holidaysForYearAndFederalState(year, branch.federalState);
      const result = await services.holidayBulkCreation.createHolidaysForYear(holidayDates, employees, absences);
      onApplied(result);
      onClose();
    } catch (e) {
      onError(e, t('createHolidaysDialog.error'));
    } finally {
      setApplying(false);
    }
  };

  return (
    <ResponsiveDialog
      open
      onClose={applying ? undefined : onClose}
      title={t('createHolidaysLabel')}
      maxWidth="xs"
      actions={
        <>
          <Button onClick={onClose} disabled={applying}>
            {tCommon('cancel')}
          </Button>
          <Button variant="contained" onClick={apply} disabled={applying || employees.length === 0}>
            {t('createHolidaysDialog.createButton')}
          </Button>
        </>
      }
    >
      <Stack spacing={2} sx={{ pt: 1 }}>
        <Typography variant="body2" color="text.secondary">
          {t('createHolidaysDialog.description', { federalState: branch.federalState })}
        </Typography>
        <TextField select label={tCommon('yearLabel')} value={year} onChange={(e) => setYear(Number(e.target.value))}>
          {[currentYear - 1, currentYear, currentYear + 1, currentYear + 2].map((y) => (
            <MenuItem key={y} value={y}>
              {y}
            </MenuItem>
          ))}
        </TextField>
        {employees.length === 0 && (
          <Typography variant="body2" color="text.secondary">
            {t('createHolidaysDialog.noActiveEmployees')}
          </Typography>
        )}
      </Stack>
    </ResponsiveDialog>
  );
}
