import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfirmDialog } from './ConfirmDialog';

describe('ConfirmDialog', () => {
  it('renders the title and text, with "Bestätigen" as the default confirm label', () => {
    render(
      <ConfirmDialog
        open
        title="Mitarbeiter löschen?"
        text="Dies kann nicht rückgängig gemacht werden."
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByText('Mitarbeiter löschen?')).toBeInTheDocument();
    expect(screen.getByText('Dies kann nicht rückgängig gemacht werden.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Bestätigen' })).toBeInTheDocument();
  });

  it('renders a custom confirmText instead of the default when given', () => {
    render(<ConfirmDialog open title="t" text="x" confirmText="Löschen" onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Löschen' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Bestätigen' })).not.toBeInTheDocument();
  });

  it('calls onCancel when Abbrechen is clicked and onConfirm when the confirm button is clicked', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(<ConfirmDialog open title="t" text="x" onConfirm={onConfirm} onCancel={onCancel} />);

    await user.click(screen.getByRole('button', { name: 'Abbrechen' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Bestätigen' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('renders the confirm button as a contained-error (dangerous) button only when dangerous is true', () => {
    const { rerender } = render(<ConfirmDialog open title="t" text="x" onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Bestätigen' }).className).not.toMatch(/error/i);

    rerender(<ConfirmDialog open title="t" text="x" dangerous onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Bestätigen' }).className).toMatch(/error/i);
  });

  it('disables both buttons, shows a spinner, and blocks Escape-to-close while busy', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(<ConfirmDialog open title="t" text="x" busy onConfirm={vi.fn()} onCancel={onCancel} />);

    expect(screen.getByRole('button', { name: 'Abbrechen' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Bestätigen' })).toBeDisabled();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('does not render a spinner and keeps both buttons enabled while not busy', () => {
    render(<ConfirmDialog open title="t" text="x" onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Abbrechen' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Bestätigen' })).toBeEnabled();
  });
});
