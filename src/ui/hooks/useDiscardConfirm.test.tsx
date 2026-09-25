import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useDiscardConfirm } from './useDiscardConfirm';

function Harness({ dirty, onClose }: { dirty: boolean; onClose: (() => void) | undefined }) {
  const { requestClose, confirmDialog } = useDiscardConfirm(dirty, onClose);
  return (
    <>
      <button type="button" disabled={!requestClose} onClick={requestClose}>
        schließen
      </button>
      {confirmDialog}
    </>
  );
}

describe('useDiscardConfirm', () => {
  it('closes right away when nothing was changed', async () => {
    const onClose = vi.fn();
    render(<Harness dirty={false} onClose={onClose} />);

    await userEvent.setup().click(screen.getByRole('button', { name: 'schließen' }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Änderungen verwerfen?')).not.toBeInTheDocument();
  });

  it('asks first when something was changed, and closes only after Verwerfen', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<Harness dirty onClose={onClose} />);

    await user.click(screen.getByRole('button', { name: 'schließen' }));

    expect(screen.getByText('Änderungen verwerfen?')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Verwerfen' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('keeps the dialog open on Weiter bearbeiten', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<Harness dirty onClose={onClose} />);

    await user.click(screen.getByRole('button', { name: 'schließen' }));
    await user.click(screen.getByRole('button', { name: 'Weiter bearbeiten' }));

    expect(onClose).not.toHaveBeenCalled();
  });

  it('stays locked while onClose is undefined (a save is in flight)', () => {
    render(<Harness dirty onClose={undefined} />);

    expect(screen.getByRole('button', { name: 'schließen' })).toBeDisabled();
  });
});
