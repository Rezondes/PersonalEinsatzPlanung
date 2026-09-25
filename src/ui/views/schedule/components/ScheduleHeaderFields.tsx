import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import InputAdornment from '@mui/material/InputAdornment';
import type { WeeklySchedule } from '@domain/schedule/WeeklySchedule';
import { services } from '@infrastructure/services';
import { DecimalTextField } from '@ui/components/DecimalTextField';

interface ScheduleHeaderFieldsProps {
  schedule: WeeklySchedule | null;
  /** Set while the view is loading another week. These fields save on blur, so leaving one during
   * a week switch would write the OLD week back - possibly after the new one has already arrived. */
  disabled?: boolean;
  onSaved: (updated: WeeklySchedule) => void;
  onError: (e: unknown, context?: string) => void;
  /** Mobile "Weitere Aktionen" sheet: fill the sheet instead of the fixed 260px. */
  fullWidth?: boolean;
}

/** Planned weekly revenue/hours inputs of the schedule header. Owns its own draft state so that a
 * keystroke re-renders only these two fields - previously the drafts lived in ScheduleView, where
 * every keystroke re-rendered the whole schedule table underneath. Saves on blur. */
export function ScheduleHeaderFields({ schedule, disabled = false, onSaved, onError, fullWidth = false }: ScheduleHeaderFieldsProps) {
  const { t } = useTranslation('schedule');
  const [revenue, setRevenue] = useState<number | undefined>(schedule?.plannedWeeklyRevenue);
  const [hours, setHours] = useState<number | undefined>(schedule?.plannedWeeklyHours);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    setRevenue(schedule?.plannedWeeklyRevenue);
    setHours(schedule?.plannedWeeklyHours);
  }, [schedule?.id, schedule?.plannedWeeklyRevenue, schedule?.plannedWeeklyHours]);

  useEffect(() => {
    if (savedAt === null) return;
    const timer = setTimeout(() => setSavedAt(null), 2000);
    return () => clearTimeout(timer);
  }, [savedAt]);

  const save = async () => {
    if (!schedule || disabled) return;
    // Both fields save on blur, so simply tabbing through without typing anything must not write -
    // otherwise every such tab-through both hits the database for nothing and (via onSaved ->
    // useScheduleHistory's record()) pushes a no-op step onto the undo stack (M20).
    if (revenue === schedule.plannedWeeklyRevenue && hours === schedule.plannedWeeklyHours) return;
    try {
      const updated = await services.schedule.save({
        ...schedule,
        plannedWeeklyRevenue: revenue,
        plannedWeeklyHours: hours,
      });
      onSaved(updated);
      setSavedAt(Date.now());
    } catch (e) {
      onError(e, t('headerSaveError'));
    }
  };

  return (
    <Stack direction="row" gap={2} flexWrap="wrap" sx={{ mb: 2 }}>
      <DecimalTextField
        label={t('plannedRevenueLabel')}
        size="small"
        value={revenue}
        onChange={setRevenue}
        onBlur={save}
        disabled={disabled}
        InputProps={{ endAdornment: <InputAdornment position="end">€</InputAdornment> }}
        fullWidth={fullWidth}
        sx={fullWidth ? undefined : { width: 260 }}
      />
      <DecimalTextField
        label={t('plannedHoursLabel')}
        size="small"
        value={hours}
        onChange={setHours}
        onBlur={save}
        disabled={disabled}
        fullWidth={fullWidth}
        sx={fullWidth ? undefined : { width: 260 }}
      />
      {savedAt !== null && (
        <Typography role="status" variant="caption" color="success.main" sx={{ alignSelf: 'center' }}>
          {t('savedStatus')}
        </Typography>
      )}
    </Stack>
  );
}
