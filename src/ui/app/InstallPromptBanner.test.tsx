import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '@mui/material/styles';
import { theme } from './theme';
import { InstallPromptBanner } from './InstallPromptBanner';

interface FakeInstallEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/** Dispatches a real 'beforeinstallprompt' window event, the way a Chromium browser would - see
 * installPrompt.ts's own module-level listener, which this exercises directly rather than mocking
 * the hook/module (mirrors useOnlineStatus.test.tsx's convention for the same
 * window-event-plus-useSyncExternalStore shape). jsdom's Event doesn't know this PWA-only event's
 * shape, so prompt/userChoice are attached manually. */
function dispatchInstallOffer() {
  const promptMock = vi.fn(async () => {});
  const event = new Event('beforeinstallprompt') as unknown as FakeInstallEvent;
  event.prompt = promptMock;
  event.userChoice = Promise.resolve({ outcome: 'accepted' });
  act(() => {
    window.dispatchEvent(event);
  });
  return promptMock;
}

/** Resets installPrompt.ts's module-level deferredEvent singleton to a clean baseline - the same
 * real event this app itself listens for once the install offer is spent. */
function dispatchAppInstalled() {
  act(() => {
    window.dispatchEvent(new Event('appinstalled'));
  });
}

// With the real theme, the same way App.tsx mounts it, so the test sees the app's actual German.
function renderPrompt() {
  return render(
    <ThemeProvider theme={theme}>
      <InstallPromptBanner />
    </ThemeProvider>,
  );
}

describe('InstallPromptBanner', () => {
  beforeEach(() => {
    dispatchAppInstalled();
    sessionStorage.clear();
  });

  it('renders nothing when the browser has not offered to install', () => {
    renderPrompt();

    expect(screen.queryByText(/installiert werden/i)).not.toBeInTheDocument();
  });

  it('shows the install banner once the browser offers to install', () => {
    renderPrompt();
    dispatchInstallOffer();

    expect(screen.getByText('Diese App kann installiert werden.')).toBeInTheDocument();
  });

  it("calls the browser's real install prompt when 'App installieren' is clicked", async () => {
    renderPrompt();
    const promptMock = dispatchInstallOffer();

    await userEvent.click(screen.getByRole('button', { name: 'App installieren' }));

    expect(promptMock).toHaveBeenCalled();
  });

  it('hides the banner as soon as the install prompt is invoked', async () => {
    renderPrompt();
    dispatchInstallOffer();

    await userEvent.click(screen.getByRole('button', { name: 'App installieren' }));

    // Snackbar's own close transition keeps the node mounted briefly after `open` flips to
    // false - waitFor rather than a synchronous check, matching the real (delayed) DOM removal.
    await waitFor(() => expect(screen.queryByText('Diese App kann installiert werden.')).not.toBeInTheDocument());
  });

  it('can be dismissed without prompting installation', async () => {
    renderPrompt();
    const promptMock = dispatchInstallOffer();

    await userEvent.click(screen.getByRole('button', { name: 'Nicht jetzt' }));

    expect(promptMock).not.toHaveBeenCalled();
    // The dismissal's own persisted side effect, checked directly rather than racing the Snackbar
    // exit transition (see the previous test's comment).
    expect(sessionStorage.getItem('pep.install.dismissed')).toBe('1');
    await waitFor(() => expect(screen.queryByText('Diese App kann installiert werden.')).not.toBeInTheDocument());
  });

  it('remembers the dismissal across a remount, simulating a reload', async () => {
    const { unmount } = renderPrompt();
    dispatchInstallOffer();
    await userEvent.click(screen.getByRole('button', { name: 'Nicht jetzt' }));
    unmount();

    // A fresh mount with the offer re-fired, the way a real reload would re-offer install.
    dispatchInstallOffer();
    renderPrompt();

    expect(screen.queryByText('Diese App kann installiert werden.')).not.toBeInTheDocument();
  });

  it('stays dismissed even if the browser re-offers within the same mount', async () => {
    renderPrompt();
    dispatchInstallOffer();
    await userEvent.click(screen.getByRole('button', { name: 'Nicht jetzt' }));
    // Let the first dismissal's own close transition finish before re-offering, so the next
    // check can't mistake a still-closing node from THIS dismissal for a reopened one.
    await waitFor(() => expect(screen.queryByText('Diese App kann installiert werden.')).not.toBeInTheDocument());

    dispatchInstallOffer();

    expect(screen.queryByText('Diese App kann installiert werden.')).not.toBeInTheDocument();
  });

  it('shows again once sessionStorage is cleared, simulating a new tab', async () => {
    const { unmount } = renderPrompt();
    dispatchInstallOffer();
    await userEvent.click(screen.getByRole('button', { name: 'Nicht jetzt' }));
    unmount();
    sessionStorage.clear();

    dispatchInstallOffer();
    renderPrompt();

    expect(screen.getByText('Diese App kann installiert werden.')).toBeInTheDocument();
  });
});
