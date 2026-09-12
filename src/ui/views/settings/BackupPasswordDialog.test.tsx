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
