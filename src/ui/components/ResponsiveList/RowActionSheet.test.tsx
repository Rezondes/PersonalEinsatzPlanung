import { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import type { RowAction } from './RowAction';
import { RowActionSheet } from './RowActionSheet';

function editAction(overrides: Partial<RowAction> = {}): RowAction {
  return { key: 'edit', label: 'Bearbeiten', icon: EditOutlinedIcon, onSelect: vi.fn(), ...overrides };
}

function deleteAction(overrides: Partial<RowAction> = {}): RowAction {
  return {
    key: 'delete',
    label: 'Löschen',
    icon: DeleteOutlineIcon,
    hint: 'Kann nicht rückgängig gemacht werden',
    onSelect: vi.fn(),
    dangerous: true,
    ...overrides,
  };
}

/** RowActionSheet is fully controlled - like every real caller, this host actually flips `open`
 * to false in response to onClose, which the deferred-action (N24) test below depends on: the
 * SwipeableDrawer's exit transition (and thus onExited, which fires the pending action) never
 * starts unless `open` genuinely becomes false, not just the onClose callback firing. */
function Host({ actions }: { actions: RowAction[] }) {
  const [open, setOpen] = useState(true);
  return <RowActionSheet open={open} onClose={() => setOpen(false)} title="t" actions={actions} />;
}

describe('RowActionSheet', () => {
  it('renders the title, subtitle and every action with its label and hint', () => {
    render(
      <RowActionSheet open onClose={vi.fn()} title="Bauer, Anna" subtitle="Verkäuferin" actions={[editAction(), deleteAction()]} />,
    );

    expect(screen.getByText('Bauer, Anna')).toBeInTheDocument();
    expect(screen.getByText('Verkäuferin')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Bearbeiten/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Löschen/ })).toBeInTheDocument();
    expect(screen.getByText('Kann nicht rückgängig gemacht werden')).toBeInTheDocument();
  });

  it('renders nothing for an omitted subtitle', () => {
    render(<RowActionSheet open onClose={vi.fn()} title="Bauer, Anna" actions={[editAction()]} />);
    expect(screen.getByText('Bauer, Anna')).toBeInTheDocument();
  });

  it('closes without firing any action when Abbrechen is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const actions = [editAction(), deleteAction()];
    render(<RowActionSheet open onClose={onClose} title="t" actions={actions} />);

    await user.click(screen.getByRole('button', { name: 'Abbrechen' }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(actions[0].onSelect).not.toHaveBeenCalled();
    expect(actions[1].onSelect).not.toHaveBeenCalled();
  });

  it('closes the sheet immediately on an action click, but only fires the action once the close transition has finished (N24)', async () => {
    const user = userEvent.setup();
    const actions = [editAction(), deleteAction()];
    render(<Host actions={actions} />);

    await user.click(screen.getByRole('button', { name: /Bearbeiten/ }));

    // The chosen action must not fire until the close transition has actually finished, or it
    // would race a ConfirmDialog opening against this sheet's own closing focus trap.
    expect(actions[0].onSelect).not.toHaveBeenCalled();

    await waitFor(() => expect(actions[0].onSelect).toHaveBeenCalledTimes(1));
    expect(actions[1].onSelect).not.toHaveBeenCalled();
  });

  it('disables a disabled action so it cannot be activated', () => {
    const actions = [editAction({ disabled: true })];
    render(<RowActionSheet open onClose={vi.fn()} title="t" actions={actions} />);

    expect(screen.getByRole('button', { name: /Bearbeiten/ })).toBeDisabled();
  });

  // Teil 8, Package 11: ButtonBase has no disabled look of its own, so a disabled action looked
  // exactly like an active one that silently did nothing.
  it('makes a disabled action look disabled', () => {
    render(<RowActionSheet open onClose={vi.fn()} title="t" actions={[editAction({ disabled: true })]} />);

    expect(screen.getByRole('button', { name: /Bearbeiten/ })).toHaveStyle({ opacity: '0.38' });
  });

  // Teil 8, Package 12: the title was cut to one line with no way to read a long name.
  it('lets a long title wrap instead of cutting it to one line', () => {
    render(<RowActionSheet open onClose={vi.fn()} title="Ein sehr langer Mitarbeitername, Vorname" actions={[editAction()]} />);

    expect(screen.getByText('Ein sehr langer Mitarbeitername, Vorname')).not.toHaveStyle({ whiteSpace: 'nowrap' });
  });

  it('hat einen zugänglichen Namen gleich dem sichtbaren Titel', () => {
    render(<RowActionSheet open onClose={vi.fn()} title="Bauer, Anna" actions={[editAction()]} />);

    const titleText = screen.getByText('Bauer, Anna');
    const drawer = document.querySelector('.MuiDrawer-root')!;
    expect(drawer.getAttribute('aria-labelledby')).toBe(titleText.id);
  });
});
