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

function withUpdate(pending: boolean) {
  useRegisterSWMock.mockReturnValue({
    needRefresh: [pending, setNeedRefresh],
    offlineReady: [false, vi.fn()],
    updateServiceWorker,
  });
}

describe('UpdatePrompt', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
});
