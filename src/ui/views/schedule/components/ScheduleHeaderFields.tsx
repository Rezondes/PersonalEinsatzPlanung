import { useEffect, useState } from 'react';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import InputAdornment from '@mui/material/InputAdornment';
import type { WeeklySchedule } from '@domain/schedule/WeeklySchedule';
import { services } from '@infrastructure/services';
import { DecimalTextField } from '@ui/components/DecimalTextField';

interface ScheduleHeaderFieldsProps {
  schedule: WeeklySchedule | null;
  onSaved: (updated: WeeklySchedule) => void;
  onError: (e: unknown, context?: string) => void;
}

/** Planned weekly revenue/hours inputs of the schedule header. Owns its own draft state so that a
 * keystroke re-renders only these two fields - previously the drafts lived in ScheduleView, where
 * every keystroke re-rendered the whole schedule table underneath. Saves on blur. */
export function ScheduleHeaderFields({ schedule, onSaved, onError }: ScheduleHeaderFieldsProps) {
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
    if (!schedule) return;
    try {
      const updated = await services.schedule.save({
        ...schedule,
        plannedWeeklyRevenue: revenue,
        plannedWeeklyHours: hours,
      });
      onSaved(updated);
      setSavedAt(Date.now());
    } catch (e) {
      onError(e, 'Kopfdaten konnten nicht gespeichert werden');
    }
  };

  return (
    <Stack direction="row" gap={2} flexWrap="wrap" sx={{ mb: 2 }}>
      <DecimalTextField
        label="Geplanter Wochenumsatz"
        size="small"
        value={revenue}
        onChange={setRevenue}
        onBlur={save}
        InputProps={{ endAdornment: <InputAdornment position="end">€</InputAdornment> }}
        sx={{ width: 260 }}
      />
      <DecimalTextField
        label="Geplante Wochenstunden"
        size="small"
        value={hours}
        onChange={setHours}
        onBlur={save}
        sx={{ width: 260 }}
      />
      {savedAt !== null && (
        <Typography role="status" variant="caption" color="success.main" sx={{ alignSelf: 'center' }}>
          Gespeichert
        </Typography>
      )}
    </Stack>
  );
}
