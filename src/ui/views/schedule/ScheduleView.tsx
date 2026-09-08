import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import Tooltip from '@mui/material/Tooltip';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import TodayOutlinedIcon from '@mui/icons-material/TodayOutlined';
import SwapHorizOutlinedIcon from '@mui/icons-material/SwapHorizOutlined';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ContentPasteIcon from '@mui/icons-material/ContentPaste';
import EventBusyOutlinedIcon from '@mui/icons-material/EventBusyOutlined';
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined';
import UndoIcon from '@mui/icons-material/Undo';
import RedoIcon from '@mui/icons-material/Redo';
import {
  previousCalendarWeek,
  nextCalendarWeek,
  calendarWeekFromDate,
  calendarWeeksEqual,
  mondayOfWeek,
  dateForWeekday,
} from '@domain/shared/CalendarWeek';
import { formatDateGerman, toISODate } from '@domain/shared/DateFormat';
import type { EmployeeId } from '@domain/shared/ids';
import { targetWeeklyHoursRange } from '@domain/employee/EmploymentType';
import { fullName } from '@domain/employee/Employee';
import { formatHoursRangeGerman, minutesToDecimalHours } from '@domain/schedule/scheduleCalculation';
import { createWeekView } from '@application/schedule/scheduleAssessment';
import type { DayView } from '@application/schedule/scheduleAssessment';
import type { DayEntry } from '@domain/schedule/EmployeeWeekAssignment';
import type { WeeklySchedule } from '@domain/schedule/WeeklySchedule';
import { services } from '@infrastructure/services';
import { createHolidayCheck } from '@infrastructure/holidays/germanHolidays';
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
import type { AbsenceDetails } from './components/DayEditor';
import { ValidationNotices } from './components/ValidationNotices';
import { WeekSelectionDialog } from './components/WeekSelectionDialog';
import { CarryOverPreviousWeekDialog } from './components/CarryOverPreviousWeekDialog';
import { useScheduleValidation } from './useScheduleValidation';
import { buildScheduleRows, isCellLocked } from './scheduleRows';
import { useScheduleHistory } from './useScheduleHistory';
import type { AbsenceOp, HistoryDirection, HistoryStep } from './useScheduleHistory';

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
  const [searchTerm, setSearchTerm] = useState('');

  const { error, report, reset } = useErrorSnackbar();

  const federalState = branch?.federalState;
  const isHoliday = useMemo(
    () => (federalState ? createHolidayCheck(federalState) : () => false),
    [federalState],
  );

  const weekStartISO = toISODate(mondayOfWeek(selectedWeek));
  const weekEndISO = toISODate(dateForWeekday(selectedWeek, 'Sonntag'));

  const rows = useMemo(() => {
    if (!schedule) return [];
    const weekView = createWeekView(schedule, absences, { employees: employeeList, isHoliday });
    return buildScheduleRows(weekView, employeeList, weekStartISO, weekEndISO);
  }, [schedule, absences, employeeList, isHoliday, weekStartISO, weekEndISO]);

  // The search only narrows what is rendered. The tiles below keep summing every row, because a
  // branch total that silently changes while typing a name would be actively misleading.
  const visibleRows = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((row) => fullName(row.employee).toLowerCase().includes(term));
  }, [rows, searchTerm]);

  // Worked hours only: this is the branch figure, so hours credited without presence in the store
  // (vacation days, "Sonstige" with hours) stay out of it, exactly as required.
  const totalWorkedMinutes = rows.reduce((sum, row) => sum + row.view.workedMinutes, 0);
  const totalTarget = rows
    .filter((row) => row.editable)
    .reduce(
      (acc, row) => {
        const range = targetWeeklyHoursRange(row.employee.employmentType);
        return { min: acc.min + range.min * 60, max: acc.max + range.max * 60 };
      },
      { min: 0, max: 0 },
    );
  const absentCount = new Set(
    absences
      .filter((a) => rows.some((row) => row.view.employeeId === a.employeeId))
      .map((a) => a.employeeId),
  ).size;

  // Read at execution time by every queued mutation instead of from a render closure: two quick
  // edits used to both start from the same pre-edit aggregate and silently lose the first write.
  const scheduleRef = useRef<WeeklySchedule | null>(null);
  useEffect(() => {
    scheduleRef.current = schedule;
  }, [schedule]);

  const applyStep = useCallback(
    async (step: HistoryStep, direction: HistoryDirection) => {
      const target = direction === 'undo' ? step.scheduleBefore : step.scheduleAfter;
      const saved = await services.schedule.save(target);
      for (const op of step.absenceOps) {
        const shouldExist = direction === 'undo' ? op.kind === 'deleted' : op.kind === 'created';
        if (shouldExist) {
          await services.absence.restore(op.absence);
        } else {
          await services.absence.delete(op.absence.id);
        }
      }
      scheduleRef.current = saved;
      setSchedule(saved);
      await reloadAbsences();
    },
    [reloadAbsences, setSchedule],
  );

  const history = useScheduleHistory({
    historyKey: `${branch?.id ?? 'none'}|${selectedWeek.year}|${selectedWeek.week}`,
    shortcutsEnabled: !editorState && !contextMenu && !weekSelectionOpen && !carryOverOpen,
    applyStep,
    onError: report,
  });
  const { run, record } = history;

  // Stable identity so the memoized ScheduleTable is not re-rendered by unrelated state changes
  // here (context menu, dialogs, error snackbar).
  const cellClick = useCallback((employeeId: EmployeeId, dayView: DayView) => {
    setEditorState({ employeeId, dayView });
  }, []);

  /** Writes a Shift/Off entry into one cell. Replacing an entry clears a single-day Absence on that
   * cell first (multi-day ranges stay blocked, see the *Disabled checks below) - the deletion is
   * recorded as part of the same history step, so one Strg+Z restores both. */
  const setEntryInCell = useCallback(
    (employeeId: EmployeeId, dayView: DayView, entry: DayEntry) =>
      run(async () => {
        const before = scheduleRef.current;
        if (!before) return null;

        const absenceOps: AbsenceOp[] = [];
        const existing = dayView.absence;
        if (existing && existing.from === dayView.date && existing.to === dayView.date) {
          await services.absence.delete(existing.id);
          absenceOps.push({ kind: 'deleted', absence: existing });
          await reloadAbsences();
        }

        const updated = await services.schedule.setDayEntryAndSave(before, employeeId, dayView.day, entry);
        scheduleRef.current = updated;
        setSchedule(updated);
        return { scheduleBefore: before, scheduleAfter: updated, absenceOps };
      }, 'Eintrag konnte nicht gespeichert werden'),
    [run, reloadAbsences, setSchedule],
  );

  const saveEntry = (entry: DayEntry) => {
    if (!editorState) return;
    setEntryInCell(editorState.employeeId, editorState.dayView, entry);
  };

  const saveAbsence = (type: 'Vacation' | 'Illness' | 'Other', details?: AbsenceDetails) => {
    if (!editorState) return;
    const { employeeId, dayView } = editorState;
    run(async () => {
      const before = scheduleRef.current;
      if (!before) return null;

      const absenceOps: AbsenceOp[] = [];
      const existing = dayView.absence;
      // Simpler than an update across the discriminated union: replace the existing entry (if any)
      // instead of trying to migrate it type-safely between the different kinds.
      if (existing && existing.from === dayView.date && existing.to === dayView.date) {
        await services.absence.delete(existing.id);
        absenceOps.push({ kind: 'deleted', absence: existing });
      }

      const created =
        type === 'Other'
          ? await services.absence.create({
              employeeId,
              type: 'Other',
              from: dayView.date,
              to: dayView.date,
              // DayEditor only calls this with a non-empty label for 'Other'; createAbsence rejects
              // an empty one, so nothing silently falls back to a placeholder text.
              label: details?.label ?? '',
              hoursPerDay: details?.hoursPerDay,
            })
          : await services.absence.create({ employeeId, type, from: dayView.date, to: dayView.date });
      absenceOps.push({ kind: 'created', absence: created });
      await reloadAbsences();

      // The schedule aggregate itself is untouched here; the step still carries it so an undo
      // restores a consistent pair.
      return { scheduleBefore: before, scheduleAfter: before, absenceOps };
    }, 'Abwesenheit konnte nicht gespeichert werden');
  };

  /** Both the header fields (save on blur) and the carry-over dialog hand back an already saved
   * aggregate, so they only have to be folded into the state and the history here. */
  const scheduleReplaced = useCallback(
    (updated: WeeklySchedule) => {
      const before = scheduleRef.current;
      scheduleRef.current = updated;
      setSchedule(updated);
      if (before) {
        record({ scheduleBefore: before, scheduleAfter: updated, absenceOps: [] });
      }
    },
    [record, setSchedule],
  );

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
      const cell = stack.map((el) => el.closest('[data-employeeid]')).find((el) => el);
      if (!(cell instanceof HTMLElement)) {
        setContextMenu(null);
        return;
      }
      e.preventDefault();
      const employeeId = cell.dataset.employeeid as EmployeeId;
      const day = cell.dataset.day;
      const row = visibleRows.find((r) => r.view.employeeId === employeeId);
      const dayView = row?.view.days.find((d) => d.day === day);
      // A locked cell offers no menu at all - the same rule the table applies to clicks and focus.
      if (!row || !dayView || isCellLocked(row, dayView.day)) {
        setContextMenu(null);
        return;
      }
      setContextMenu({ employeeId, dayView, x: e.clientX, y: e.clientY });
    };
    document.addEventListener('contextmenu', handler);
    return () => document.removeEventListener('contextmenu', handler);
  }, [visibleRows]);

  const copy = () => {
    if (!contextMenu) return;
    setCopiedEntry(contextMenu.dayView.entry);
    setContextMenu(null);
  };

  const paste = async () => {
    if (!contextMenu || !copiedEntry) return;
    const { employeeId, dayView } = contextMenu;
    setContextMenu(null);

    // Fresh ids for the pasted shifts/breaks, so they never collide with the ids of the copied
    // source. A manual netMinutesOverride is deliberately NOT carried along: it corrects one
    // specific day, and silently copying someone else's corrected hours would be surprising.
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

  const editorRow = editorState
    ? rows.find((r) => r.view.employeeId === editorState.employeeId)
    : undefined;

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
          <Tooltip title="Rückgängig (Strg+Z)">
            <span>
              <IconButton onClick={() => history.undo()} disabled={!history.canUndo} aria-label="Rückgängig">
                <UndoIcon />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Wiederholen (Strg+Y)">
            <span>
              <IconButton onClick={() => history.redo()} disabled={!history.canRedo} aria-label="Wiederholen">
                <RedoIcon />
              </IconButton>
            </span>
          </Tooltip>
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

      <ScheduleHeaderFields schedule={schedule} onSaved={scheduleReplaced} onError={report} />

      <Stack direction="row" gap={2} flexWrap="wrap" sx={{ mb: 3 }}>
        {[
          { label: 'Soll-Std. (Verträge)', value: formatHoursRangeGerman(totalTarget.min, totalTarget.max) },
          {
            label: 'Ist-Wochenstd. (gearbeitet)',
            value: minutesToDecimalHours(totalWorkedMinutes).toLocaleString('de-DE'),
          },
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

      {rows.length > 0 && (
        <TextField
          size="small"
          placeholder="Mitarbeiter suchen"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          aria-label="Mitarbeiter suchen"
          sx={{ mb: 2, width: 280 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchOutlinedIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
        />
      )}

      {schedule && visibleRows.length > 0 && (
        <ScheduleTable rows={visibleRows} validationResults={validationResults} onCellClick={cellClick} />
      )}

      {schedule && rows.length > 0 && visibleRows.length === 0 && (
        <Alert severity="info">Kein Mitarbeiter gefunden.</Alert>
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
        employeeList={employeeList}
        isHoliday={isHoliday}
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
          isHoliday={isHoliday}
          onApplied={scheduleReplaced}
          onError={report}
        />
      )}

      {editorState && editorRow && (
        <DayEditor
          open
          onClose={() => setEditorState(null)}
          onSave={saveEntry}
          onAbsenceSave={saveAbsence}
          employeeId={editorState.employeeId}
          employeeName={`${editorRow.employee.firstName} ${editorRow.employee.lastName}`}
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
