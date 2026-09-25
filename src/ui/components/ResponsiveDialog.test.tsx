import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import { ResponsiveDialog } from './ResponsiveDialog';
import type { RowAction } from './ResponsiveList/RowAction';

const action: RowAction = { key: 'deactivate', label: 'Deaktivieren', icon: EditOutlinedIcon, onSelect: vi.fn() };

function renderDialog(props: Partial<Parameters<typeof ResponsiveDialog>[0]> = {}) {
  return render(
    <ResponsiveDialog open onClose={vi.fn()} title="Titel" actions={null} secondaryActions={[action]} {...props}>
      <p>Inhalt</p>
    </ResponsiveDialog>,
  );
}

describe('ResponsiveDialog', () => {
  // Teil 8, Package 12: a secondary action called the guarded onClose first, so on a changed form
  // "Änderungen verwerfen?" and the action's own confirm opened on top of each other.
  it('locks the secondary actions with a hint while the caller asks for it', () => {
    renderDialog({ secondaryActionsLocked: 'Erst speichern oder Änderungen verwerfen.' });

    expect(screen.getByRole('button', { name: 'Deaktivieren' })).toBeDisabled();
    expect(screen.getByText('Erst speichern oder Änderungen verwerfen.')).toBeInTheDocument();
  });

  it('locks the secondary actions while a save runs (no onClose)', () => {
    renderDialog({ onClose: undefined });

    expect(screen.getByRole('button', { name: 'Deaktivieren' })).toBeDisabled();
  });

  it('keeps the secondary actions usable otherwise', () => {
    renderDialog();

    expect(screen.getByRole('button', { name: 'Deaktivieren' })).toBeEnabled();
  });

  // Teil 8, Package 12: full screen on a laptop stretched every form field to ~1900px.
  it('keeps the content at a readable width', () => {
    renderDialog();

    expect(screen.getByText('Inhalt').parentElement).toHaveStyle({ maxWidth: '720px' });
  });

  it('lets a long title wrap instead of cutting it to one line', () => {
    renderDialog({ title: 'Ein sehr langer Name, der am Handy nicht in eine Zeile passt' });

    expect(screen.getByText('Ein sehr langer Name, der am Handy nicht in eine Zeile passt')).not.toHaveStyle({
      whiteSpace: 'nowrap',
    });
  });
});
