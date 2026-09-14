import { describe, it, expect } from 'vitest';
import i18n from '@ui/i18n/i18n';
import { DEFAULT_LOCALE } from '@ui/app/locale/locale';
import type { AbsenceId, BranchId, EmployeeId } from '@domain/shared/ids';
import { clockTime } from '@domain/shared/ClockTime';
import { createShift } from '@domain/schedule/Shift';
import { createBreak } from '@domain/schedule/Break';
import { createShiftTemplate } from '@domain/schedule/ShiftTemplate';
import type { DayEntry } from '@domain/schedule/EmployeeWeekAssignment';
import {
  OFF_TOOL,
  dayEntryMatchesTool,
  toolKey,
  toolLabel,
  toolMatchesCell,
  toolSummary,
  toolToAbsenceDraft,
  toolToDayEntry,
} from './scheduleTools';

const branchId = 'b1' as BranchId;
const t = i18n.getFixedT(DEFAULT_LOCALE, 'schedule');

function shiftWithBreak() {
  const shift = createShift(clockTime('06:00'), clockTime('14:00'));
  return { ...shift, breaks: [createBreak(30, clockTime('10:00'))] };
}

const template = createShiftTemplate({ branchId, name: 'Frühschicht', kind: 'Shift', shifts: [shiftWithBreak()] });
const otherTemplate = createShiftTemplate({ branchId, name: 'Inventur', kind: 'Other', label: 'Inventur', hoursPerDay: 4 });

describe('toolToDayEntry', () => {
  it('empties the day for the Frei tool', () => {
    expect(toolToDayEntry(OFF_TOOL)).toEqual({ type: 'Off' });
  });

  it('writes a template as a shift entry', () => {
    const entry = toolToDayEntry({ kind: 'template', template });
    expect(entry.type).toBe('Shift');
    expect(entry.type === 'Shift' && entry.shifts[0].start).toBe('06:00');
  });

  it('gives every application fresh shift and break ids, so two cells never share one', () => {
    const first = toolToDayEntry({ kind: 'template', template });
    const second = toolToDayEntry({ kind: 'template', template });
    if (first.type !== 'Shift' || second.type !== 'Shift') throw new Error('expected shifts');

    expect(first.shifts[0].id).not.toBe(template.shifts[0].id);
    expect(first.shifts[0].id).not.toBe(second.shifts[0].id);
    expect(first.shifts[0].breaks[0].id).not.toBe(second.shifts[0].breaks[0].id);
    // The template itself is untouched.
    expect(template.shifts[0].breaks).toHaveLength(1);
  });

  it('never carries a manual day override along', () => {
    const source: DayEntry = { type: 'Shift', shifts: [shiftWithBreak()], netMinutesOverride: 90 };
    const entry = toolToDayEntry({ kind: 'clipboard', entry: source });
    expect(entry.type === 'Shift' && entry.netMinutesOverride).toBeUndefined();
  });

  it('copies an Off day from the clipboard as an empty day', () => {
    expect(toolToDayEntry({ kind: 'clipboard', entry: { type: 'Off' } })).toEqual({ type: 'Off' });
  });
});

describe('dayEntryMatchesTool', () => {
  it('matches Off against Off and nothing else', () => {
    expect(dayEntryMatchesTool({ type: 'Off' }, OFF_TOOL)).toBe(true);
    expect(dayEntryMatchesTool({ type: 'Off' }, { kind: 'template', template })).toBe(false);
  });

  it('matches a template application against the same template, ignoring fresh ids', () => {
    const applied = toolToDayEntry({ kind: 'template', template });
    expect(dayEntryMatchesTool(applied, { kind: 'template', template })).toBe(true);
  });

  it('does not match a manual netMinutesOverride difference - a tool can never carry one anyway', () => {
    const applied = toolToDayEntry({ kind: 'template', template });
    if (applied.type !== 'Shift') throw new Error('expected a shift');
    const overridden: DayEntry = { ...applied, netMinutesOverride: 90 };
    expect(dayEntryMatchesTool(overridden, { kind: 'template', template })).toBe(true);
  });

  it('does not match when the shift times differ', () => {
    const laterTemplate = createShiftTemplate({ branchId, name: 'Spätschicht', kind: 'Shift', shifts: [createShift(clockTime('14:00'), clockTime('22:00'))] });
    const applied = toolToDayEntry({ kind: 'template', template });
    expect(dayEntryMatchesTool(applied, { kind: 'template', template: laterTemplate })).toBe(false);
  });

  it('does not match a Shift entry against Off, or vice versa', () => {
    const applied = toolToDayEntry({ kind: 'template', template });
    expect(dayEntryMatchesTool(applied, OFF_TOOL)).toBe(false);
    expect(dayEntryMatchesTool({ type: 'Off' }, { kind: 'template', template })).toBe(false);
  });

  it('matches a multi-shift day even when the shifts are in a different array order', () => {
    // Regression: ShiftListEditor's removeShift/addShift always drops from wherever the removed
    // draft was and appends the new one at the end, so editing a split-shift day (e.g. remove the
    // first shift, re-add an identical one) leaves the two shifts in a different position than a
    // freshly-applied template would - that must still count as a match.
    const morning = createShift(clockTime('06:00'), clockTime('10:00'));
    const afternoon = createShift(clockTime('14:00'), clockTime('18:00'));
    const splitTemplate = createShiftTemplate({ branchId, name: 'Split', kind: 'Shift', shifts: [morning, afternoon] });
    const reordered: DayEntry = {
      type: 'Shift',
      shifts: [
        { ...afternoon, id: 'x1' },
        { ...morning, id: 'x2' },
      ],
    };
    expect(dayEntryMatchesTool(reordered, { kind: 'template', template: splitTemplate })).toBe(true);
  });

  it('does not match two shifts against one shift that happens to equal one of them', () => {
    const morning = createShift(clockTime('06:00'), clockTime('10:00'));
    const afternoon = createShift(clockTime('14:00'), clockTime('18:00'));
    const oneShiftTemplate = createShiftTemplate({ branchId, name: 'Morgens', kind: 'Shift', shifts: [morning] });
    const twoShifts: DayEntry = { type: 'Shift', shifts: [morning, afternoon] };
    expect(dayEntryMatchesTool(twoShifts, { kind: 'template', template: oneShiftTemplate })).toBe(false);
  });
});

describe('tool labels', () => {
  it('names each kind for the toolbar', () => {
    expect(toolLabel(OFF_TOOL, t)).toBe('Frei');
    expect(toolLabel({ kind: 'template', template }, t)).toBe('Frühschicht');
    expect(toolLabel({ kind: 'clipboard', entry: { type: 'Off' } }, t)).toBe('Zwischenablage');
  });

  it('summarises the times and net hours behind the name', () => {
    expect(toolSummary({ kind: 'template', template }, t)).toBe('06:00-14:00 · 7,5 Std.');
    expect(toolSummary(OFF_TOOL, t)).toBe('Tag leeren');
  });

  it('keys a template by its id, so tiles stay stable across reloads', () => {
    expect(toolKey({ kind: 'template', template })).toBe(`template:${template.id}`);
    expect(toolKey(OFF_TOOL)).toBe('off');
  });

  it('summarises an Other-kind template by its label and hours', () => {
    expect(toolLabel({ kind: 'template', template: otherTemplate }, t)).toBe('Inventur');
    expect(toolSummary({ kind: 'template', template: otherTemplate }, t)).toBe('Sonstige · Inventur · 4 Std.');
  });
});

describe('toolToAbsenceDraft', () => {
  it('returns the label and hours for an Other-kind template', () => {
    expect(toolToAbsenceDraft({ kind: 'template', template: otherTemplate })).toEqual({
      label: 'Inventur',
      hoursPerDay: 4,
    });
  });

  it('returns null for a Shift-kind template, the clipboard, and the Frei tool', () => {
    expect(toolToAbsenceDraft({ kind: 'template', template })).toBeNull();
    expect(toolToAbsenceDraft({ kind: 'clipboard', entry: { type: 'Off' } })).toBeNull();
    expect(toolToAbsenceDraft(OFF_TOOL)).toBeNull();
  });
});

describe('toolMatchesCell', () => {
  const otherDayView = (overrides: Partial<{ label: string; hoursPerDay?: number; from: string; to: string }> = {}) => ({
    entry: { type: 'Off' as const },
    absence: {
      id: 'a1' as AbsenceId,
      employeeId: 'e1' as EmployeeId,
      type: 'Other' as const,
      from: '2026-03-10',
      to: '2026-03-10',
      label: 'Inventur',
      hoursPerDay: 4,
      createdAt: '2026-01-01T00:00:00.000Z',
      ...overrides,
    },
  });

  it('matches an Other-kind template against an identical single-day Other absence on the cell', () => {
    expect(toolMatchesCell(otherDayView(), { kind: 'template', template: otherTemplate })).toBe(true);
  });

  it('does not match when the label or hours differ', () => {
    expect(toolMatchesCell(otherDayView({ label: 'Fortbildung' }), { kind: 'template', template: otherTemplate })).toBe(false);
    expect(toolMatchesCell(otherDayView({ hoursPerDay: 8 }), { kind: 'template', template: otherTemplate })).toBe(false);
  });

  it('does not match a multi-day absence, even with the same label/hours', () => {
    expect(
      toolMatchesCell(otherDayView({ from: '2026-03-09', to: '2026-03-10' }), { kind: 'template', template: otherTemplate }),
    ).toBe(false);
  });

  it('does not match a cell with no absence at all', () => {
    expect(toolMatchesCell({ entry: { type: 'Off' } }, { kind: 'template', template: otherTemplate })).toBe(false);
  });

  it('falls back to dayEntryMatchesTool for a Shift-kind template, unaffected by an unrelated absence field', () => {
    const applied = toolToDayEntry({ kind: 'template', template });
    expect(toolMatchesCell({ entry: applied }, { kind: 'template', template })).toBe(true);
    expect(toolMatchesCell({ entry: { type: 'Off' } }, { kind: 'template', template })).toBe(false);
  });
});
