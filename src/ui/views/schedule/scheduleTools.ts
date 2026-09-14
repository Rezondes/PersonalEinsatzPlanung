import type { TFunction } from 'i18next';
import type { DayEntry } from '@domain/schedule/EmployeeWeekAssignment';
import type { Shift } from '@domain/schedule/Shift';
import { withFreshShiftIds } from '@domain/schedule/Shift';
import type { ShiftTemplate } from '@domain/schedule/ShiftTemplate';
import type { Absence } from '@domain/absence/Absence';
import { formatHoursGerman, shiftNetMinutes } from '@domain/schedule/scheduleCalculation';

/**
 * Something the user can apply to a day: the fixed "Frei" tile, whatever was last copied, or one of
 * their own saved shift templates. One type for all three, so the toolbar, the clipboard and the
 * drop target do not each grow their own three-way branch.
 */
export type ScheduleTool =
  | { kind: 'off' }
  | { kind: 'clipboard'; entry: DayEntry }
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
 * An Other-kind template has no DayEntry representation at all (see domain/schedule/ShiftTemplate.ts
 * - Absence is a separate aggregate). Callers must check toolToAbsenceDraft FIRST and only fall
 * back to this function when it returns null; the 'Off' returned here for that case is a harmless
 * default that should never actually be reached in the real apply paths (ScheduleView.applyTool).
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
      return tool.entry.type === 'Shift'
        ? { type: 'Shift', shifts: withFreshShiftIds(tool.entry.shifts) }
        : { type: 'Off' };
  }
}

/** The Sonstiges absence this tool would write, or null for every tool that writes a DayEntry
 * instead (off, clipboard, a Shift-kind template). The one place that decides which of the two
 * different write paths (schedule.setDayEntryAndSave vs. absence.create/delete) a tool needs -
 * see ScheduleView.applyTool. */
export function toolToAbsenceDraft(tool: ScheduleTool): { label: string; hoursPerDay?: number } | null {
  if (tool.kind === 'template' && tool.template.kind === 'Other') {
    return { label: tool.template.label, hoursPerDay: tool.template.hoursPerDay };
  }
  return null;
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
 * Whether a cell already shows what applying `tool` there would produce - the Other-kind
 * counterpart to dayEntryMatchesTool, used by the same tap-to-assign toggle-off and
 * isAssignTarget highlight. Falls back to dayEntryMatchesTool unchanged for every other tool
 * (off, clipboard, a Shift-kind template), so existing callers only need to switch which function
 * they call, not add a branch of their own.
 */
export function toolMatchesCell(dayView: { entry: DayEntry; absence?: Absence }, tool: ScheduleTool): boolean {
  const absenceDraft = toolToAbsenceDraft(tool);
  if (absenceDraft) {
    const absence = dayView.absence;
    return (
      !!absence &&
      absence.type === 'Other' &&
      absence.from === absence.to &&
      absence.label === absenceDraft.label &&
      absence.hoursPerDay === absenceDraft.hoursPerDay
    );
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

export function toolSummary(tool: ScheduleTool, t: TFunction<'schedule'>): string {
  switch (tool.kind) {
    case 'off':
      return t('emptyDayLabel');
    case 'template':
      return tool.template.kind === 'Shift'
        ? shiftsSummary(tool.template.shifts, t)
        : otherSummary(tool.template.label, tool.template.hoursPerDay, t);
    case 'clipboard':
      return tool.entry.type === 'Shift' ? shiftsSummary(tool.entry.shifts, t) : t('offMenuItem');
  }
}
