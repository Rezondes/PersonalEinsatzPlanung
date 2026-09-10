import { useEffect, useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import type { BranchId } from '@domain/shared/ids';
import type { CalendarWeek } from '@domain/shared/CalendarWeek';
import { previousCalendarWeek, formatCalendarWeekRange } from '@domain/shared/CalendarWeek';
import type { WeeklySchedule } from '@domain/schedule/WeeklySchedule';
import type { Employee } from '@domain/employee/Employee';
import { fullName } from '@domain/employee/Employee';
import type { Absence } from '@domain/absence/Absence';
import { minutesToDecimalHours } from '@domain/schedule/scheduleCalculation';
import { createWeekView, effectiveTargetMinutes } from '@application/schedule/scheduleAssessment';
import { services } from '@infrastructure/services';
import { DecimalTextField } from '@ui/components/DecimalTextField';
import CircularProgress from '@mui/material/CircularProgress';
import Stack from '@mui/material/Stack';

interface CarryOverPreviousWeekDialogProps {
  open: boolean;
  onClose: () => void;
  branchId: BranchId;
  selectedWeek: CalendarWeek;
  schedule: WeeklySchedule;
  employeeList: Employee[];
  absences: Absence[];
  isHoliday: (isoDate: string) => boolean;
  onApplied: (updatedSchedule: WeeklySchedule) => void;
  onError: (e: unknown, context?: string) => void;
}

interface RowData {
  employee: Employee;
  previousActualMinutes: number | null;
  /** Of previousActualMinutes, the part that was credited without presence in the store (vacation
   * days, "Sonstige" with hours). Shown next to the Ist figure so it is obvious why a week full of
   * vacation no longer produces a large carry-over suggestion. */
  previousCreditedMinutes: number;
  previousTargetMinutes: number | null;
  suggestedMinutes: number;
}

function formatHours(minutes: number): string {
  return minutesToDecimalHours(minutes).toLocaleString('de-DE');
}

/** Modal für die Übernahme von Mehr-/Minusstunden aus der Vorwoche (Punkt 6): berechnet je aktivem
 * Mitarbeiter den Vorschlag aus Vorwoche-Ist minus Vorwoche-Soll, zeigt ihn in einem editierbaren
 * Feld an (das editierbare Feld ist zugleich die manuelle Eingabe-Alternative aus der Anforderung -
 * kein zweites UI nötig) und übernimmt alle Zeilen auf einmal in schedule.employeeAssignments. */
export function CarryOverPreviousWeekDialog({
  open,
  onClose,
  branchId,
  selectedWeek,
  schedule,
  employeeList,
  absences,
  isHoliday,
  onApplied,
  onError,
}: CarryOverPreviousWeekDialogProps) {
  const [rows, setRows] = useState<RowData[]>([]);
  const [inputs, setInputs] = useState<Record<string, number | undefined>>({});
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    (async () => {
      const previousWeek = previousCalendarWeek(selectedWeek);
      const previousSchedule = await services.schedule.findForWeek(branchId, previousWeek);
      const previousView = previousSchedule
        ? createWeekView(previousSchedule, absences, { employees: employeeList, isHoliday })
        : [];

      const activeEmployees = employeeList.filter((emp) => emp.active);
      const newRows: RowData[] = activeEmployees.map((employee) => {
        const previousEntry = previousView.find((e) => e.employeeId === employee.id);
        if (!previousEntry) {
          return {
            employee,
            previousActualMinutes: null,
            previousCreditedMinutes: 0,
            previousTargetMinutes: null,
            suggestedMinutes: 0,
          };
        }
        const previousTargetMinutes = effectiveTargetMinutes(employee, previousEntry);
        // totalNetMinutes, i.e. including credited hours: a week spent entirely on vacation is
        // fulfilled, not a week of missing hours, so the suggestion collapses to roughly zero.
        return {
          employee,
          previousActualMinutes: previousEntry.totalNetMinutes,
          previousCreditedMinutes: previousEntry.creditedMinutes,
          previousTargetMinutes,
          suggestedMinutes: previousTargetMinutes - previousEntry.totalNetMinutes,
        };
      });

      const newInputs: Record<string, number | undefined> = {};
      for (const row of newRows) {
        const existingAssignment = schedule.employeeAssignments.find((a) => a.employeeId === row.employee.id);
        const existingAdjustment = existingAssignment?.targetAdjustmentMinutes;
        const minutes = existingAdjustment != null && existingAdjustment !== 0 ? existingAdjustment : row.suggestedMinutes;
        newInputs[row.employee.id] = minutesToDecimalHours(minutes);
      }

      setRows(newRows);
      setInputs(newInputs);
    })()
      // Without this the spinner below would turn forever, which is worse than the empty dialog
      // it replaces: the user would wait instead of seeing that something went wrong.
      .catch((e: unknown) => onError(e, 'Die Vorwoche konnte nicht geladen werden'))
      .finally(() => setLoading(false));
    // onError is notify.report, a stable module-level reference, so listing it cannot loop.
  }, [open, branchId, selectedWeek, schedule, employeeList, absences, isHoliday, onError]);

  const apply = async () => {
    setApplying(true);
    try {
      const adjustments = rows.map((row) => ({
        employeeId: row.employee.id,
        minutes: Math.round((inputs[row.employee.id] ?? 0) * 60),
      }));
      const updated = await services.schedule.applyTargetAdjustments(schedule, adjustments);
      onApplied(updated);
      onClose();
    } catch (e) {
      onError(e, 'Stundenübertrag konnte nicht übernommen werden');
    } finally {
      setApplying(false);
    }
  };

  const previousWeek = previousCalendarWeek(selectedWeek);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        Mehr-/Minusstunden aus Vorwoche übertragen
        <Typography variant="body2" color="text.secondary">
          {formatCalendarWeekRange(previousWeek)}
        </Typography>
      </DialogTitle>
      <DialogContent>
        {loading && (
          <Stack alignItems="center" spacing={2} sx={{ py: 4 }}>
            <CircularProgress />
            <Typography variant="body2" color="text.secondary">
              Vorwoche wird geladen…
            </Typography>
          </Stack>
        )}
        {!loading && rows.length === 0 && (
          <Alert severity="info">Keine aktiven Mitarbeiter für diese Filiale.</Alert>
        )}
        {!loading && rows.length > 0 && (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Mitarbeiter</TableCell>
                  <TableCell align="center">Vorwoche Ist</TableCell>
                  <TableCell align="center">Vorwoche Soll</TableCell>
                  <TableCell align="center">Vorschlag</TableCell>
                  <TableCell align="center">Übernehmen (Std.)</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.employee.id}>
                    <TableCell>{fullName(row.employee)}</TableCell>
                    <TableCell align="center">
                      {row.previousActualMinutes != null ? formatHours(row.previousActualMinutes) : 'keine Daten'}
                      {row.previousCreditedMinutes > 0 && (
                        <Typography variant="caption" display="block" color="text.secondary">
                          davon {formatHours(row.previousCreditedMinutes)} angerechnet
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="center">
                      {row.previousTargetMinutes != null ? formatHours(row.previousTargetMinutes) : '–'}
                    </TableCell>
                    <TableCell align="center">
                      {row.previousActualMinutes != null
                        ? `${row.suggestedMinutes > 0 ? '+' : ''}${formatHours(row.suggestedMinutes)}`
                        : '–'}
                    </TableCell>
                    <TableCell align="center">
                      <DecimalTextField
                        size="small"
                        value={inputs[row.employee.id]}
                        onChange={(value) => setInputs((v) => ({ ...v, [row.employee.id]: value }))}
                        sx={{ width: 100 }}
                        // No visible label (the column header is it), so name the field for
                        // screen readers per row. Empty means 0 here, which is a valid choice.
                        slotProps={{ htmlInput: { 'aria-label': `Übernehmen (Std.) ${fullName(row.employee)}` } }}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>Abbrechen</Button>
        <Button variant="contained" onClick={apply} disabled={loading || applying || rows.length === 0}>
          Übernehmen
        </Button>
      </DialogActions>
    </Dialog>
  );
}
