import { describe, it, expect, beforeEach } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '@mui/material/styles';
import { theme } from './theme';
import { AppNotifications } from './AppNotifications';
import { useNotificationStore } from './store/notificationStore';

// With the real theme, the same way App.tsx mounts it, so the test sees the app's actual German.
function renderHost() {
  return render(
    <ThemeProvider theme={theme}>
      <AppNotifications />
    </ThemeProvider>,
  );
}

/** The store is a module singleton, so every mutation has to go through act(). */
const store = () => useNotificationStore.getState();
const push = (fn: () => void) => act(fn);

describe('AppNotifications', () => {
  beforeEach(() => {
    store().clear();
  });

  it('shows nothing while there is nothing to say', () => {
    renderHost();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('announces an error as an alert, so a screen reader interrupts for it', () => {
    renderHost();
    push(() => store().notifyError('Google Drive ist nicht erreichbar.'));

    expect(screen.getByRole('alert')).toHaveTextContent('Google Drive ist nicht erreichbar.');
  });

  it('announces a success politely, as a status', () => {
    renderHost();
    push(() => store().notifySuccess('Backup wurde heruntergeladen.'));

    expect(screen.getByRole('status')).toHaveTextContent('Backup wurde heruntergeladen.');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('keeps the wording every view already used for a failed call', () => {
    renderHost();
    push(() => store().reportError(new Error('Netzwerkfehler.'), 'Vorlage konnte nicht gespeichert werden'));

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Vorlage konnte nicht gespeichert werden: Netzwerkfehler.',
    );
  });

  it('falls back to a sentence when what was thrown is not an Error', () => {
    renderHost();
    push(() => store().reportError('irgendwas'));

    expect(screen.getByRole('alert')).toHaveTextContent('Unbekannter Fehler.');
  });

  it('queues a second message instead of overwriting the first', async () => {
    renderHost();
    push(() => {
      store().notifyError('Erster Fehler.');
      store().notifyError('Zweiter Fehler.');
    });

    expect(screen.getByRole('alert')).toHaveTextContent('Erster Fehler.');

    await userEvent.click(screen.getByRole('button', { name: /close|schließen/i }));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Zweiter Fehler.'));
  });

  it('shows two identical messages rather than swallowing the second', () => {
    // Two cells failing from one cause produce byte-identical text. Dropping the duplicate would
    // leave one lost write with no feedback at all.
    renderHost();
    push(() => {
      store().notifyError('Eintrag konnte nicht gespeichert werden: Fehler.');
      store().notifyError('Eintrag konnte nicht gespeichert werden: Fehler.');
    });

    expect(store().queue).toHaveLength(2);
  });

  it('caps the backlog without dropping the one being read', () => {
    push(() => {
      for (let i = 1; i <= 8; i += 1) {
        store().notifyError(`Fehler ${i}.`);
      }
    });

    const queue = store().queue;
    expect(queue).toHaveLength(4);
    // The visible one survives; the oldest waiting ones are what gets dropped.
    expect(queue[0].text).toBe('Fehler 1.');
    expect(queue[queue.length - 1].text).toBe('Fehler 8.');
  });
});
