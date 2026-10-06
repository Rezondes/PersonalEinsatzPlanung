import type { TFunction } from 'i18next';
import type { DayEntry } from '@domain/schedule/EmployeeWeekAssignment';
import type { Shift } from '@domain/schedule/Shift';
import { withFreshShiftIds } from '@domain/schedule/Shift';
import type { ShiftTemplate, VacationHalfDay } from '@domain/schedule/ShiftTemplate';
import type { Absence, AbsenceInput, AbsenceType } from '@domain/absence/Absence';
import type { EmployeeId } from '@domain/shared/ids';
import { formatHoursGerman, shiftNetMinutes } from '@domain/schedule/scheduleCalculation';

/**
 * Something the user can apply to a day: the fixed "Frei" tile, whatever was last copied, or one of
 * their own saved shift templates. One type for all three, so the toolbar, the clipboard and the
 * drop target do not each grow their own three-way branch. The clipboard holds either a copied day
 * entry or a copied absence (see ScheduleView.copy), never both.
 */
export type ScheduleTool =
  | { kind: 'off' }
  | { kind: 'clipboard'; entry: DayEntry }
  | { kind: 'clipboard'; absence: CellAbsenceDraft }
  | { kind: 'template'; template: ShiftTemplate };

export const OFF_TOOL: ScheduleTool = { kind: 'off' };

/** Stable identity of a tool, for React keys and for the drag payload marker. */
export function toolKey(tool: ScheduleTool): string {
  switch (tool.kind) {
    case 'off':
      return 'off';
    case 'clipboard':
      return 'clipboard';
    case 'template':
      return `template:${tool.template.id}`;
  }
}

/**
 * The day entry this tool writes into a cell. A manual netMinutesOverride is deliberately never
 * carried along: it corrects one specific day (same rule the clipboard already followed), and a
 * Shift-kind template cannot even represent one - it holds Shift[], not a DayEntry.
 *
 * An absence-kind template or a copied absence has no DayEntry representation at all (see
 * domain/schedule/ShiftTemplate.ts - Absence is a separate aggregate). Callers must check
 * toolToAbsenceDraft FIRST and only fall back to this function when it returns null; the 'Off'
 * returned here for that case is a harmless default that should never actually be reached in the
 * real apply paths (ScheduleView.applyTool).
 */
export function toolToDayEntry(tool: ScheduleTool): DayEntry {
  switch (tool.kind) {
    case 'off':
      return { type: 'Off' };
    case 'template':
      return tool.template.kind === 'Shift'
        ? { type: 'Shift', shifts: withFreshShiftIds(tool.template.shifts) }
        : { type: 'Off' };
    case 'clipboard':
      return 'entry' in tool && tool.entry.type === 'Shift'
        ? { type: 'Shift', shifts: withFreshShiftIds(tool.entry.shifts) }
        : { type: 'Off' };
  }
}

/** A one-day absence a tool writes into one cell. Flat rather than a union: each field is only read
 * for the types its comment names, and cellAbsenceInput is the one place that turns it into a real
 * AbsenceInput. */
export interface CellAbsenceDraft {
  type: AbsenceType;
  /** Only 'Other': the Bezeichnung shown in the cell. */
  label?: string;
  /** Only 'Other'. */
  hoursPerDay?: number;
  /** Only 'Vacation'; no value means the whole day. */
  halfDay?: VacationHalfDay;
  /** Only Vacation/Illness/PublicHoliday, in minutes like Absence.creditedMinutesOverride. */
  creditedMinutesOverride?: number;
}

/** The absence this tool would write, or null for every tool that writes a DayEntry instead (off, a
 * copied day entry, a Shift-kind template). The one place that decides which of the two different
 * write paths (schedule.setDayEntryAndSave vs. absence.create/delete) a tool needs - see
 * ScheduleView.applyTool. */
export function toolToAbsenceDraft(tool: ScheduleTool): CellAbsenceDraft | null {
  if (tool.kind === 'clipboard') return 'absence' in tool ? tool.absence : null;
  if (tool.kind !== 'template') return null;
  const { template } = tool;
  switch (template.kind) {
    case 'Shift':
      return null;
    case 'Other':
      return { type: 'Other', label: template.label, hoursPerDay: template.hoursPerDay };
    case 'Vacation':
      return { type: 'Vacation', halfDay: template.halfDay, creditedMinutesOverride: template.creditedMinutesOverride };
    default:
      return { type: template.kind, creditedMinutesOverride: template.creditedMinutesOverride };
  }
}

/** The one-day Absence `draft` writes on `date` - shared by the single-cell and the bulk write path
 * in ScheduleView, so the half-day conversion exists once ('morning' = atStart, 'afternoon' = atEnd,
 * the same mapping as the Abwesenheiten dialog). */
export function cellAbsenceInput(employeeId: EmployeeId, date: string, draft: CellAbsenceDraft): AbsenceInput {
  const range = { employeeId, from: date, to: date };
  switch (draft.type) {
    case 'Other':
      // Every caller only gets here with a non-empty label; createAbsence rejects an empty one, so
      // nothing silently falls back to a placeholder text.
      return { ...range, type: 'Other', label: draft.label ?? '', hoursPerDay: draft.hoursPerDay };
    case 'Vacation':
      return {
        ...range,
        type: 'Vacation',
        halfDay: draft.halfDay && { atStart: draft.halfDay === 'morning', atEnd: draft.halfDay === 'afternoon' },
        creditedMinutesOverride: draft.creditedMinutesOverride,
      };
    default:
      return { ...range, type: draft.type, creditedMinutesOverride: draft.creditedMinutesOverride };
  }
}

/** Reverse of cellAbsenceInput's half-day conversion, read the same way as AbsencesView's chip: a
 * set atStart wins. */
function vacationHalfDay(halfDay: { atStart: boolean; atEnd: boolean } | undefined): VacationHalfDay | undefined {
  if (halfDay?.atStart) return 'morning';
  if (halfDay?.atEnd) return 'afternoon';
  return undefined;
}

/** The one-day draft a cell's absence stands for, the reverse of cellAbsenceInput - what "Kopieren"
 * and "Als Vorlage speichern" start from. A multi-day absence gives one plain day of its type: its
 * halfDay only marks the first or last day of the range, not the day that was clicked. */
export function absenceToCellDraft(absence: Absence): CellAbsenceDraft {
  switch (absence.type) {
    case 'Other':
      return { type: 'Other', label: absence.label, hoursPerDay: absence.hoursPerDay };
    case 'Vacation':
      return {
        type: 'Vacation',
        halfDay: absence.from === absence.to ? vacationHalfDay(absence.halfDay) : undefined,
        creditedMinutesOverride: absence.creditedMinutesOverride,
      };
    default:
      return { type: absence.type, creditedMinutesOverride: absence.creditedMinutesOverride };
  }
}

/** Whether `absence` is exactly the one-day absence `draft` would write. */
function absenceMatchesDraft(absence: Absence, draft: CellAbsenceDraft): boolean {
  if (absence.from !== absence.to || absence.type !== draft.type) return false;
  switch (absence.type) {
    case 'Other':
      return absence.label === draft.label && absence.hoursPerDay === draft.hoursPerDay;
    case 'Vacation':
      return (
        vacationHalfDay(absence.halfDay) === draft.halfDay &&
        absence.creditedMinutesOverride === draft.creditedMinutesOverride
      );
    default:
      return absence.creditedMinutesOverride === draft.creditedMinutesOverride;
  }
}

function shiftsMatch(a: Shift, b: Shift): boolean {
  if (a.start !== b.start || a.end !== b.end || a.endsNextDay !== b.endsNextDay) return false;
  if (a.breaks.length !== b.breaks.length) return false;
  return a.breaks.every((brk, i) => brk.start === b.breaks[i].start && brk.durationMinutes === b.breaks[i].durationMinutes);
}

/**
 * Whether a cell's ALREADY-SAVED entry is what applying `tool` there would produce - tap-to-assign
 * uses this to toggle a tile off (write `{ type: 'Off' }`) instead of reapplying an identical entry
 * when the user taps a cell a second time. Compares resolved shift times, ignoring generated ids
 * (`toolToDayEntry` always mints fresh ones via `withFreshShiftIds`) and any manual `netMinutesOverride`
 * (a tool can never carry one - see `toolToDayEntry`'s own comment).
 *
 * Order-independent (a multiset match, not a positional one): ShiftListEditor's removeShift/addShift
 * always drops from wherever the removed draft was and appends the new one at the end, so a day
 * edited by removing then re-adding one of two split shifts ends up with the same shifts in a
 * different array position - that must still count as a match, or the toggle-off tap silently
 * rewrites the day instead (a real case found during review, not a hypothetical).
 */
export function dayEntryMatchesTool(entry: DayEntry, tool: ScheduleTool): boolean {
  const candidate = toolToDayEntry(tool);
  if (entry.type === 'Off' || candidate.type === 'Off') {
    return entry.type === 'Off' && candidate.type === 'Off';
  }
  if (entry.shifts.length !== candidate.shifts.length) return false;
  const unmatched = [...candidate.shifts];
  return entry.shifts.every((shift) => {
    const i = unmatched.findIndex((candidateShift) => shiftsMatch(shift, candidateShift));
    if (i === -1) return false;
    unmatched.splice(i, 1);
    return true;
  });
}

/**
 * Whether a cell already shows what applying `tool` there would produce - the absence counterpart
 * to dayEntryMatchesTool, used by the same tap-to-assign toggle-off and isAssignTarget highlight.
 * Falls back to dayEntryMatchesTool unchanged for every tool that writes a DayEntry (off, a copied
 * day entry, a Shift-kind template), so existing callers only need to switch which function they
 * call, not add a branch of their own.
 */
export function toolMatchesCell(dayView: { entry: DayEntry; absence?: Absence }, tool: ScheduleTool): boolean {
  const absenceDraft = toolToAbsenceDraft(tool);
  if (absenceDraft) {
    return !!dayView.absence && absenceMatchesDraft(dayView.absence, absenceDraft);
  }
  return dayEntryMatchesTool(dayView.entry, tool);
}

export function toolLabel(tool: ScheduleTool, t: TFunction<'schedule'>): string {
  switch (tool.kind) {
    case 'off':
      return t('offMenuItem');
    case 'clipboard':
      return t('clipboardLabel');
    case 'template':
      return tool.template.name;
  }
}

function shiftsSummary(shifts: Shift[], t: TFunction<'schedule'>): string {
  if (shifts.length === 0) {
    return t('offMenuItem');
  }
  const times = shifts.map((s) => `${s.start}-${s.end}`).join(' / ');
  const netMinutes = shifts.reduce((sum, s) => sum + shiftNetMinutes(s), 0);
  return t('shiftsSummaryText', { times, hours: formatHoursGerman(netMinutes) });
}

/** Second line of a toolbar tile: the times behind the name, so two templates with similar names
 * stay distinguishable. */
/** hoursPerDay is already a plain number of hours (see domain/absence/Absence.ts), unlike the
 * Shift-kind summary above which starts from minutes - no minutesToDecimalHours conversion here. */
function otherSummary(label: string, hoursPerDay: number | undefined, t: TFunction<'schedule'>): string {
  return hoursPerDay === undefined
    ? t('otherSummaryPlain', { label })
    : t('otherSummaryWithHours', { label, hours: hoursPerDay.toLocaleString('de-DE') });
}

/** common.ts's display name for each absence type, so the toolbar and the template dialog use the
 * same words as the Tageseditor and the Abwesenheiten tab. */
export const ABSENCE_KIND_KEY = {
  Vacation: 'absenceKind.vacation',
  Illness: 'absenceKind.illness',
  PublicHoliday: 'absenceKind.publicHoliday',
  Other: 'absenceKind.other',
} as const satisfies Record<AbsenceType, string>;

/** "Urlaub (vormittags)", "Krankheit, 8 Std.", "Feiertag" - the half-day suffix is the Abwesenheiten
 * tab's own, so a template reads exactly like the absence it creates. */
function absenceSummary(draft: CellAbsenceDraft, t: TFunction<'schedule'>): string {
  if (draft.type === 'Other') {
    return otherSummary(draft.label ?? '', draft.hoursPerDay, t);
  }
  const halfDay = draft.halfDay
    ? t(draft.halfDay === 'morning' ? 'halfDayMorning' : 'halfDayAfternoon', { ns: 'absences' })
    : '';
  const kind = t(ABSENCE_KIND_KEY[draft.type], { ns: 'common' }) + halfDay;
  return draft.creditedMinutesOverride === undefined
    ? kind
    : t('absenceSummaryWithHours', { kind, hours: formatHoursGerman(draft.creditedMinutesOverride) });
}

export function toolSummary(tool: ScheduleTool, t: TFunction<'schedule'>): string {
  const absenceDraft = toolToAbsenceDraft(tool);
  if (absenceDraft) {
    return absenceSummary(absenceDraft, t);
  }
  switch (tool.kind) {
    case 'off':
      return t('emptyDayLabel');
    case 'template':
      // Only a Shift-kind template is left here; every other kind returned above.
      return tool.template.kind === 'Shift' ? shiftsSummary(tool.template.shifts, t) : '';
    case 'clipboard':
      // Only a copied day entry is left here; a copied absence returned above.
      return 'entry' in tool && tool.entry.type === 'Shift' ? shiftsSummary(tool.entry.shifts, t) : t('offMenuItem');
  }
}
