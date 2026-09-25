import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BackupPasswordDialog } from './BackupPasswordDialog';

describe('BackupPasswordDialog', () => {
  it('set mode: blocks submission and shows an inline error when the confirmation field does not match', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<BackupPasswordDialog mode="set" busy={false} onClose={vi.fn()} onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText(/^Passwort\s*\*?$/), 'geheimesPasswort');
    await user.type(screen.getByLabelText(/^Passwort bestätigen/), 'einAnderesPasswort');
    await user.click(screen.getByRole('button', { name: 'Festlegen' }));

    expect(await screen.findByText('Passwörter stimmen nicht überein.')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('set mode: submits the password once both fields match', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<BackupPasswordDialog mode="set" busy={false} onClose={vi.fn()} onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText(/^Passwort\s*\*?$/), 'geheimesPasswort');
    await user.type(screen.getByLabelText(/^Passwort bestätigen/), 'geheimesPasswort');
    await user.click(screen.getByRole('button', { name: 'Festlegen' }));

    expect(onSubmit).toHaveBeenCalledWith('geheimesPasswort');
  });

  it('enter mode: has a single field and shows the inline error passed in from a failed decrypt attempt', () => {
    render(
      <BackupPasswordDialog
        mode="enter"
        error="Falsches Passwort oder beschädigte Sicherung."
        busy={false}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByText('Falsches Passwort oder beschädigte Sicherung.')).toBeInTheDocument();
    expect(screen.queryByLabelText(/^Passwort bestätigen/)).not.toBeInTheDocument();
  });

  // Teil 8, Package 19: without autocomplete hints a password manager could fill in a site password,
  // which would then encrypt the backup with a value nobody knows.
  it('tells password managers which password is meant', () => {
    const { unmount } = render(<BackupPasswordDialog mode="set" busy={false} onClose={vi.fn()} onSubmit={vi.fn()} />);
    expect(screen.getByLabelText(/^Passwort\s*\*?$/)).toHaveAttribute('autocomplete', 'new-password');
    expect(screen.getByLabelText(/^Passwort bestätigen/)).toHaveAttribute('autocomplete', 'new-password');
    unmount();

    render(<BackupPasswordDialog mode="enter" busy={false} onClose={vi.fn()} onSubmit={vi.fn()} />);
    expect(screen.getByLabelText(/^Passwort\s*\*?$/)).toHaveAttribute('autocomplete', 'current-password');
  });

  // Teil 8, Package 19: a wrong password was a separate alert; the field itself looked fine.
  it('marks the field itself for a wrong password and puts the focus there', () => {
    // As in the app: the error arrives after a failed attempt, with the dialog already open.
    const { rerender } = render(<BackupPasswordDialog mode="enter" busy={false} onClose={vi.fn()} onSubmit={vi.fn()} />);
    rerender(
      <BackupPasswordDialog
        mode="enter"
        error="Falsches Passwort oder beschädigte Sicherung."
        busy={false}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    const field = screen.getByLabelText(/^Passwort\s*\*?$/);
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(field).toHaveAccessibleDescription('Falsches Passwort oder beschädigte Sicherung.');
    expect(field).toHaveFocus();
  });

  it('confirm mode: has two fields and blocks submission on a mismatch, catching a re-entry typo before export', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<BackupPasswordDialog mode="confirm" busy={false} onClose={vi.fn()} onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText(/^Passwort\s*\*?$/), 'exportPasswort');
    await user.type(screen.getByLabelText(/^Passwort bestätigen/), 'exportPasswortTippfehler');
    await user.click(screen.getByRole('button', { name: 'Bestätigen' }));

    expect(await screen.findByText('Passwörter stimmen nicht überein.')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('confirm mode: submits the password once both fields match, and never marks a password as newly configured', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<BackupPasswordDialog mode="confirm" busy={false} onClose={vi.fn()} onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText(/^Passwort\s*\*?$/), 'exportPasswort');
    await user.type(screen.getByLabelText(/^Passwort bestätigen/), 'exportPasswort');
    await user.click(screen.getByRole('button', { name: 'Bestätigen' }));

    expect(onSubmit).toHaveBeenCalledWith('exportPasswort');
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});
