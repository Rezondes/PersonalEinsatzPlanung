import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '@mui/material/styles';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { theme } from './theme';
import { UpdatePrompt } from './UpdatePrompt';

// The real module only exists while vite-plugin-pwa runs; vitest.config.ts aliases it to a stub.
// Here it is replaced outright, so the "an update is waiting" state can be produced at all.
vi.mock('virtual:pwa-register/react', () => ({ useRegisterSW: vi.fn() }));

const useRegisterSWMock = vi.mocked(useRegisterSW);
const updateServiceWorker = vi.fn(async () => {});
const setNeedRefresh = vi.fn();

// With the real theme, the same way App.tsx mounts it, so the test sees the app's actual German.
function renderPrompt() {
  return render(
    <ThemeProvider theme={theme}>
      <UpdatePrompt />
    </ThemeProvider>,
  );
}

/** waitingScriptURL simulates identifying WHICH update is pending, the way the fix distinguishes
 * "the same still-waiting update" from "a genuinely different one" across a remount (see
 * UpdatePrompt.tsx). mockImplementation, not mockReturnValue: onRegisteredSW has to actually run
 * so registration.current gets populated, exactly as the real hook does internally. */
function withUpdate(pending: boolean, waitingScriptURL = '/sw.js') {
  useRegisterSWMock.mockImplementation((options) => {
    options?.onRegisteredSW?.(
      '/sw.js',
      { waiting: pending ? ({ scriptURL: waitingScriptURL } as ServiceWorker) : null } as ServiceWorkerRegistration,
    );
    return {
      needRefresh: [pending, setNeedRefresh],
      offlineReady: [false, vi.fn()],
      updateServiceWorker,
    };
  });
}

describe('UpdatePrompt', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  it('stays out of the way while no update is waiting', () => {
    withUpdate(false);
    renderPrompt();

    expect(screen.queryByText(/neue Version/i)).not.toBeInTheDocument();
  });

  it('announces a waiting version in German', () => {
    withUpdate(true);
    renderPrompt();

    expect(screen.getByText('Eine neue Version ist verfügbar.')).toBeInTheDocument();
  });

  it('reloads only when the user asks for it', async () => {
    withUpdate(true);
    renderPrompt();

    // Nothing may happen on its own: a reload during an open day dialog destroys typed input.
    expect(updateServiceWorker).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Jetzt laden' }));

    expect(updateServiceWorker).toHaveBeenCalledWith(true);
  });

  it('can be dismissed without updating', async () => {
    withUpdate(true);
    renderPrompt();

    await userEvent.click(screen.getByRole('button', { name: 'Später' }));

    expect(setNeedRefresh).toHaveBeenCalledWith(false);
    expect(updateServiceWorker).not.toHaveBeenCalled();
  });

  it('does not reappear right away for the SAME still-waiting update after "Später", simulating a reload', async () => {
    withUpdate(true, '/sw.js');
    const { unmount } = renderPrompt();
    await userEvent.click(screen.getByRole('button', { name: 'Später' }));
    unmount();

    // A fresh mount with the identical pending update - e.g. the user reloaded the same tab.
    withUpdate(true, '/sw.js');
    renderPrompt();

    expect(screen.queryByText(/neue Version/i)).not.toBeInTheDocument();
  });

  it('shows an actually different update right away even after a previous dismissal, once remounted', async () => {
    withUpdate(true, '/sw.js');
    const { unmount } = renderPrompt();
    await userEvent.click(screen.getByRole('button', { name: 'Später' }));
    unmount();

    // A different update replaced the dismissed one by the time this tab (or a new one) opens.
    withUpdate(true, '/sw.js?v=2');
    renderPrompt();

    expect(screen.getByText('Eine neue Version ist verfügbar.')).toBeInTheDocument();
  });
});
