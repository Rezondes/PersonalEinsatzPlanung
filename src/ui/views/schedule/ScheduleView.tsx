import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
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
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ContentPasteIcon from '@mui/icons-material/ContentPaste';
import EventBusyOutlinedIcon from '@mui/icons-material/EventBusyOutlined';
import BookmarkAddOutlinedIcon from '@mui/icons-material/BookmarkAddOutlined';
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined';
import UndoIcon from '@mui/icons-material/Undo';
import RedoIcon from '@mui/icons-material/Redo';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import {
  previousCalendarWeek,
  nextCalendarWeek,
  calendarWeekFromDate,
  calendarWeeksEqual,
  mondayOfWeek,
  dateForWeekday,
  formatCalendarWeekRange,
  WEEKDAYS,
} from '@domain/shared/CalendarWeek';
import { findOverlappingAbsences } from '@domain/absence/absenceOverlap';
import { toISODate } from '@domain/shared/DateFormat';
import type { Weekday } from '@domain/shared/CalendarWeek';
import type { EmployeeId } from '@domain/shared/ids';
import { fullName } from '@domain/employee/Employee';
import { formatHoursGerman, formatHoursRangeGerman } from '@domain/schedule/scheduleCalculation';
import { createWeekView, effectiveTargetMinutesRange } from '@application/schedule/scheduleAssessment';
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
import { ConfirmDialog } from '@ui/components/ConfirmDialog';
import { NoBranchSelectedAlert } from '@ui/components/NoBranchSelectedAlert';
import { ScheduleTable, cellKey } from './components/ScheduleTable';
import { ScheduleHeaderFields } from './components/ScheduleHeaderFields';
import { DayEditor } from './components/DayEditor';
import type { AbsenceDetails } from './components/DayEditor';
import type { AbsenceType } from '@domain/absence/Absence';
import { ValidationNotices } from './components/ValidationNotices';
import { WeekSelectionDialog } from './components/WeekSelectionDialog';
import { CarryOverPreviousWeekDialog } from './components/CarryOverPreviousWeekDialog';
import { useScheduleValidation } from './useScheduleValidation';
import { buildScheduleRows, canReceiveEntry, isCellLocked, isNotYetScheduled } from './scheduleRows';
import type { ScheduleRow } from './scheduleRows';
import type { ScheduleTool } from './scheduleTools';
import { OFF_TOOL, toolMatchesCell, toolToAbsenceDraft, toolToDayEntry } from './scheduleTools';
import { useBreakpoint } from '@ui/hooks/useBreakpoint';
import { usePageActions } from '@ui/app/PageActionsContext';
import { ScheduleToolbar } from './components/ScheduleToolbar';
import { ShiftTemplateDialog } from './components/ShiftTemplateDialog';
import type { ShiftTemplate } from '@domain/schedule/ShiftTemplate';
import type { ShiftDraft } from '@domain/schedule/shiftDraft';
import { shiftToDraft } from '@domain/schedule/shiftDraft';
import { useShiftTemplates } from '@ui/hooks/useShiftTemplates';
import { useScheduleHistory } from './useScheduleHistory';
import type { AbsenceOp, HistoryDirection, HistoryStep } from './useScheduleHistory';
import { notify } from '@ui/app/store/notificationStore';
import CircularProgress from '@mui/material/CircularProgress';
import { useLocale } from '@ui/app/locale/useLocale';
import { buildLocalizedPath } from '@ui/app/locale/locale';

export function ScheduleView() {
  const { t } = useTranslation('schedule');
  const { t: tCommon } = useTranslation();
  const { t: tNav } = useTranslation('nav');
  const { branch } = useSelectedBranch();
  const { employeeList, loading: employeeListLoading } = useEmployeeList(branch?.id ?? null);
  const selectedWeek = useCalendarWeekStore((s) => s.selectedWeek);
  const setSelectedWeek = useCalendarWeekStore((s) => s.setSelectedWeek);
  const { schedule, loading, setSchedule } = useSchedule(branch?.id ?? null, selectedWeek);
  const {
    absences,
    loading: absencesLoading,
    reload: reloadAbsences,
  } = useAbsences(employeeList.map((emp) => emp.id));
  // Combines every hook this view depends on for its initial paint, so the one loading overlay
  // below covers the whole multi-hook fetch window (schedule + employee list + absences) instead
  // of only the schedule fetch - without this there was a real window where the schedule had
  // already resolved but the employee list hadn't, flashing a "keine Mitarbeiter" state before it
  // arrived. Shift-template loading is deliberately excluded: it only means the toolbar briefly
  // shows fewer tiles, far less jarring than the table/alert flash this guards against.
  const isLoading = loading || employeeListLoading || absencesLoading;
  const { templates, reload: reloadTemplates } = useShiftTemplates(branch?.id ?? null);
  const validationResults = useScheduleValidation(schedule, branch, absences);
  const navigate = useNavigate();
  const locale = useLocale();

  const [editorState, setEditorState] = useState<{
    employeeId: EmployeeId;
    dayView: DayView;
  } | null>(null);

  const [contextMenu, setContextMenu] = useState<{
    employeeId: EmployeeId;
    dayView: DayView;
    row: ScheduleRow;
    x: number;
    y: number;
  } | null>(null);
  // The clipboard and the toolbar are the same thing: whatever is active here is what "Einfügen"
  // pastes, what a dropped tile writes, and what a clicked/tapped cell writes once assignModeActive
  // is armed.
  const [activeTool, setActiveTool] = useState<ScheduleTool | null>(null);
  // Armed by selectTool below whenever a toolbar tile is clicked/tapped - this is the sole gate
  // between "click opens DayEditor" and "click writes activeTool".
  const [assignModeActive, setAssignModeActive] = useState(false);
  // Mutually exclusive with tap-to-assign above (see toggleSelectionMode) - while active, a toolbar
  // tile click applies to every cell in selectedCells instead of arming assignModeActive. Keyed to
  // dayView.date via cellKey (ScheduleTable's own format), scoped to the currently displayed week -
  // see the reset effect below, next to the one that resets assignModeActive on a branch switch.
  const [selectionModeActive, setSelectionModeActive] = useState(false);
  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());
  const layout = useBreakpoint();
  // AppShell's Container becomes a bounded, non-scrolling flex column - see PageActionsContext's
  // doc comment on fullBleedPage. Every page calls this; ScheduleTable is the region below that
  // fills the bounded space and scrolls internally.
  usePageActions({ fullBleedPage: true });
  // null = closed, otherwise the template being edited (or drafts prefilled from a day).
  const [templateDialog, setTemplateDialog] = useState<
    { template: ShiftTemplate | null; drafts?: ShiftDraft[] } | null
  >(null);
  const [templateDeleteTarget, setTemplateDeleteTarget] = useState<ShiftTemplate | null>(null);
  const [templateDeleting, setTemplateDeleting] = useState(false);
  const [weekSelectionOpen, setWeekSelectionOpen] = useState(false);
  const [carryOverOpen, setCarryOverOpen] = useState(false);
  const [copyPreviousWeekOpen, setCopyPreviousWeekOpen] = useState(false);
  const [copyingPreviousWeek, setCopyingPreviousWeek] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const federalState = branch?.federalState;
  const isHoliday = useMemo(
    () => (federalState ? createHolidayCheck(federalState) : () => false),
    [federalState],
  );

  const weekStartISO = toISODate(mondayOfWeek(selectedWeek));
  const weekEndISO = toISODate(dateForWeekday(selectedWeek, 'Sonntag'));
  // ScheduleTable's day header needs each column's real calendar date (Aufgabe 3) - independent of
  // `rows` so it doesn't rely on rows being non-empty. Only changes on week navigation, same cadence
  // as `rows` itself, so it's safe for ScheduleTable's memo() boundary.
  const weekDays = useMemo(
    () => WEEKDAYS.map((day) => ({ day, date: toISODate(dateForWeekday(selectedWeek, day)) })),
    [selectedWeek],
  );

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
        // effectiveTargetMinutesRange, not the raw contract range: it folds in this week's
        // targetAdjustmentMinutes carry-over, same as the Soll column ScheduleTable.tsx renders
        // directly below this header tile (H2) - a mismatch here read as "this header disagrees
        // with the row underneath it" whenever a transfer had been applied.
        const range = effectiveTargetMinutesRange(row.employee, row.view);
        return { min: acc.min + range.min, max: acc.max + range.max };
      },
      { min: 0, max: 0 },
    );
  const notYetScheduledCount = rows.filter(isNotYetScheduled).length;

  // Read at execution time by every queued mutation instead of from a render closure: two quick
  // edits used to both start from the same pre-edit aggregate and silently lose the first write.
  const scheduleRef = useRef<WeeklySchedule | null>(null);
  useEffect(() => {
    scheduleRef.current = schedule;
  }, [schedule]);

  // Identifies which branch+week a mutation was started against - the same identity
  // useScheduleHistory itself uses to key undo steps, exposed here as a ref so setEntryInCell can
  // read it synchronously at the point a slow save resolves. Without this, a save that was still in
  // flight when the user switched weeks would write its (correctly saved) result into the state of
  // whatever week happens to be selected by the time it resolves, not the week it was saved for.
  const historyKey = `${branch?.id ?? 'none'}|${selectedWeek.year}|${selectedWeek.week}`;
  const requestKeyRef = useRef(historyKey);
  useEffect(() => {
    requestKeyRef.current = historyKey;
  }, [historyKey]);

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
    historyKey,
    shortcutsEnabled:
      !editorState &&
      !contextMenu &&
      !weekSelectionOpen &&
      !carryOverOpen &&
      !copyPreviousWeekOpen &&
      !templateDialog &&
      !templateDeleteTarget,
    applyStep,
    onError: notify.report,
  });
  const { run, record } = history;

  // Stable identity so the memoized ScheduleTable is not re-rendered by unrelated state changes
  // here (context menu, dialogs).
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
        const requestKey = requestKeyRef.current;

        const absenceOps: AbsenceOp[] = [];
        const existing = dayView.absence;
        if (existing && existing.from === dayView.date && existing.to === dayView.date) {
          await services.absence.delete(existing.id);
          absenceOps.push({ kind: 'deleted', absence: existing });
          await reloadAbsences();
        }

        const updated = await services.schedule.setDayEntryAndSave(before, employeeId, dayView.day, entry);
        // A week/branch switch while this save was in flight: the write is already correctly
        // stored in the database, but the currently displayed schedule belongs to a different
        // week now - only useScheduleHistory's own key check (see historyKey above) may still
        // record it for undo, the visible table must never be overwritten with it.
        if (requestKey === requestKeyRef.current) {
          scheduleRef.current = updated;
          setSchedule(updated);
        }
        return { scheduleBefore: before, scheduleAfter: updated, absenceOps };
      }, t('entryError')),
    [run, reloadAbsences, setSchedule, t],
  );

  const saveEntry = (entry: DayEntry) => {
    if (!editorState) return;
    setEntryInCell(editorState.employeeId, editorState.dayView, entry);
  };

  /** Writes a one-day Absence into a cell: deletes any existing single-day absence there first,
   * then creates the new one - both recorded as one undoable step. Shared by DayEditor's "Sonstige"
   * tab (via saveAbsence below) and applyTool's Other-kind-template path, so there is exactly one
   * place that implements "replace this cell's absence". The schedule aggregate itself is untouched
   * here; the step still carries it (before === after) so an undo restores a consistent pair. */
  const writeAbsenceToCell = useCallback(
    (employeeId: EmployeeId, dayView: DayView, type: AbsenceType, details?: AbsenceDetails) =>
      run(async () => {
        const before = scheduleRef.current;
        if (!before) return null;

        const absenceOps: AbsenceOp[] = [];
        const existing = dayView.absence;
        // Simpler than an update across the discriminated union: replace the existing entry (if
        // any) instead of trying to migrate it type-safely between the different kinds.
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
                // Both callers only reach this branch with a non-empty label; createAbsence rejects
                // an empty one, so nothing silently falls back to a placeholder text.
                label: details?.label ?? '',
                hoursPerDay: details?.hoursPerDay,
              })
            : await services.absence.create({
                employeeId,
                type,
                from: dayView.date,
                to: dayView.date,
                creditedMinutesOverride: details?.creditedMinutesOverride,
              });
        absenceOps.push({ kind: 'created', absence: created });
        await reloadAbsences();

        return { scheduleBefore: before, scheduleAfter: before, absenceOps };
      }, t('absenceSaveError')),
    [run, reloadAbsences, t],
  );

  /** H7: replaces this week's shifts with the previous week's, after the user has confirmed the
   * ConfirmDialog below - a separate, distinct action from the carry-over dialog above, which only
   * ever transfers the Soll/Ist hour difference, never actual shifts. */
  const copyPreviousWeek = async () => {
    if (!schedule) return;
    setCopyingPreviousWeek(true);
    try {
      const updated = await services.schedule.overwriteWithPreviousWeek(schedule);
      if (updated === schedule) {
        notify.error(t('noPreviousSchedule'));
      } else {
        scheduleReplaced(updated);
        notify.success(t('previousWeekCopied'));
      }
      setCopyPreviousWeekOpen(false);
    } catch (e) {
      notify.report(e, t('previousWeekCopyError'));
    } finally {
      setCopyingPreviousWeek(false);
    }
  };

  const saveAbsence = (type: AbsenceType, details?: AbsenceDetails) => {
    if (!editorState) return;
    writeAbsenceToCell(editorState.employeeId, editorState.dayView, type, details);
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
      setContextMenu({ employeeId, dayView, row, x: e.clientX, y: e.clientY });
    };
    document.addEventListener('contextmenu', handler);
    return () => document.removeEventListener('contextmenu', handler);
  }, [visibleRows]);

  // Deliberately copies only dayView.entry, never dayView.absence: the clipboard tool is a
  // DayEntry, the same structural limit toolToDayEntry has (see domain/schedule/CLAUDE.md). A cell
  // showing a Sonstiges absence has nothing useful to copy this way - only a saved Vorlage can
  // (re-)apply one, via toolToAbsenceDraft.
  const copy = () => {
    if (!contextMenu) return;
    setActiveTool({ kind: 'clipboard', entry: contextMenu.dayView.entry });
    setContextMenu(null);
  };

  /** Opens the template dialog prefilled with this day's shifts, so a working time that was just
   * built by hand can be kept without rebuilding it. */
  const saveAsTemplate = () => {
    if (!contextMenu) return;
    const { entry } = contextMenu.dayView;
    setContextMenu(null);
    if (entry.type !== 'Shift') return;
    setTemplateDialog({ template: null, drafts: entry.shifts.map(shiftToDraft) });
  };

  // The one place that decides which of the two write paths a tool needs: an Other-kind template
  // has no DayEntry representation at all (see domain/schedule/ShiftTemplate.ts), so it goes
  // through writeAbsenceToCell instead of setEntryInCell - shared by drag-and-drop (toolDrop),
  // tap-to-assign (toolTap) and "Einfügen" (paste), which all call this one function.
  const applyTool = useCallback(
    (tool: ScheduleTool, employeeId: EmployeeId, dayView: DayView) => {
      const absenceDraft = toolToAbsenceDraft(tool);
      if (absenceDraft) {
        return writeAbsenceToCell(employeeId, dayView, 'Other', absenceDraft);
      }
      return setEntryInCell(employeeId, dayView, toolToDayEntry(tool));
    },
    [setEntryInCell, writeAbsenceToCell],
  );

  // ScheduleToolbar's onSelect - a tile click/tap arms the tool AND starts tap-to-assign, so a
  // subsequent click/Enter on a cell applies it.
  const selectTool = useCallback((tool: ScheduleTool) => {
    setActiveTool(tool);
    setAssignModeActive(true);
  }, []);

  const finishAssigning = useCallback(() => {
    setAssignModeActive(false);
    setActiveTool(null);
  }, []);

  // Switching branches must drop out of tap-to-assign entirely: without resetting on branch.id, a
  // template armed under one branch would silently get written into a different branch's cells the
  // moment assign mode is still active when the user switches - toolToDayEntry never checks
  // template.branchId. Deliberately NOT keyed on layout: a tool armed at one width must keep
  // surviving a window resize instead of silently dropping the user's selection. activeTool
  // deliberately keeps surviving WEEK navigation (selectedWeek is not a dependency here) - that
  // persistence is a separate, existing, intentional design (see the clipboard/toolbar comment
  // above).
  useEffect(() => {
    finishAssigning();
  }, [branch?.id, finishAssigning]);

  const finishSelecting = useCallback(() => {
    setSelectionModeActive(false);
    setSelectedCells(new Set());
  }, []);

  // The toolbar's own toggle button - a plain flip when turning selection mode off (mirrors
  // finishSelecting so the banner's X/"Fertig" and the toggle button leave the feature in the same
  // state either way). Turning it ON also cancels any in-progress tap-to-assign: the two write modes
  // are mutually exclusive, and ScheduleToolbar only ever routes a tile click to ONE of onSelect/
  // onApplyToSelection based on selectionModeActive, so leaving assignModeActive on would silently
  // strand the "... zuweisen" banner underneath the selection banner.
  const toggleSelectionMode = useCallback(() => {
    if (selectionModeActive) {
      finishSelecting();
      return;
    }
    finishAssigning();
    setSelectionModeActive(true);
  }, [selectionModeActive, finishSelecting, finishAssigning]);

  const toggleCellSelection = useCallback((employeeId: EmployeeId, dayView: DayView) => {
    const key = cellKey(employeeId, dayView.date);
    setSelectedCells((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  // Selections are tied to specific calendar dates (see cellKey), not recurring weekday slots - a
  // "Montag" pick from last week means nothing for this week's Montag. Scoped by the same identity
  // as history/assign-mode resets above, so switching branch OR week always starts the feature fresh
  // instead of silently carrying stale, now-meaningless date keys forward.
  useEffect(() => {
    finishSelecting();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- selectedWeek is an object; year/week are its stable identity, same pattern as historyKey above.
  }, [branch?.id, selectedWeek.year, selectedWeek.week, finishSelecting]);

  /** Applies `tool` to every selected cell in one step, the selection-mode counterpart to applyTool
   * above. Never trusts the moment-of-selection eligibility: canReceiveEntry is re-checked per cell
   * against the CURRENT rows, exactly like ScheduleTable itself re-derives `droppable` on every
   * render rather than trusting an earlier snapshot. An Other-template write is additionally skipped
   * wherever ANY absence already covers that exact date (deliberately not excluding the cell's own
   * single-day absence the way writeAbsenceToCell's single-cell replace does - a bulk action with no
   * per-cell confirmation must never silently delete a recorded Vacation/Illness/PublicHoliday just
   * because it was swept into a multi-cell selection). Every DayEntry write goes through ONE
   * setDayEntriesAndSave call and every Absence write becomes one AbsenceOp[] - both folded into a
   * single history step via `run`, so one Strg+Z undoes the whole selection at once. */
  const applyBulkTool = useCallback(
    (tool: ScheduleTool) =>
      run(async () => {
        const before = scheduleRef.current;
        if (!before || selectedCells.size === 0) return null;

        const targets = rows
          .flatMap((row) => row.view.days.map((dayView) => ({ row, dayView })))
          .filter(({ row, dayView }) => selectedCells.has(cellKey(row.view.employeeId, dayView.date)));

        const absenceDraft = toolToAbsenceDraft(tool);
        const dayEntryWrites: { employeeId: EmployeeId; day: Weekday; entry: DayEntry }[] = [];
        const absenceOps: AbsenceOp[] = [];
        let skipped = 0;

        for (const { row, dayView } of targets) {
          if (!canReceiveEntry(row, dayView)) {
            skipped++;
            continue;
          }

          if (absenceDraft) {
            const conflicts = findOverlappingAbsences(
              { employeeId: row.view.employeeId, from: dayView.date, to: dayView.date },
              absences,
            );
            if (conflicts.length > 0) {
              skipped++;
              continue;
            }
            const created = await services.absence.create({
              employeeId: row.view.employeeId,
              type: 'Other',
              from: dayView.date,
              to: dayView.date,
              label: absenceDraft.label,
              hoursPerDay: absenceDraft.hoursPerDay,
            });
            absenceOps.push({ kind: 'created', absence: created });
          } else {
            const existing = dayView.absence;
            if (existing && existing.from === dayView.date && existing.to === dayView.date) {
              await services.absence.delete(existing.id);
              absenceOps.push({ kind: 'deleted', absence: existing });
            }
            dayEntryWrites.push({ employeeId: row.view.employeeId, day: dayView.day, entry: toolToDayEntry(tool) });
          }
        }

        if (dayEntryWrites.length === 0 && absenceOps.length === 0) {
          if (skipped > 0) {
            notify.error(t('bulkNoneUpdated', { skipped }));
          }
          return null;
        }

        const requestKey = requestKeyRef.current;
        if (absenceOps.length > 0) {
          await reloadAbsences();
        }
        const updated =
          dayEntryWrites.length > 0 ? await services.schedule.setDayEntriesAndSave(before, dayEntryWrites) : before;
        // Same stale-request guard as setEntryInCell above: a week/branch switch while this batch was
        // still in flight must not overwrite whatever week is displayed by the time it resolves.
        if (requestKey === requestKeyRef.current) {
          scheduleRef.current = updated;
          setSchedule(updated);
        }

        const appliedCount = targets.length - skipped;
        notify.success(
          skipped > 0
            ? t('bulkUpdatedWithSkipped', { applied: appliedCount, total: targets.length, skipped })
            : t('bulkUpdated', { applied: appliedCount, total: targets.length }),
        );
        finishSelecting();

        return { scheduleBefore: before, scheduleAfter: updated, absenceOps };
      }, t('bulkError')),
    [run, rows, selectedCells, absences, reloadAbsences, setSchedule, finishSelecting, t],
  );

  // ScheduleTable only calls this for a cell canReceiveEntry already accepted (same trust boundary
  // as toolDrop above, which never re-checks droppable either). Tapping a cell that already shows
  // exactly what activeTool would write clears it instead of reapplying the same entry - the
  // tap-to-assign equivalent of the "Frei" menu item toggling an already-off cell.
  //
  // This and isAssignTarget below both depend on activeTool, so arming a NEW tool (a toolbar tile
  // click, or right-click "Kopieren" - both ordinary, discrete, low-frequency actions) gives them a
  // new identity and defeats ScheduleTable's memo for one render - at every breakpoint alike, since
  // assignModeActive is armed the same way for mouse and touch/keyboard (see its declaration above),
  // not just in actual touch mode. A ref-based stable identity would avoid that, but would also stop
  // ScheduleTable from re-rendering when arming a DIFFERENT tool while assign mode is on - breaking
  // the live target-highlight update, which is the whole point of isAssignTarget. Accepted as-is:
  // this is one extra render on a discrete click, not a per-frame event like dragover (the actual
  // case the sibling drop-highlight-lives-in-ScheduleTable comment above is protecting against).
  const toolTap = useCallback(
    (employeeId: EmployeeId, dayView: DayView) => {
      if (!activeTool) return;
      const toWrite = toolMatchesCell(dayView, activeTool) ? OFF_TOOL : activeTool;
      applyTool(toWrite, employeeId, dayView);
    },
    [activeTool, applyTool],
  );

  const isAssignTarget = useCallback(
    (_employeeId: EmployeeId, dayView: DayView) => !!activeTool && toolMatchesCell(dayView, activeTool),
    [activeTool],
  );

  // Fresh ids for the pasted shifts/breaks and the dropped override rule both live in
  // scheduleTools.toolToDayEntry now, shared by the clipboard and the templates.
  const paste = async () => {
    if (!contextMenu || !activeTool) return;
    const { employeeId, dayView } = contextMenu;
    setContextMenu(null);
    await applyTool(activeTool, employeeId, dayView);
  };

  const setToOff = async () => {
    if (!contextMenu) return;
    const { employeeId, dayView } = contextMenu;
    setContextMenu(null);
    await setEntryInCell(employeeId, dayView, { type: 'Off' });
  };

  // One rule for every way of writing into a cell (see scheduleRows.canReceiveEntry).
  const cellWritable = !!contextMenu && canReceiveEntry(contextMenu.row, contextMenu.dayView);
  const pasteDisabled = !activeTool || !cellWritable;
  const isAlreadyOff = !!contextMenu && contextMenu.dayView.entry.type === 'Off' && !contextMenu.dayView.absence;
  const setToOffDisabled = isAlreadyOff || !cellWritable;
  // Saving a day as a template needs real, visible shifts: an Off day has none, and on a full-day
  // absence the entry may still hold stale shifts the grid does not show.
  const saveAsTemplateDisabled =
    !contextMenu ||
    contextMenu.dayView.entry.type !== 'Shift' ||
    contextMenu.dayView.entry.shifts.length === 0 ||
    contextMenu.dayView.absenceCoversWholeDay;

  if (!branch) {
    return <NoBranchSelectedAlert />;
  }

  const editorRow = editorState
    ? rows.find((r) => r.view.employeeId === editorState.employeeId)
    : undefined;

  // Rendered inline (non-mobile) or handed to ScheduleToolbar's mobile sheet (see the "Weitere
  // Aktionen" restructure below) - one instance either way, never both, since `layout` decides
  // exactly one placement each render.
  const headerFields = (
    <ScheduleHeaderFields schedule={schedule} disabled={isLoading} onSaved={scheduleReplaced} onError={notify.report} />
  );

  // Shares a row with headerFields on tablet/desktop (schedule-header-row below) and stays its own
  // standalone row on mobile - same "one JSX value, two placements" pattern as headerFields above.
  // A floating label (not just a placeholder) so its accessible name matches the two DecimalTextFields
  // it now sits next to.
  const searchField = (
    <TextField
      size="small"
      label={t('searchPlaceholder')}
      value={searchTerm}
      onChange={(e) => setSearchTerm(e.target.value)}
      sx={{ width: 280 }}
      InputProps={{
        startAdornment: (
          <InputAdornment position="start">
            <SearchOutlinedIcon fontSize="small" />
          </InputAdornment>
        ),
      }}
    />
  );

  // AppShell's fullBleedPage Container hands every view a bounded, zero-padding region between
  // the header and whatever fixed chrome sits below it (see PageActionsContext/AppShell) - to fill
  // it, this becomes a flex column itself, with its own px/py taking over the padding AppShell's
  // Container no longer supplies. Mobile omits pb deliberately: the "Weitere Aktionen" bar sits
  // flush against the fixed bottom tab bar (see its own mx:-1.5 trick), whereas tablet has no such
  // fixed bottom chrome to sit flush against, so it keeps a normal symmetric bottom padding instead.
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        minHeight: 0,
        height: '100%',
        px: layout === 'mobile' ? 1.5 : 3,
        pt: layout === 'mobile' ? 1.5 : 3,
        pb: layout === 'mobile' ? 0 : 3,
      }}
    >
      <Typography variant="h5" component="h1" fontWeight={500} sx={{ mb: 1 }}>
        {tNav('schedule')}
      </Typography>
      <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={2} sx={{ mb: 2 }}>
        <Box>
          {/* Branch name intentionally not repeated here - it's already shown in the header's
              Filiale dropdown directly above, at every breakpoint. */}
          <Typography
            variant="body2"
            color="text.secondary"
            onClick={() => setWeekSelectionOpen(true)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setWeekSelectionOpen(true);
              }
            }}
            role="button"
            tabIndex={0}
            aria-label={t('weekRangeAriaLabel', { range: formatCalendarWeekRange(selectedWeek) })}
            sx={(theme) => ({
              cursor: 'pointer',
              textDecoration: 'underline',
              textDecorationStyle: 'dotted',
              width: 'fit-content',
              '&:focus-visible': { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: 2 },
            })}
          >
            {formatCalendarWeekRange(selectedWeek)}
          </Typography>
        </Box>

        <Stack direction="row" gap={1} alignItems="center">
          <Tooltip title={t('undoTooltip')}>
            <span>
              <IconButton onClick={() => history.undo()} disabled={!history.canUndo} aria-label={t('undoAriaLabel')}>
                <UndoIcon />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title={t('redoTooltip')}>
            <span>
              <IconButton onClick={() => history.redo()} disabled={!history.canRedo} aria-label={t('redoAriaLabel')}>
                <RedoIcon />
              </IconButton>
            </span>
          </Tooltip>
          <IconButton onClick={() => setSelectedWeek(previousCalendarWeek(selectedWeek))} aria-label={t('previousWeekAriaLabel')}>
            <ChevronLeftIcon />
          </IconButton>
          <Button
            size="small"
            startIcon={<TodayOutlinedIcon />}
            onClick={() => setSelectedWeek(calendarWeekFromDate(new Date()))}
            disabled={calendarWeeksEqual(selectedWeek, calendarWeekFromDate(new Date()))}
          >
            {t('todayButton')}
          </Button>
          <IconButton onClick={() => setSelectedWeek(nextCalendarWeek(selectedWeek))} aria-label={t('nextWeekAriaLabel')}>
            <ChevronRightIcon />
          </IconButton>
          {/* Mobile: these two move into the "Weitere Aktionen" sheet's Aktionen section instead
              (see ScheduleToolbar) - this row has no room for 7 items on a phone, and the overflow
              used to be silently clipped rather than scrollable (AppShell's fullBleed Container is
              overflow:hidden on mobile). */}
          {layout !== 'mobile' && (
            <Button variant="outlined" startIcon={<SwapHorizOutlinedIcon />} onClick={() => setCarryOverOpen(true)}>
              {t('carryOverButton')}
            </Button>
          )}
          {layout !== 'mobile' && (
            <Button variant="outlined" startIcon={<ContentCopyOutlinedIcon />} onClick={() => setCopyPreviousWeekOpen(true)}>
              {t('copyPreviousWeekButton')}
            </Button>
          )}
          {layout !== 'mobile' && schedule && (
            <Button
              variant="outlined"
              startIcon={<PrintOutlinedIcon />}
              onClick={() => navigate(buildLocalizedPath(locale, `/print/${schedule.id}`))}
            >
              {t('printButton')}
            </Button>
          )}
        </Stack>
      </Stack>

      {layout !== 'mobile' && (
        <Stack
          data-testid="schedule-header-row"
          direction="row"
          justifyContent="space-between"
          alignItems="flex-start"
          flexWrap="wrap"
          gap={2}
          sx={{ mb: 2 }}
        >
          {rows.length > 0 && searchField}
          {headerFields}
        </Stack>
      )}

      <Box
        sx={{
          position: 'relative',
          opacity: isLoading ? 0.4 : 1,
          pointerEvents: isLoading ? 'none' : 'auto',
          transition: 'opacity 120ms',
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          minHeight: 0,
        }}
      >
        {isLoading && (
          <Stack
            alignItems="center"
            sx={{ position: 'absolute', inset: 0, justifyContent: 'center', zIndex: 3 }}
          >
            <CircularProgress />
          </Stack>
        )}

        {(() => {
          const notYetScheduledText = absencesLoading ? '–' : notYetScheduledCount.toLocaleString('de-DE');
          const chipSx = {
            flexShrink: 0,
            px: 1.5,
            py: 0.75,
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 4,
          };

          // Caption + value at every width, the same shape as "Nicht eingeplant" below, so the two
          // tiles are always equally tall (the old one-line "Ist X von Y Soll" on tablet was not).
          const istSollText = `${formatHoursGerman(totalWorkedMinutes)} / ${formatHoursRangeGerman(totalTarget.min, totalTarget.max)}`;

          return (
            <Stack direction="row" gap={1} sx={{ mb: 2, overflowX: 'auto', pb: 0.5 }}>
              <Box sx={{ ...chipSx, backgroundColor: 'background.paper' }}>
                <Typography variant="caption" color="text.secondary" noWrap display="block">
                  {t('istSollCaption')}
                </Typography>
                <Typography variant="body2" fontWeight={500} noWrap>
                  {istSollText}
                </Typography>
              </Box>

              <ValidationNotices
                results={validationResults}
                employeeList={employeeList}
                renderTrigger={({ errorCount, warningCount, onClick, expanded }) => (
                  <Box
                    component="button"
                    type="button"
                    onClick={onClick}
                    aria-expanded={expanded}
                    aria-haspopup="dialog"
                    sx={(theme) => ({
                      ...chipSx,
                      backgroundColor: theme.palette.errorSurface.subtle,
                      borderColor: theme.palette.errorSurface.border,
                      color: theme.palette.error.main,
                      font: 'inherit',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.5,
                    })}
                  >
                    <WarningAmberIcon fontSize="small" />
                    <Typography variant="body2" fontWeight={500} noWrap>
                      {t('errorSummary', { count: errorCount })}
                      {warningCount > 0 ? t('warningSuffix', { count: warningCount }) : ''}
                    </Typography>
                  </Box>
                )}
              />

              <Box sx={(theme) => ({ ...chipSx, backgroundColor: theme.palette.accentSurface.subtle, color: theme.palette.primary.main })}>
                <Typography variant="caption" color="text.secondary" noWrap display="block">
                  {t('notYetScheduledLabel')}
                </Typography>
                <Typography variant="body2" fontWeight={500} noWrap>
                  {notYetScheduledText}
                </Typography>
              </Box>
            </Stack>
          );
        })()}

      {!isLoading && employeeList.length === 0 && (
        <Alert severity="info" sx={{ mb: 2 }}>
          {t('noEmployeesAlert')}
        </Alert>
      )}

      {layout === 'mobile' && rows.length > 0 && <Box sx={{ mb: 2 }}>{searchField}</Box>}

      {(() => {
        const toolbar = (
          <ScheduleToolbar
            templates={templates}
            activeTool={activeTool}
            onSelect={selectTool}
            onCreate={() => setTemplateDialog({ template: null })}
            onEdit={(template) => setTemplateDialog({ template })}
            onDelete={setTemplateDeleteTarget}
            assignModeActive={assignModeActive}
            onFinishAssigning={finishAssigning}
            selectionModeActive={selectionModeActive}
            onToggleSelectionMode={toggleSelectionMode}
            selectedCount={selectedCells.size}
            onApplyToSelection={applyBulkTool}
            onFinishSelecting={finishSelecting}
            onCarryOver={() => setCarryOverOpen(true)}
            onCopyPreviousWeek={() => setCopyPreviousWeekOpen(true)}
            onPrint={() => schedule && navigate(buildLocalizedPath(locale, `/print/${schedule.id}`))}
            printAvailable={!!schedule}
            headerFields={headerFields}
          />
        );

        const tableSection = (
          <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
            {schedule && visibleRows.length > 0 && (
              <ScheduleTable
                rows={visibleRows}
                weekDays={weekDays}
                validationResults={validationResults}
                onCellClick={cellClick}
                assignMode={assignModeActive}
                onToolTap={toolTap}
                isAssignTarget={isAssignTarget}
                selectionMode={selectionModeActive}
                selectedCells={selectedCells}
                onToggleCellSelection={toggleCellSelection}
              />
            )}

            {schedule && rows.length > 0 && visibleRows.length === 0 && (
              <Alert severity="info">{t('noEmployeeFound')}</Alert>
            )}
          </Box>
        );

        // Mobile: the toolbar bar must be the LAST flex child so it lands directly above the fixed
        // bottom tab bar (see Aufgabe 2) - the grid comes first and takes the remaining flex:1
        // space above it. Tablet keeps today's order (toolbar above the grid) unchanged.
        return layout === 'mobile' ? (
          <>
            {tableSection}
            {toolbar}
          </>
        ) : (
          <>
            {toolbar}
            {tableSection}
          </>
        );
      })()}
      </Box>

      <Menu
        open={!!contextMenu}
        onClose={() => setContextMenu(null)}
        anchorReference="anchorPosition"
        anchorPosition={contextMenu ? { top: contextMenu.y, left: contextMenu.x } : undefined}
      >
        <MenuItem onClick={copy}>
          <ContentCopyIcon fontSize="small" sx={{ mr: 1 }} />
          {t('copyMenuItem')}
        </MenuItem>
        <MenuItem onClick={paste} disabled={pasteDisabled}>
          <ContentPasteIcon fontSize="small" sx={{ mr: 1 }} />
          {t('pasteMenuItem')}
        </MenuItem>
        <MenuItem onClick={setToOff} disabled={setToOffDisabled}>
          <EventBusyOutlinedIcon fontSize="small" sx={{ mr: 1 }} />
          {t('offMenuItem')}
        </MenuItem>
        <MenuItem onClick={saveAsTemplate} disabled={saveAsTemplateDisabled}>
          <BookmarkAddOutlinedIcon fontSize="small" sx={{ mr: 1 }} />
          {t('saveAsTemplateMenuItem')}
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
          onError={notify.report}
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
          birthDate={editorRow.employee.birthDate}
        />
      )}

      {templateDialog && (
        <ShiftTemplateDialog
          branchId={branch.id}
          template={templateDialog.template}
          initialDrafts={templateDialog.drafts}
          onClose={() => setTemplateDialog(null)}
          onSaved={reloadTemplates}
          onError={notify.report}
        />
      )}

      <ConfirmDialog
        open={!!templateDeleteTarget}
        title={t('deleteTemplateTitle')}
        text={t('deleteTemplateText', { name: templateDeleteTarget?.name ?? '' })}
        confirmText={tCommon('delete')}
        dangerous
        busy={templateDeleting}
        onConfirm={async () => {
          if (!templateDeleteTarget) return;
          setTemplateDeleting(true);
          try {
            await services.shiftTemplate.delete(templateDeleteTarget.id);
            if (activeTool?.kind === 'template' && activeTool.template.id === templateDeleteTarget.id) {
              // finishAssigning, not a bare setActiveTool(null): deleting the armed tool must also
              // drop out of tap-to-assign, or the banner is left showing an empty "" zuweisen" with
              // nothing left for a tap to write.
              finishAssigning();
            }
            await reloadTemplates();
          } catch (e) {
            notify.report(e, t('deleteTemplateError'));
          } finally {
            setTemplateDeleteTarget(null);
            setTemplateDeleting(false);
          }
        }}
        onCancel={() => setTemplateDeleteTarget(null)}
      />

      <ConfirmDialog
        open={copyPreviousWeekOpen}
        title={t('copyPreviousWeekTitle')}
        text={t('copyPreviousWeekText')}
        confirmText={t('copyPreviousWeekConfirm')}
        dangerous
        busy={copyingPreviousWeek}
        onConfirm={copyPreviousWeek}
        onCancel={() => setCopyPreviousWeekOpen(false)}
      />
    </Box>
  );
}
