import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useActivationToggle } from './useActivationToggle';
import { useNotificationStore } from '@ui/app/store/notificationStore';

interface Widget {
  id: string;
  active: boolean;
}

describe('useActivationToggle', () => {
  beforeEach(() => {
    useNotificationStore.getState().clear();
  });

  it('starts with no target requested', () => {
    const service = { changeActiveStatus: vi.fn() };
    const reload = vi.fn();

    const { result } = renderHook(() => useActivationToggle(service, reload, 'Widget'));

    expect(result.current.target).toBeNull();
  });

  it('request() sets the target; cancel() clears it again without calling the service', () => {
    const service = { changeActiveStatus: vi.fn() };
    const reload = vi.fn();
    const widget: Widget = { id: 'w1', active: true };

    const { result } = renderHook(() => useActivationToggle(service, reload, 'Widget'));

    act(() => result.current.request(widget));
    expect(result.current.target).toBe(widget);

    act(() => result.current.cancel());
    expect(result.current.target).toBeNull();
    expect(service.changeActiveStatus).not.toHaveBeenCalled();
  });

  it('confirm() flips active through the service, reloads, and clears the target on success', async () => {
    const widget: Widget = { id: 'w1', active: true };
    const service = { changeActiveStatus: vi.fn().mockResolvedValue({ ...widget, active: false }) };
    const reload = vi.fn().mockResolvedValue(undefined);

    const { result } = renderHook(() => useActivationToggle(service, reload, 'Widget'));
    act(() => result.current.request(widget));

    await act(async () => {
      await result.current.confirm();
    });

    expect(service.changeActiveStatus).toHaveBeenCalledWith(widget, false);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(result.current.target).toBeNull();
  });

  it('confirm() shows a success notification worded with the entity label and the new state, for both directions (H8)', async () => {
    const activeWidget: Widget = { id: 'w1', active: true };
    const inactiveWidget: Widget = { id: 'w2', active: false };
    const service = {
      changeActiveStatus: vi.fn().mockImplementation(async (w: Widget, active: boolean) => ({ ...w, active })),
    };
    const reload = vi.fn().mockResolvedValue(undefined);

    const { result } = renderHook(() => useActivationToggle(service, reload, 'Widget'));

    act(() => result.current.request(activeWidget));
    await act(async () => {
      await result.current.confirm();
    });
    expect(useNotificationStore.getState().queue).toEqual([
      expect.objectContaining({ severity: 'success', text: 'Widget wurde deaktiviert.' }),
    ]);

    useNotificationStore.getState().clear();
    act(() => result.current.request(inactiveWidget));
    await act(async () => {
      await result.current.confirm();
    });
    expect(useNotificationStore.getState().queue).toEqual([
      expect.objectContaining({ severity: 'success', text: 'Widget wurde aktiviert.' }),
    ]);
  });

  it('sets busy while the service call is pending and clears it once settled, blocking a concurrent confirm() (M15)', async () => {
    const widget: Widget = { id: 'w1', active: true };
    let resolveStatus!: (value: Widget) => void;
    const service = {
      changeActiveStatus: vi.fn().mockReturnValue(
        new Promise<Widget>((res) => {
          resolveStatus = res;
        }),
      ),
    };
    const reload = vi.fn().mockResolvedValue(undefined);

    const { result } = renderHook(() => useActivationToggle(service, reload, 'Widget'));
    act(() => result.current.request(widget));
    expect(result.current.busy).toBe(false);

    let confirmed: Promise<void>;
    act(() => {
      confirmed = result.current.confirm();
    });
    expect(result.current.busy).toBe(true);

    await act(async () => {
      resolveStatus({ ...widget, active: false });
      await confirmed;
    });
    expect(result.current.busy).toBe(false);
  });

  it('confirm() is a no-op when no target was requested', async () => {
    const service = { changeActiveStatus: vi.fn() };
    const reload = vi.fn();

    const { result } = renderHook(() => useActivationToggle(service, reload, 'Widget'));

    await act(async () => {
      await result.current.confirm();
    });

    expect(service.changeActiveStatus).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
  });

  it('reports the error and clears the target, without reloading, when the service call rejects', async () => {
    const widget: Widget = { id: 'w1', active: true };
    const service = { changeActiveStatus: vi.fn().mockRejectedValue(new Error('Netzwerkfehler')) };
    const reload = vi.fn();

    const { result } = renderHook(() => useActivationToggle(service, reload, 'Widget'));
    act(() => result.current.request(widget));

    await act(async () => {
      await result.current.confirm();
    });

    expect(reload).not.toHaveBeenCalled();
    expect(result.current.target).toBeNull();
    expect(useNotificationStore.getState().queue).toEqual([
      expect.objectContaining({ severity: 'error', text: 'Status konnte nicht geändert werden: Netzwerkfehler' }),
    ]);
  });
});
