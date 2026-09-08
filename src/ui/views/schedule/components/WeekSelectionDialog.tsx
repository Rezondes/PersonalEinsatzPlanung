import { useEffect, useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import Chip from '@mui/material/Chip';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import type { BranchId } from '@domain/shared/ids';
import type { CalendarWeek } from '@domain/shared/CalendarWeek';
import {
  calendarWeeksInMonth,
  calendarWeeksEqual,
  calendarWeekFromDate,
  mondayOfWeek,
  dateForWeekday,
} from '@domain/shared/CalendarWeek';
import { formatDateGerman } from '@domain/shared/DateFormat';
import type { WeeklySchedule } from '@domain/schedule/WeeklySchedule';
import type { Absence } from '@domain/absence/Absence';
import type { EmployeeHoursInfo } from '@application/schedule/scheduleAssessment';
import { minutesToDecimalHours } from '@domain/schedule/scheduleCalculation';
import { createWeekView } from '@application/schedule/scheduleAssessment';
import { services } from '@infrastructure/services';

const MONTH_NAMES = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
];

interface WeekSelectionDialogProps {
  open: boolean;
  onClose: () => void;
  branchId: BranchId;
  absences: Absence[];
  /** Passed down from ScheduleView rather than loaded here: the parent already holds the list, and
   * createWeekView needs it to resolve per-employee credited hours. */
  employeeList: EmployeeHoursInfo[];
  isHoliday: (isoDate: string) => boolean;
  selectedWeek: CalendarWeek;
  onWeekSelect: (cw: CalendarWeek) => void;
}

/** Quick week picker: shows a month at a time with each week's total Ist-Stunden across all
 * employees (no per-week ArbZG-Fehler-check here - that would need the async cross-week rest-period
 * service to run once per week, too expensive for a bulk overview; violations stay visible only
 * after opening a week, same as before). */
export function WeekSelectionDialog({
  open,
  onClose,
  branchId,
  absences,
  employeeList,
  isHoliday,
  selectedWeek,
  onWeekSelect,
}: WeekSelectionDialogProps) {
  const today = calendarWeekFromDate(new Date());
  const [year, setYear] = useState(mondayOfWeek(selectedWeek).getFullYear());
  const [month, setMonth] = useState(mondayOfWeek(selectedWeek).getMonth() + 1);
  const [schedules, setSchedules] = useState<WeeklySchedule[]>([]);

  useEffect(() => {
    if (!open) return;
    const start = mondayOfWeek(selectedWeek);
    setYear(start.getFullYear());
    setMonth(start.getMonth() + 1);
    services.schedule.forBranch(branchId).then(setSchedules);
  }, [open, branchId, selectedWeek]);

  const changeMonth = (direction: -1 | 1) => {
    let newMonth = month + direction;
    let newYear = year;
    if (newMonth < 1) {
      newMonth = 12;
      newYear -= 1;
    } else if (newMonth > 12) {
      newMonth = 1;
      newYear += 1;
    }
    setMonth(newMonth);
    setYear(newYear);
  };

  const weeks = calendarWeeksInMonth(year, month);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <IconButton onClick={() => changeMonth(-1)} aria-label="Vorheriger Monat" size="small">
            <ChevronLeftIcon />
          </IconButton>
          <Typography variant="subtitle1">
            {MONTH_NAMES[month - 1]} {year}
          </Typography>
          <IconButton onClick={() => changeMonth(1)} aria-label="Nächster Monat" size="small">
            <ChevronRightIcon />
          </IconButton>
        </Stack>
      </DialogTitle>
      <DialogContent dividers sx={{ p: 0 }}>
        <List disablePadding>
          {weeks.map((cw) => {
            const schedule = schedules.find(
              (s) => s.calendarWeek.year === cw.year && s.calendarWeek.week === cw.week,
            );
            // Worked hours: this is a branch figure, so hours credited without presence in the
            // store (vacation days, "Sonstige" with hours) stay out of it.
            const totalMinutes = schedule
              ? createWeekView(schedule, absences, { employees: employeeList, isHoliday }).reduce(
                  (sum, e) => sum + e.workedMinutes,
                  0,
                )
              : null;
            const isSelected = calendarWeeksEqual(cw, selectedWeek);
            const isToday = calendarWeeksEqual(cw, today);

            return (
              <ListItemButton
                key={`${cw.year}-${cw.week}`}
                selected={isSelected}
                onClick={() => {
                  onWeekSelect(cw);
                  onClose();
                }}
                sx={{ py: 1.5, px: 2 }}
              >
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ width: '100%' }}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="body2" fontWeight={isSelected ? 600 : 400}>
                      KW {cw.week} · {formatDateGerman(mondayOfWeek(cw))} –{' '}
                      {formatDateGerman(dateForWeekday(cw, 'Sonntag'))}
                    </Typography>
                    {isToday && <Chip label="Heute" size="small" color="success" variant="outlined" />}
                  </Stack>
                  <Typography variant="body2" color="text.secondary">
                    {totalMinutes != null ? `${minutesToDecimalHours(totalMinutes).toLocaleString('de-DE')} Std.` : 'kein Plan'}
                  </Typography>
                </Stack>
              </ListItemButton>
            );
          })}
        </List>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 1.5 }}>
        <Button onClick={onClose}>Schließen</Button>
      </DialogActions>
    </Dialog>
  );
}
