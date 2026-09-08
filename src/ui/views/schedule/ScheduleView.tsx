import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import Paper from '@mui/material/Paper';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import TodayOutlinedIcon from '@mui/icons-material/TodayOutlined';
import SwapHorizOutlinedIcon from '@mui/icons-material/SwapHorizOutlined';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ContentPasteIcon from '@mui/icons-material/ContentPaste';
import EventBusyOutlinedIcon from '@mui/icons-material/EventBusyOutlined';
import {
  previousCalendarWeek,
  nextCalendarWeek,
  calendarWeekFromDate,
  calendarWeeksEqual,
  mondayOfWeek,
  dateForWeekday,
} from '@domain/shared/CalendarWeek';
import { formatDateGerman } from '@domain/shared/DateFormat';
import type { EmployeeId } from '@domain/shared/ids';
import { targetWeeklyHours } from '@domain/employee/EmploymentType';
import { compareByLastName } from '@domain/employee/Employee';
import { minutesToDecimalHours } from '@domain/schedule/scheduleCalculation';
import { createWeekView } from '@application/schedule/scheduleAssessment';
import type { DayView } from '@application/schedule/scheduleAssessment';
import type { DayEntry } from '@domain/schedule/EmployeeWeekAssignment';
import { services } from '@infrastructure/services';
import { useSelectedBranch } from '@ui/hooks/useBranch';
import { useEmployeeList } from '@ui/hooks/useEmployeeList';
import { useSchedule } from '@ui/hooks/useSchedule';
import { useAbsences } from '@ui/hooks/useAbsences';
import { useCalendarWeekStore } from '@ui/app/store/calendarWeekStore';
import { useErrorSnackbar } from '@ui/hooks/useErrorSnackbar';
import { ErrorSnackbar } from '@ui/components/ErrorSnackbar';
import { ScheduleTable } from './components/ScheduleTable';
import { ScheduleHeaderFields } from './components/ScheduleHeaderFields';
import { DayEditor } from './components/DayEditor';
import { ValidationNotices } from './components/ValidationNotices';
import { WeekSelectionDialog } from './components/WeekSelectionDialog';
import { CarryOverPreviousWeekDialog } from './components/CarryOverPreviousWeekDialog';
import { useScheduleValidation } from './useScheduleValidation';

export function ScheduleView() {
  const { branch } = useSelectedBranch();
  const { employeeList } = useEmployeeList(branch?.id ?? null);
  const selectedWeek = useCalendarWeekStore((s) => s.selectedWeek);
  const setSelectedWeek = useCalendarWeekStore((s) => s.setSelectedWeek);
  const { schedule, loading, setSchedule } = useSchedule(branch?.id ?? null, selectedWeek);
  const { absences, reload: reloadAbsences } = useAbsences(employeeList.map((emp) => emp.id));
  const validationResults = useScheduleValidation(schedule, branch, absences);
  const navigate = useNavigate();

  const [editorState, setEditorState] = useState<{
    employeeId: EmployeeId;
    dayView: DayView;
  } | null>(null);

  const [contextMenu, setContextMenu] = useState<{
    employeeId: EmployeeId;
    dayView: DayView;
    x: number;
    y: number;
  } | null>(null);
  const [copiedEntry, setCopiedEntry] = useState<DayEntry | null>(null);
  const [weekSelectionOpen, setWeekSelectionOpen] = useState(false);
  const [carryOverOpen, setCarryOverOpen] = useState(false);

  const { error, report, reset } = useErrorSnackbar();

  const weekView = useMemo(() => {
    if (!schedule) return [];
    const employeeById = new Map(employeeList.map((emp) => [emp.id, emp]));
    // Drop assignments whose employeeId no longer resolves to a known Employee (orphaned
    // leftovers from a hard delete before "deactivate instead of delete" existed) BEFORE sorting -
    // ScheduleTable already skips these at render time, but leaving them in for the sort makes
    // the comparator's "no data, treat as equal" fallback scramble the real rows around them.
    // Row order (Nachname A-Z) is independent of schedule.employeeAssignments's storage order.
    return createWeekView(schedule, absences)
      .filter((e) => employeeById.has(e.employeeId))
      .sort((a, b) => compareByLastName(employeeById.get(a.employeeId)!, employeeById.get(b.employeeId)!));
  }, [schedule, absences, employeeList]);

  const totalActualMinutes = weekView.reduce((sum, e) => sum + e.totalNetMinutes, 0);
  const totalTargetHours = employeeList.reduce((sum, emp) => sum + targetWeeklyHours(emp.employmentType), 0);
  const absentCount = new Set(absences.filter((a) => weekView.some((w) => w.employeeId === a.employeeId)).map((a) => a.employeeId)).size;

  // Stable identity so the memoized ScheduleTable is not re-rendered by unrelated state changes
  // here (context menu, dialogs, error snackbar).
  const cellClick = useCallback((employeeId: EmployeeId, dayView: DayView) => {
    setEditorState({ employeeId, dayView });
  }, []);

  const saveEntry = async (entry: DayEntry) => {
    if (!schedule || !editorState) return;
    try {
      const updated = await services.schedule.setDayEntryAndSave(
        schedule,
        editorState.employeeId,
        editorState.dayView.day,
        entry,
      );
      setSchedule(updated);
    } catch (e) {
      report(e, 'Eintrag konnte nicht gespeichert werden');
    }
  };

  const saveAbsence = async (type: 'Vacation' | 'Illness' | 'Other', label?: string) => {
    if (!editorState) return;
    const { employeeId, dayView } = editorState;
    const existing = dayView.absence;
    const isExistingSingleDay = existing && existing.from === dayView.date && existing.to === dayView.date;

    try {
      // Simpler than an update across the discriminated union: replace the existing entry (if any)
      // instead of trying to migrate it type-safely between the different kinds.
      if (isExistingSingleDay && existing) {
        await services.absence.delete(existing.id);
      }

      if (type === 'Other') {
        await services.absence.create({
          employeeId,
          type: 'Other',
          from: dayView.date,
          to: dayView.date,
          // DayEditor only calls this with a non-empty label for 'Other'; createAbsence rejects an
          // empty one, so nothing silently falls back to a placeholder text anymore.
          label: label ?? '',
        });
      } else {
        await services.absence.create({ employeeId, type, from: dayView.date, to: dayView.date });
      }
      await reloadAbsences();
    } catch (e) {
      report(e, 'Abwesenheit konnte nicht gespeichert werden');
    }
  };

  const deleteAbsence = async () => {
    const existing = editorState?.dayView.absence;
    if (!existing) return;
    try {
      await services.absence.delete(existing.id);
      await reloadAbsences();
    } catch (e) {
      report(e, 'Abwesenheit konnte nicht gelöscht werden');
    }
  };

  // A document-level listener (not a per-cell onContextMenu) so right-clicking a DIFFERENT cell
  // while the menu is already open still works: MUI's Menu renders a full-viewport backdrop while
  // open, which is the topmost element at that point and would otherwise swallow the event before
  // it ever reaches the cell underneath, falling back to the browser's native context menu.
  // elementsFromPoint returns the whole stack at that point (not just the topmost), so the actual
  // cell can be found even underneath the backdrop.
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const stack = document.elementsFromPoint(e.clientX, e.clientY);
      // Right-clicking the open custom menu itself: just block the native menu, leave ours as-is.
      if (stack.some((el) => el.closest('[role="menu"]'))) {
        e.preventDefault();
        return;
      }
      const cell = stack.map((el) => el.closest<HTMLElement>('[data-employeeid]')).find((el) => el);
      if (!cell) {
        setContextMenu(null);
        return;
      }
      e.preventDefault();
      const employeeId = cell.dataset.employeeid as EmployeeId;
      const day = cell.dataset.day;
      const assignment = weekView.find((w) => w.employeeId === employeeId);
      const dayView = assignment?.days.find((d) => d.day === day);
      if (!dayView) return;
      setContextMenu({ employeeId, dayView, x: e.clientX, y: e.clientY });
    };
    document.addEventListener('contextmenu', handler);
    return () => document.removeEventListener('contextmenu', handler);
  }, [weekView]);

  const copy = () => {
    if (!contextMenu) return;
    setCopiedEntry(contextMenu.dayView.entry);
    setContextMenu(null);
  };

  const setEntryInCell = async (employeeId: EmployeeId, dayView: DayView, entry: DayEntry) => {
    if (!schedule) return;
    try {
      const existingAbsence = dayView.absence;
      const isSingleDay =
        existingAbsence && existingAbsence.from === dayView.date && existingAbsence.to === dayView.date;
      // Same rule as DayEditor.save(): replacing a Shift/Off entry clears a single-day
      // Absence on that cell (multi-day ranges stay blocked, see the *Disabled checks below).
      if (isSingleDay && existingAbsence) {
        await services.absence.delete(existingAbsence.id);
        await reloadAbsences();
      }
      const updated = await services.schedule.setDayEntryAndSave(schedule, employeeId, dayView.day, entry);
      setSchedule(updated);
    } catch (e) {
      report(e, 'Eintrag konnte nicht geändert werden');
    }
  };

  const paste = async () => {
    if (!contextMenu || !copiedEntry) return;
    const { employeeId, dayView } = contextMenu;
    setContextMenu(null);

    // Fresh ids for the pasted shifts/breaks, so they never collide with the ids of the copied source.
    const entry: DayEntry =
      copiedEntry.type === 'Shift'
        ? {
            type: 'Shift',
            shifts: copiedEntry.shifts.map((s) => ({
              ...s,
              id: crypto.randomUUID(),
              breaks: s.breaks.map((b) => ({ ...b, id: crypto.randomUUID() })),
            })),
          }
        : { type: 'Off' };

    await setEntryInCell(employeeId, dayView, entry);
  };

  const setToOff = async () => {
    if (!contextMenu) return;
    const { employeeId, dayView } = contextMenu;
    setContextMenu(null);
    await setEntryInCell(employeeId, dayView, { type: 'Off' });
  };

  const isMultiDayAbsence = (dayView: DayView) =>
    !!(dayView.absence && !(dayView.absence.from === dayView.date && dayView.absence.to === dayView.date));

  const pasteDisabled = !copiedEntry || !!(contextMenu && isMultiDayAbsence(contextMenu.dayView));
  const isAlreadyOff = !!contextMenu && contextMenu.dayView.entry.type === 'Off' && !contextMenu.dayView.absence;
  const setToOffDisabled = isAlreadyOff || !!(contextMenu && isMultiDayAbsence(contextMenu.dayView));

  if (!branch) {
    return <Alert severity="info">Bitte zuerst oben eine Filiale auswählen oder anlegen.</Alert>;
  }

  const editorEmployee = editorState ? employeeList.find((emp) => emp.id === editorState.employeeId) : null;

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={2} sx={{ mb: 2 }}>
        <Box>
          <Typography variant="h5" fontWeight={500}>
            {branch.branchNumber} {branch.name}
          </Typography>
          <Typography
            variant="body2"
            color="text.secondary"
            onClick={() => setWeekSelectionOpen(true)}
            sx={{ cursor: 'pointer', textDecoration: 'underline', textDecorationStyle: 'dotted', width: 'fit-content' }}
          >
            KW {selectedWeek.week} · {formatDateGerman(mondayOfWeek(selectedWeek))} –{' '}
            {formatDateGerman(dateForWeekday(selectedWeek, 'Sonntag'))}
          </Typography>
        </Box>
        <Stack direction="row" gap={1} alignItems="center">
          <IconButton onClick={() => setSelectedWeek(previousCalendarWeek(selectedWeek))} aria-label="Vorherige Woche">
            <ChevronLeftIcon />
          </IconButton>
          <Button
            size="small"
            startIcon={<TodayOutlinedIcon />}
            onClick={() => setSelectedWeek(calendarWeekFromDate(new Date()))}
            disabled={calendarWeeksEqual(selectedWeek, calendarWeekFromDate(new Date()))}
          >
            Heute
          </Button>
          <IconButton onClick={() => setSelectedWeek(nextCalendarWeek(selectedWeek))} aria-label="Nächste Woche">
            <ChevronRightIcon />
          </IconButton>
          <Button variant="outlined" startIcon={<SwapHorizOutlinedIcon />} onClick={() => setCarryOverOpen(true)}>
            Vorwoche übertragen
          </Button>
          {schedule && (
            <Button variant="outlined" startIcon={<PrintOutlinedIcon />} onClick={() => navigate(`/print/${schedule.id}`)}>
              Drucken
            </Button>
          )}
        </Stack>
      </Stack>

      <ScheduleHeaderFields schedule={schedule} onSaved={setSchedule} onError={report} />

      <Stack direction="row" gap={2} flexWrap="wrap" sx={{ mb: 3 }}>
        {[
          { label: 'Soll-Std. (Verträge)', value: totalTargetHours.toLocaleString('de-DE') },
          { label: 'Ist-Wochenstd.', value: minutesToDecimalHours(totalActualMinutes).toLocaleString('de-DE') },
          {
            label: 'Hinweise',
            value: `${validationResults.filter((e) => e.severity === 'error').length} Fehler`,
          },
          { label: 'Abwesend', value: `${absentCount} Mitarbeiter` },
        ].map((tile) => (
          <Paper key={tile.label} sx={{ p: 2, minWidth: 160, flex: '1 1 160px' }}>
            <Typography variant="caption" color="text.secondary">
              {tile.label}
            </Typography>
            <Typography variant="h6" fontWeight={500}>
              {tile.value}
            </Typography>
          </Paper>
        ))}
      </Stack>

      <ValidationNotices results={validationResults} employeeList={employeeList} />

      {!loading && employeeList.length === 0 && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Für diese Filiale sind noch keine Mitarbeiter angelegt. Lege zuerst Mitarbeiter unter „Mitarbeiter“ an.
        </Alert>
      )}

      {schedule && weekView.length > 0 && (
        <ScheduleTable
          weekView={weekView}
          employeeList={employeeList}
          validationResults={validationResults}
          onCellClick={cellClick}
        />
      )}

      <Menu
        open={!!contextMenu}
        onClose={() => setContextMenu(null)}
        anchorReference="anchorPosition"
        anchorPosition={contextMenu ? { top: contextMenu.y, left: contextMenu.x } : undefined}
      >
        <MenuItem onClick={copy}>
          <ContentCopyIcon fontSize="small" sx={{ mr: 1 }} />
          Kopieren
        </MenuItem>
        <MenuItem onClick={paste} disabled={pasteDisabled}>
          <ContentPasteIcon fontSize="small" sx={{ mr: 1 }} />
          Einfügen
        </MenuItem>
        <MenuItem onClick={setToOff} disabled={setToOffDisabled}>
          <EventBusyOutlinedIcon fontSize="small" sx={{ mr: 1 }} />
          Frei
        </MenuItem>
      </Menu>

      <WeekSelectionDialog
        open={weekSelectionOpen}
        onClose={() => setWeekSelectionOpen(false)}
        branchId={branch.id}
        absences={absences}
        selectedWeek={selectedWeek}
        onWeekSelect={setSelectedWeek}
      />

      {schedule && (
        <CarryOverPreviousWeekDialog
          open={carryOverOpen}
          onClose={() => setCarryOverOpen(false)}
          branchId={branch.id}
          selectedWeek={selectedWeek}
          schedule={schedule}
          employeeList={employeeList}
          absences={absences}
          onApplied={setSchedule}
          onError={report}
        />
      )}

      {editorState && editorEmployee && (
        <DayEditor
          open
          onClose={() => setEditorState(null)}
          onSave={saveEntry}
          onAbsenceSave={saveAbsence}
          onAbsenceDelete={deleteAbsence}
          employeeId={editorState.employeeId}
          employeeName={`${editorEmployee.firstName} ${editorEmployee.lastName}`}
          day={editorState.dayView.day}
          date={editorState.dayView.date}
          entry={editorState.dayView.entry}
          absence={editorState.dayView.absence}
        />
      )}

      <ErrorSnackbar error={error} onClose={reset} />
    </Box>
  );
}
