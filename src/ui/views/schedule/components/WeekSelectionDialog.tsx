import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import Chip from '@mui/material/Chip';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { ResponsiveDialog } from '@ui/components/ResponsiveDialog';
import type { BranchId } from '@domain/shared/ids';
import type { CalendarWeek } from '@domain/shared/CalendarWeek';
import {
  calendarWeeksInMonth,
  calendarWeeksEqual,
  calendarWeekFromDate,
  mondayOfWeek,
  formatCalendarWeekRange,
  MONTH_NAMES,
  stepMonth,
} from '@domain/shared/CalendarWeek';
import type { WeeklySchedule } from '@domain/schedule/WeeklySchedule';
import type { Absence } from '@domain/absence/Absence';
import type { EmployeeHoursInfo } from '@application/schedule/scheduleAssessment';
import { formatHoursGerman } from '@domain/schedule/scheduleCalculation';
import { createWeekView } from '@application/schedule/scheduleAssessment';
import { services } from '@infrastructure/services';

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
  const { t } = useTranslation('schedule');
  const today = calendarWeekFromDate(new Date());
  const [year, setYear] = useState(mondayOfWeek(selectedWeek).getFullYear());
  const [month, setMonth] = useState(mondayOfWeek(selectedWeek).getMonth() + 1);
  const [schedules, setSchedules] = useState<WeeklySchedule[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!open) return;
    const start = mondayOfWeek(selectedWeek);
    setYear(start.getFullYear());
    setMonth(start.getMonth() + 1);
    setLoaded(false);
    services.schedule
      .forBranch(branchId)
      .then(setSchedules)
      // On failure the weeks would silently claim "kein Plan" for weeks that have one, which is
      // worse than saying nothing. loaded gates the figures until they are actually known.
      .catch(() => setSchedules([]))
      .finally(() => setLoaded(true));
  }, [open, branchId, selectedWeek]);

  const changeMonth = (direction: -1 | 1) => {
    const next = stepMonth(year, month, direction);
    setYear(next.year);
    setMonth(next.month);
  };

  // Jahr-Bereich: aktuelles Jahr ±5, wie MonthOverviewView.
  const yearOptions = Array.from({ length: 11 }, (_, i) => today.year - 5 + i);

  const weeks = calendarWeeksInMonth(year, month);

  return (
    <ResponsiveDialog
      open={open}
      onClose={onClose}
      title={t('weekPickerTitle')}
      maxWidth="xs"
      dividers
      actions={null}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
        <IconButton onClick={() => changeMonth(-1)} aria-label={t('previousMonthAriaLabel')} size="small">
          <ChevronLeftIcon />
        </IconButton>
        <Typography variant="subtitle1">
          {MONTH_NAMES[month - 1]} {year}
        </Typography>
        <IconButton onClick={() => changeMonth(1)} aria-label={t('nextMonthAriaLabel')} size="small">
          <ChevronRightIcon />
        </IconButton>
      </Stack>

      <Stack direction="row" gap={1} sx={{ mb: 1 }}>
        <TextField
          select
          size="small"
          label={t('monthSelectLabel')}
          value={month}
          onChange={(e) => setMonth(Number(e.target.value))}
          sx={{ flex: 1 }}
        >
          {MONTH_NAMES.map((name, i) => (
            <MenuItem key={name} value={i + 1}>
              {name}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          size="small"
          label={t('yearSelectLabel')}
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          sx={{ flex: 1 }}
        >
          {yearOptions.map((y) => (
            <MenuItem key={y} value={y}>
              {y}
            </MenuItem>
          ))}
        </TextField>
      </Stack>
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
                    {formatCalendarWeekRange(cw)}
                  </Typography>
                  {isToday && <Chip label={t('todayButton')} size="small" color="success" variant="outlined" />}
                </Stack>
                <Typography variant="body2" color="text.secondary">
                  {!loaded
                    ? t('loadingWeek')
                    : totalMinutes != null
                      ? t('workedHoursSuffix', { hours: formatHoursGerman(totalMinutes) })
                      : t('noScheduleText')}
                </Typography>
              </Stack>
            </ListItemButton>
          );
        })}
      </List>
    </ResponsiveDialog>
  );
}
