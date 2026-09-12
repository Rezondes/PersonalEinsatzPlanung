import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { BranchId, ShiftTemplateId } from '@domain/shared/ids';
import { clockTime } from '@domain/shared/ClockTime';
import { createShift } from '@domain/schedule/Shift';
import type { ShiftTemplate } from '@domain/schedule/ShiftTemplate';
import type { DayEntry } from '@domain/schedule/EmployeeWeekAssignment';
import type { ScheduleTool } from '../scheduleTools';
import { OFF_TOOL } from '../scheduleTools';
import { ScheduleToolbar } from './ScheduleToolbar';

/** Tracks the width most recently passed to mockViewportWidth, so renderToolbar's default
 * `touchMode` mirrors it automatically. In the real app ScheduleView derives both `layout` and
 * `touchMode` from the exact same breakpoint and passes touchMode down as a prop - a test that
 * mocked one independently of the other could exercise a combination the app can never produce. */
let mockedWidth = 0;

/** jsdom has no real layout engine, so `window.matchMedia` is mocked per test to answer as if the
 * viewport were `width` wide - MUI's `theme.breakpoints.up(key)` produces a `(min-width:...px)`
 * query, which this parses back out. Copied from useBreakpoint.test.tsx. */
function mockViewportWidth(width: number) {
  mockedWidth = width;
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

const LAPTOP = 1700;
const TABLET_LANDSCAPE = 1100;
const TABLET_PORTRAIT = 800;
const MOBILE = 500;

const branchId = 'b1' as BranchId;

function makeTemplate(id: string, name: string, shift = createShift(clockTime('06:00'), clockTime('14:00'))): ShiftTemplate {
  return {
    id: id as ShiftTemplateId,
    branchId,
    name,
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
    onDragTool: vi.fn(),
    onCreate: vi.fn(),
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    touchMode: mockedWidth !== LAPTOP,
    assignModeActive: false,
    onFinishAssigning: vi.fn(),
    onCarryOver: vi.fn(),
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

  describe('non-collapsible layout (laptop and tablet)', () => {
    it.each([
      ['laptop', LAPTOP],
      ['tabletLandscape', TABLET_LANDSCAPE],
      ['tabletPortrait', TABLET_PORTRAIT],
    ])('renders one tile per tool and the "Vorlage" create button at %s width', (_name, width) => {
      mockViewportWidth(width);
      renderToolbar();

      expect(tileButton('Frei')).toBeInTheDocument();
      expect(tileButton('Frühschicht')).toBeInTheDocument();
      expect(tileButton('Spätschicht')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Vorlage' })).toBeInTheDocument();
      expect(screen.queryByText('Eigene Schichten anlegen, dann auf einen Tag ziehen.')).not.toBeInTheDocument();
    });

    it('shows the empty-templates hint only when there are no templates', () => {
      mockViewportWidth(LAPTOP);
      renderToolbar({ templates: [] });

      expect(tileButton('Frei')).toBeInTheDocument();
      expect(screen.getByText('Eigene Schichten anlegen, dann auf einen Tag ziehen.')).toBeInTheDocument();
    });

    it('calls onCreate when the "Vorlage" button is clicked', async () => {
      const user = userEvent.setup();
      mockViewportWidth(LAPTOP);
      const { onCreate } = renderToolbar();

      await user.click(screen.getByRole('button', { name: 'Vorlage' }));

      expect(onCreate).toHaveBeenCalledTimes(1);
    });

    it('marks only the active tile as pressed via aria-pressed', () => {
      mockViewportWidth(LAPTOP);
      renderToolbar({ activeTool: { kind: 'template', template: templateA } });

      expect(tileButton('Frühschicht')).toHaveAttribute('aria-pressed', 'true');
      expect(tileButton('Frei')).toHaveAttribute('aria-pressed', 'false');
      expect(tileButton('Spätschicht')).toHaveAttribute('aria-pressed', 'false');
    });

    it('shows the active clipboard tool as an extra tile', () => {
      mockViewportWidth(LAPTOP);
      renderToolbar({ activeTool: clipboardTool });

      expect(tileButton('Zwischenablage')).toBeInTheDocument();
    });

    it('does not show a clipboard tile when the active tool is not the clipboard', () => {
      mockViewportWidth(LAPTOP);
      renderToolbar({ activeTool: OFF_TOOL });

      expect(screen.queryByText('Zwischenablage')).not.toBeInTheDocument();
    });

    it('calls onSelect with the exact tool when a tile is clicked', async () => {
      const user = userEvent.setup();
      mockViewportWidth(LAPTOP);
      const { onSelect } = renderToolbar();

      await user.click(tileButton('Frühschicht'));
      expect(onSelect).toHaveBeenNthCalledWith(1, { kind: 'template', template: templateA });

      await user.click(tileButton('Frei'));
      expect(onSelect).toHaveBeenNthCalledWith(2, OFF_TOOL);
    });

    it('opens the tile menu and calls onEdit, closing the menu afterwards', async () => {
      const user = userEvent.setup();
      mockViewportWidth(LAPTOP);
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
      mockViewportWidth(LAPTOP);
      const { onDelete, onEdit } = renderToolbar();

      await user.click(screen.getByRole('button', { name: 'Spätschicht bearbeiten oder löschen' }));
      await user.click(screen.getByRole('menuitem', { name: 'Löschen' }));

      expect(onDelete).toHaveBeenCalledWith(templateB);
      expect(onEdit).not.toHaveBeenCalled();
      await waitFor(() => expect(screen.queryByRole('menuitem', { name: 'Löschen' })).not.toBeInTheDocument());
    });
  });

  describe('assign-mode banner', () => {
    it('is shown at laptop width too when assignModeActive is true (independent of touchMode)', () => {
      mockViewportWidth(LAPTOP);
      renderToolbar({ assignModeActive: true, activeTool: { kind: 'template', template: templateA } });

      expect(screen.getByText('Frühschicht zuweisen')).toBeInTheDocument();
      expect(screen.getByText('Tage antippen')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Zuweisen beenden' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Fertig' })).toBeInTheDocument();
      // The tile row stays visible alongside the banner at laptop width too.
      expect(tileButton('Frühschicht')).toBeInTheDocument();
    });

    it('is shown at tablet width alongside the tile row when assignModeActive is true', () => {
      mockViewportWidth(TABLET_LANDSCAPE);
      renderToolbar({ assignModeActive: true, activeTool: { kind: 'template', template: templateA } });

      expect(screen.getByText('Frühschicht zuweisen')).toBeInTheDocument();
      expect(screen.getByText('Tage antippen')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Zuweisen beenden' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Fertig' })).toBeInTheDocument();
      // The tile row stays visible alongside the banner at tablet width.
      expect(tileButton('Frühschicht')).toBeInTheDocument();
    });

    it('calls onFinishAssigning when the banner\'s close icon is clicked', async () => {
      const user = userEvent.setup();
      mockViewportWidth(TABLET_LANDSCAPE);
      const { onFinishAssigning } = renderToolbar({
        assignModeActive: true,
        activeTool: { kind: 'template', template: templateA },
      });

      await user.click(screen.getByRole('button', { name: 'Zuweisen beenden' }));
      expect(onFinishAssigning).toHaveBeenCalledTimes(1);
    });

    it('calls onFinishAssigning when the banner\'s "Fertig" button is clicked', async () => {
      const user = userEvent.setup();
      mockViewportWidth(TABLET_LANDSCAPE);
      const { onFinishAssigning } = renderToolbar({
        assignModeActive: true,
        activeTool: { kind: 'template', template: templateA },
      });

      await user.click(screen.getByRole('button', { name: 'Fertig' }));
      expect(onFinishAssigning).toHaveBeenCalledTimes(1);
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

  describe('drag and drop', () => {
    it('marks a tile draggable at laptop width and reports drag start/end to the parent', () => {
      mockViewportWidth(LAPTOP);
      const { onDragTool } = renderToolbar();
      const button = tileButton('Frühschicht');

      expect(button).toHaveAttribute('draggable', 'true');

      const dataTransfer = { setData: vi.fn(), effectAllowed: '' };
      fireEvent.dragStart(button, { dataTransfer });
      expect(onDragTool).toHaveBeenCalledWith({ kind: 'template', template: templateA });
      expect(dataTransfer.setData).toHaveBeenCalledWith('application/x-pep-tool', 'template:t1');
      expect(dataTransfer.effectAllowed).toBe('copy');

      fireEvent.dragEnd(button);
      expect(onDragTool).toHaveBeenLastCalledWith(null);
    });

    it('does not mark a tile draggable at tablet width and ignores drag events there', () => {
      mockViewportWidth(TABLET_LANDSCAPE);
      const { onDragTool } = renderToolbar();
      const button = tileButton('Frühschicht');

      expect(button).toHaveAttribute('draggable', 'false');

      fireEvent.dragStart(button, { dataTransfer: { setData: vi.fn(), effectAllowed: '' } });
      fireEvent.dragEnd(button);
      expect(onDragTool).not.toHaveBeenCalled();
    });

    it('does not mark a tile draggable at mobile width and ignores drag events there', async () => {
      const user = userEvent.setup();
      mockViewportWidth(MOBILE);
      const { onDragTool } = renderToolbar();

      await user.click(within(bar()).getByRole('button'));
      const button = tileButton('Frühschicht');

      expect(button).toHaveAttribute('draggable', 'false');

      fireEvent.dragStart(button, { dataTransfer: { setData: vi.fn(), effectAllowed: '' } });
      fireEvent.dragEnd(button);
      expect(onDragTool).not.toHaveBeenCalled();
    });
  });
});
