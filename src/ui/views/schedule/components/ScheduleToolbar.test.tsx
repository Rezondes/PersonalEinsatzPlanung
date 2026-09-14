import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { BranchId, ShiftTemplateId } from '@domain/shared/ids';
import { clockTime } from '@domain/shared/ClockTime';
import { createShift } from '@domain/schedule/Shift';
import type { ShiftTemplate } from '@domain/schedule/ShiftTemplate';
import type { DayEntry } from '@domain/schedule/EmployeeWeekAssignment';
import type { ScheduleTool } from '../scheduleTools';
import { OFF_TOOL } from '../scheduleTools';
import { ScheduleToolbar } from './ScheduleToolbar';

/** jsdom has no real layout engine, so `window.matchMedia` is mocked per test to answer as if the
 * viewport were `width` wide - MUI's `theme.breakpoints.up(key)` produces a `(min-width:...px)`
 * query, which this parses back out. Copied from useBreakpoint.test.tsx. */
function mockViewportWidth(width: number) {
  window.matchMedia = ((query: string) => {
    const match = /min-width:\s*(\d+(?:\.\d+)?)px/.exec(query);
    const minWidth = match ? Number(match[1]) : 0;
    return {
      matches: width >= minWidth,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    } as unknown as MediaQueryList;
  }) as typeof window.matchMedia;
}

const TABLET = 1100;
const MOBILE = 500;

const branchId = 'b1' as BranchId;

function makeTemplate(id: string, name: string, shift = createShift(clockTime('06:00'), clockTime('14:00'))): ShiftTemplate {
  return {
    id: id as ShiftTemplateId,
    branchId,
    name,
    kind: 'Shift',
    shifts: [shift],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

const templateA = makeTemplate('t1', 'Frühschicht');
const templateB = makeTemplate('t2', 'Spätschicht', createShift(clockTime('14:00'), clockTime('20:00')));

const clipboardEntry: DayEntry = { type: 'Shift', shifts: [createShift(clockTime('09:00'), clockTime('12:00'))] };
const clipboardTool: ScheduleTool = { kind: 'clipboard', entry: clipboardEntry };

type ToolbarProps = Parameters<typeof ScheduleToolbar>[0];

function renderToolbar(overrides: Partial<ToolbarProps> = {}) {
  const props: ToolbarProps = {
    templates: [templateA, templateB],
    activeTool: null,
    onSelect: vi.fn(),
    onCreate: vi.fn(),
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    assignModeActive: false,
    onFinishAssigning: vi.fn(),
    selectionModeActive: false,
    onToggleSelectionMode: vi.fn(),
    selectedCount: 0,
    onApplyToSelection: vi.fn(),
    onFinishSelecting: vi.fn(),
    onCarryOver: vi.fn(),
    onCopyPreviousWeek: vi.fn(),
    onPrint: vi.fn(),
    printAvailable: false,
    headerFields: <div>header-fields-probe</div>,
    ...overrides,
  };
  render(<ScheduleToolbar {...props} />);
  return props;
}

/** The tile's own underlying <button> - `getByText` finds the label paragraph, `closest` walks up
 * to the actual interactive/draggable element (a sibling Box wraps it together with the "..." menu
 * IconButton for template tiles). */
function tileButton(label: string) {
  return screen.getByText(label).closest('button') as HTMLButtonElement;
}

/** The mobile-only "Weitere Aktionen" `<section aria-label>` - holds either the collapsed bar or
 * the assign banner (never both), and is a separate sibling of the sheet's own portal, so scoping
 * queries to it disambiguates from the sheet's identically-worded "Weitere Aktionen" heading, which
 * (per `SwipeableDrawer`'s forced `keepMounted`) stays in the DOM at all times, open or closed. */
function bar() {
  return screen.getByRole('region', { name: 'Weitere Aktionen' });
}

describe('ScheduleToolbar', () => {
  afterEach(() => {
    // @ts-expect-error -- undo the per-test stub, jsdom has no matchMedia of its own to restore
    delete window.matchMedia;
  });

  describe('non-collapsible layout (tablet)', () => {
    it('renders one tile per tool and the "Vorlage" create button', () => {
      mockViewportWidth(TABLET);
      renderToolbar();

      expect(tileButton('Frei')).toBeInTheDocument();
      expect(tileButton('Frühschicht')).toBeInTheDocument();
      expect(tileButton('Spätschicht')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Vorlage' })).toBeInTheDocument();
    });

    it('shows the empty-templates hint (tap wording) only when there are no templates', () => {
      mockViewportWidth(TABLET);
      renderToolbar({ templates: [] });

      expect(tileButton('Frei')).toBeInTheDocument();
      expect(screen.getByText('Eigene Schichten anlegen, dann auf einen Tag tippen.')).toBeInTheDocument();
    });

    it('calls onCreate when the "Vorlage" button is clicked', async () => {
      const user = userEvent.setup();
      mockViewportWidth(TABLET);
      const { onCreate } = renderToolbar();

      await user.click(screen.getByRole('button', { name: 'Vorlage' }));

      expect(onCreate).toHaveBeenCalledTimes(1);
    });

    it('marks only the active tile as pressed via aria-pressed', () => {
      mockViewportWidth(TABLET);
      renderToolbar({ activeTool: { kind: 'template', template: templateA } });

      expect(tileButton('Frühschicht')).toHaveAttribute('aria-pressed', 'true');
      expect(tileButton('Frei')).toHaveAttribute('aria-pressed', 'false');
      expect(tileButton('Spätschicht')).toHaveAttribute('aria-pressed', 'false');
    });

    it('shows the active clipboard tool as an extra tile', () => {
      mockViewportWidth(TABLET);
      renderToolbar({ activeTool: clipboardTool });

      expect(tileButton('Zwischenablage')).toBeInTheDocument();
    });

    it('does not show a clipboard tile when the active tool is not the clipboard', () => {
      mockViewportWidth(TABLET);
      renderToolbar({ activeTool: OFF_TOOL });

      expect(screen.queryByText('Zwischenablage')).not.toBeInTheDocument();
    });

    it('calls onSelect with the exact tool when a tile is clicked', async () => {
      const user = userEvent.setup();
      mockViewportWidth(TABLET);
      const { onSelect } = renderToolbar();

      await user.click(tileButton('Frühschicht'));
      expect(onSelect).toHaveBeenNthCalledWith(1, { kind: 'template', template: templateA });

      await user.click(tileButton('Frei'));
      expect(onSelect).toHaveBeenNthCalledWith(2, OFF_TOOL);
    });

    it('opens the tile menu and calls onEdit, closing the menu afterwards', async () => {
      const user = userEvent.setup();
      mockViewportWidth(TABLET);
      const { onEdit, onDelete } = renderToolbar();

      await user.click(screen.getByRole('button', { name: 'Frühschicht bearbeiten oder löschen' }));
      expect(screen.getByRole('menuitem', { name: 'Bearbeiten' })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: 'Löschen' })).toBeInTheDocument();

      await user.click(screen.getByRole('menuitem', { name: 'Bearbeiten' }));

      expect(onEdit).toHaveBeenCalledWith(templateA);
      expect(onDelete).not.toHaveBeenCalled();
      await waitFor(() => expect(screen.queryByRole('menuitem', { name: 'Bearbeiten' })).not.toBeInTheDocument());
    });

    it('opens the tile menu and calls onDelete, closing the menu afterwards', async () => {
      const user = userEvent.setup();
      mockViewportWidth(TABLET);
      const { onDelete, onEdit } = renderToolbar();

      await user.click(screen.getByRole('button', { name: 'Spätschicht bearbeiten oder löschen' }));
      await user.click(screen.getByRole('menuitem', { name: 'Löschen' }));

      expect(onDelete).toHaveBeenCalledWith(templateB);
      expect(onEdit).not.toHaveBeenCalled();
      await waitFor(() => expect(screen.queryByRole('menuitem', { name: 'Löschen' })).not.toBeInTheDocument());
    });
  });

  describe('assign-mode banner', () => {
    it('is shown alongside the tile row when assignModeActive is true', () => {
      mockViewportWidth(TABLET);
      renderToolbar({ assignModeActive: true, activeTool: { kind: 'template', template: templateA } });

      expect(screen.getByText('Frühschicht zuweisen')).toBeInTheDocument();
      expect(screen.getByText('Tage antippen')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Zuweisen beenden' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Fertig' })).toBeInTheDocument();
      // The tile row stays visible alongside the banner.
      expect(tileButton('Frühschicht')).toBeInTheDocument();
    });

    it('calls onFinishAssigning when the banner\'s close icon is clicked', async () => {
      const user = userEvent.setup();
      mockViewportWidth(TABLET);
      const { onFinishAssigning } = renderToolbar({
        assignModeActive: true,
        activeTool: { kind: 'template', template: templateA },
      });

      await user.click(screen.getByRole('button', { name: 'Zuweisen beenden' }));
      expect(onFinishAssigning).toHaveBeenCalledTimes(1);
    });

    it('calls onFinishAssigning when the banner\'s "Fertig" button is clicked', async () => {
      const user = userEvent.setup();
      mockViewportWidth(TABLET);
      const { onFinishAssigning } = renderToolbar({
        assignModeActive: true,
        activeTool: { kind: 'template', template: templateA },
      });

      await user.click(screen.getByRole('button', { name: 'Fertig' }));
      expect(onFinishAssigning).toHaveBeenCalledTimes(1);
    });
  });

  describe('selection mode (Mehrfachauswahl)', () => {
    it('renders the toggle button reflecting selectionModeActive via aria-pressed', () => {
      mockViewportWidth(TABLET);
      renderToolbar();

      expect(screen.getByRole('button', { name: 'Mehrfachauswahl' })).toHaveAttribute('aria-pressed', 'false');
    });

    it('calls onToggleSelectionMode when the toggle button is clicked', async () => {
      const user = userEvent.setup();
      mockViewportWidth(TABLET);
      const { onToggleSelectionMode } = renderToolbar();

      await user.click(screen.getByRole('button', { name: 'Mehrfachauswahl' }));

      expect(onToggleSelectionMode).toHaveBeenCalledTimes(1);
    });

    it('shows the selection banner with the selected count instead of the tile row\'s toggle state', () => {
      mockViewportWidth(TABLET);
      renderToolbar({ selectionModeActive: true, selectedCount: 3 });

      expect(screen.getByText('3 Zellen ausgewählt')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Auswahl beenden' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Fertig' })).toBeInTheDocument();
      // The tile row stays visible alongside the banner, so a tool can still be picked.
      expect(tileButton('Frühschicht')).toBeInTheDocument();
    });

    it('calls onFinishSelecting when the selection banner\'s close icon is clicked', async () => {
      const user = userEvent.setup();
      mockViewportWidth(TABLET);
      const { onFinishSelecting } = renderToolbar({ selectionModeActive: true, selectedCount: 2 });

      await user.click(screen.getByRole('button', { name: 'Auswahl beenden' }));
      expect(onFinishSelecting).toHaveBeenCalledTimes(1);
    });

    it('calls onFinishSelecting when the selection banner\'s "Fertig" button is clicked', async () => {
      const user = userEvent.setup();
      mockViewportWidth(TABLET);
      const { onFinishSelecting } = renderToolbar({ selectionModeActive: true, selectedCount: 2 });

      await user.click(screen.getByRole('button', { name: 'Fertig' }));
      expect(onFinishSelecting).toHaveBeenCalledTimes(1);
    });

    it('routes a tile click to onApplyToSelection instead of onSelect while selectionModeActive is true', async () => {
      const user = userEvent.setup();
      mockViewportWidth(TABLET);
      const { onSelect, onApplyToSelection } = renderToolbar({ selectionModeActive: true, selectedCount: 2 });

      await user.click(tileButton('Frei'));

      expect(onApplyToSelection).toHaveBeenCalledWith(OFF_TOOL);
      expect(onSelect).not.toHaveBeenCalled();
    });

    it('prefers the selection banner over the assign banner if both were somehow active at once', () => {
      mockViewportWidth(TABLET);
      renderToolbar({
        selectionModeActive: true,
        selectedCount: 1,
        assignModeActive: true,
        activeTool: { kind: 'template', template: templateA },
      });

      expect(screen.getByText('1 Zellen ausgewählt')).toBeInTheDocument();
      expect(screen.queryByText('Frühschicht zuweisen')).not.toBeInTheDocument();
    });

    it('replaces the mobile bar with the selection banner when selectionModeActive is true', () => {
      mockViewportWidth(MOBILE);
      renderToolbar({ selectionModeActive: true, selectedCount: 4 });

      expect(within(bar()).queryByText('Weitere Aktionen')).not.toBeInTheDocument();
      expect(within(bar()).getByText('4 Zellen ausgewählt')).toBeInTheDocument();
    });

    it('opens the sheet when the mobile selection banner label is tapped, distinct from the close icon', async () => {
      const user = userEvent.setup();
      mockViewportWidth(MOBILE);
      const { onFinishSelecting } = renderToolbar({ selectionModeActive: true, selectedCount: 2 });

      await user.click(within(bar()).getByText('2 Zellen ausgewählt'));

      expect(onFinishSelecting).not.toHaveBeenCalled();
      expect(screen.getByText('header-fields-probe')).toBeVisible();
    });

    it('shows the toggle button inside the mobile sheet\'s Aktionen section', async () => {
      const user = userEvent.setup();
      mockViewportWidth(MOBILE);
      const { onToggleSelectionMode } = renderToolbar();

      await user.click(within(bar()).getByRole('button'));
      await user.click(screen.getByRole('button', { name: 'Mehrfachauswahl' }));

      expect(onToggleSelectionMode).toHaveBeenCalledTimes(1);
      await waitFor(() => expect(screen.queryByRole('button', { name: 'Vorwoche übertragen' })).not.toBeInTheDocument());
    });

    it('routes a tile click inside the mobile sheet to onApplyToSelection and closes the sheet', async () => {
      const user = userEvent.setup();
      mockViewportWidth(MOBILE);
      const { onSelect, onApplyToSelection } = renderToolbar({ selectionModeActive: true, selectedCount: 2 });

      await user.click(within(bar()).getByText('2 Zellen ausgewählt'));
      await user.click(tileButton('Frühschicht'));

      expect(onApplyToSelection).toHaveBeenCalledWith({ kind: 'template', template: templateA });
      expect(onSelect).not.toHaveBeenCalled();
      await waitFor(() => expect(tileButton('Frühschicht')).not.toBeVisible());
    });
  });

  describe('mobile collapsible layout', () => {
    it('shows the "Weitere Aktionen" bar with the template count instead of the tile row', () => {
      mockViewportWidth(MOBILE);
      renderToolbar();

      expect(within(bar()).getByText('Weitere Aktionen')).toBeInTheDocument();
      expect(within(bar()).getByText('2 Vorlagen')).toBeInTheDocument();
      // The tile list lives in the (always-mounted, see `bar()`'s comment) sheet, merely hidden.
      expect(tileButton('Frühschicht')).not.toBeVisible();
      expect(screen.queryByRole('button', { name: 'Vorwoche übertragen' })).not.toBeInTheDocument();
    });

    it('opens the sheet on tap, showing the tile list, "Vorwoche übertragen" and the header fields', async () => {
      const user = userEvent.setup();
      mockViewportWidth(MOBILE);
      renderToolbar();

      await user.click(within(bar()).getByRole('button'));

      expect(screen.getByText('header-fields-probe')).toBeVisible();
      expect(screen.getByRole('button', { name: 'Vorwoche übertragen' })).toBeInTheDocument();
      expect(tileButton('Frei')).toBeVisible();
      expect(tileButton('Frühschicht')).toBeVisible();
      expect(tileButton('Spätschicht')).toBeVisible();
      // Both templates exist, so the sheet's own (touch-wording) empty-templates hint must not show.
      expect(screen.queryByText('Eigene Schichten anlegen, dann auf einen Tag tippen.')).not.toBeInTheDocument();
    });

    it('shows the sheet\'s own empty-templates hint only when there are no templates', async () => {
      const user = userEvent.setup();
      mockViewportWidth(MOBILE);
      renderToolbar({ templates: [] });

      await user.click(within(bar()).getByRole('button'));

      expect(tileButton('Frei')).toBeVisible();
      expect(screen.getByText('Eigene Schichten anlegen, dann auf einen Tag tippen.')).toBeVisible();
    });

    it('calls onCreate and closes the sheet when "Neu" is tapped', async () => {
      const user = userEvent.setup();
      mockViewportWidth(MOBILE);
      const { onCreate } = renderToolbar();

      await user.click(within(bar()).getByRole('button'));
      await user.click(screen.getByRole('button', { name: 'Neu' }));

      expect(onCreate).toHaveBeenCalledTimes(1);
      await waitFor(() => expect(screen.queryByRole('button', { name: 'Neu' })).not.toBeInTheDocument());
    });

    it('closes the sheet on the mobile back gesture instead of falling through to page navigation', async () => {
      const user = userEvent.setup();
      mockViewportWidth(MOBILE);
      renderToolbar();

      await user.click(within(bar()).getByRole('button'));
      expect(screen.getByRole('button', { name: 'Neu' })).toBeInTheDocument();

      act(() => window.dispatchEvent(new PopStateEvent('popstate')));

      await waitFor(() => expect(screen.queryByRole('button', { name: 'Neu' })).not.toBeInTheDocument());
    });

    it('shows the "aktiv" chip only on the active tile inside the sheet', async () => {
      const user = userEvent.setup();
      mockViewportWidth(MOBILE);
      renderToolbar({ activeTool: { kind: 'template', template: templateA } });

      await user.click(within(bar()).getByRole('button'));

      expect(within(tileButton('Frühschicht')).getByText('aktiv')).toBeInTheDocument();
      expect(within(tileButton('Spätschicht')).queryByText('aktiv')).not.toBeInTheDocument();
      expect(within(tileButton('Frei')).queryByText('aktiv')).not.toBeInTheDocument();
    });

    it('hides "Druckansicht" when printAvailable is false', async () => {
      const user = userEvent.setup();
      mockViewportWidth(MOBILE);
      renderToolbar({ printAvailable: false });

      await user.click(within(bar()).getByRole('button'));

      expect(screen.queryByRole('button', { name: 'Druckansicht' })).not.toBeInTheDocument();
    });

    it('shows "Druckansicht", wired to onPrint, and closes the sheet when printAvailable is true', async () => {
      const user = userEvent.setup();
      mockViewportWidth(MOBILE);
      const { onPrint } = renderToolbar({ printAvailable: true });

      await user.click(within(bar()).getByRole('button'));
      await user.click(screen.getByRole('button', { name: 'Druckansicht' }));

      expect(onPrint).toHaveBeenCalledTimes(1);
      await waitFor(() => expect(screen.queryByRole('button', { name: 'Vorwoche übertragen' })).not.toBeInTheDocument());
    });

    it('calls onCarryOver and closes the sheet when "Vorwoche übertragen" is clicked', async () => {
      const user = userEvent.setup();
      mockViewportWidth(MOBILE);
      const { onCarryOver } = renderToolbar();

      await user.click(within(bar()).getByRole('button'));
      await user.click(screen.getByRole('button', { name: 'Vorwoche übertragen' }));

      expect(onCarryOver).toHaveBeenCalledTimes(1);
      await waitFor(() => expect(screen.queryByRole('button', { name: 'Vorwoche übertragen' })).not.toBeInTheDocument());
    });

    it('calls onCopyPreviousWeek and closes the sheet when "Vorwoche kopieren" is clicked (H7)', async () => {
      const user = userEvent.setup();
      mockViewportWidth(MOBILE);
      const { onCopyPreviousWeek } = renderToolbar();

      await user.click(within(bar()).getByRole('button'));
      await user.click(screen.getByRole('button', { name: 'Vorwoche kopieren' }));

      expect(onCopyPreviousWeek).toHaveBeenCalledTimes(1);
      await waitFor(() => expect(screen.queryByRole('button', { name: 'Vorwoche kopieren' })).not.toBeInTheDocument());
    });

    it('selecting a tile inside the sheet calls onSelect and closes the sheet', async () => {
      const user = userEvent.setup();
      mockViewportWidth(MOBILE);
      const { onSelect } = renderToolbar();

      await user.click(within(bar()).getByRole('button'));
      await user.click(tileButton('Frühschicht'));

      expect(onSelect).toHaveBeenCalledWith({ kind: 'template', template: templateA });
      await waitFor(() => expect(tileButton('Frühschicht')).not.toBeVisible());
    });

    it('replaces the bar with the assign banner when assignModeActive is true', () => {
      mockViewportWidth(MOBILE);
      renderToolbar({ assignModeActive: true, activeTool: { kind: 'template', template: templateA } });

      expect(within(bar()).queryByText('Weitere Aktionen')).not.toBeInTheDocument();
      expect(within(bar()).getByText('Frühschicht zuweisen')).toBeInTheDocument();
      expect(within(bar()).getByText('Tage antippen')).toBeInTheDocument();
    });

    it('opens the sheet when the banner label is tapped, distinct from the close icon', async () => {
      const user = userEvent.setup();
      mockViewportWidth(MOBILE);
      const { onFinishAssigning } = renderToolbar({
        assignModeActive: true,
        activeTool: { kind: 'template', template: templateA },
      });

      await user.click(within(bar()).getByText('Frühschicht zuweisen'));

      expect(onFinishAssigning).not.toHaveBeenCalled();
      expect(screen.getByText('header-fields-probe')).toBeVisible();
    });

    it('calls onFinishAssigning without opening the sheet when the banner close icon is tapped', async () => {
      const user = userEvent.setup();
      mockViewportWidth(MOBILE);
      const { onFinishAssigning } = renderToolbar({
        assignModeActive: true,
        activeTool: { kind: 'template', template: templateA },
      });

      await user.click(within(bar()).getByRole('button', { name: 'Zuweisen beenden' }));

      expect(onFinishAssigning).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole('button', { name: 'Vorwoche übertragen' })).not.toBeInTheDocument();
    });

    it('calls onFinishAssigning without opening the sheet when "Fertig" is tapped', async () => {
      const user = userEvent.setup();
      mockViewportWidth(MOBILE);
      const { onFinishAssigning } = renderToolbar({
        assignModeActive: true,
        activeTool: { kind: 'template', template: templateA },
      });

      await user.click(within(bar()).getByRole('button', { name: 'Fertig' }));

      expect(onFinishAssigning).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole('button', { name: 'Vorwoche übertragen' })).not.toBeInTheDocument();
    });
  });
});
