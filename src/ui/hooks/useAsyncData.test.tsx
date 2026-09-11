import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useAsyncData } from './useAsyncData';
import { useNotificationStore } from '@ui/app/store/notificationStore';

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('useAsyncData', () => {
  beforeEach(() => {
    useNotificationStore.getState().clear();
  });

  it('starts with the initial value and loading true, then resolves to the loaded value', async () => {
    const load = vi.fn().mockResolvedValue('loaded-value');

    const { result } = renderHook(() => useAsyncData('init', load, []));

    expect(result.current.data).toBe('init');
    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toBe('loaded-value');
  });

  it('re-invokes load and updates data/loading when reload() is called manually', async () => {
    const load = vi.fn().mockResolvedValueOnce('first').mockResolvedValueOnce('second');

    const { result } = renderHook(() => useAsyncData('init', load, []));
    await waitFor(() => expect(result.current.data).toBe('first'));
    expect(load).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.reload();
    });

    expect(load).toHaveBeenCalledTimes(2);
    expect(result.current.data).toBe('second');
    expect(result.current.loading).toBe(false);
  });

  it('lets setData optimistically update data without going through load', async () => {
    const load = vi.fn().mockResolvedValue('loaded-value');

    const { result } = renderHook(() => useAsyncData('init', load, []));
    await waitFor(() => expect(result.current.data).toBe('loaded-value'));

    act(() => {
      result.current.setData('optimistic');
    });

    expect(result.current.data).toBe('optimistic');
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('re-triggers load when deps change', async () => {
    const load = vi.fn().mockResolvedValue('value');

    const { rerender } = renderHook(({ dep }) => useAsyncData('init', load, [dep]), {
      initialProps: { dep: 1 },
    });
    await waitFor(() => expect(load).toHaveBeenCalledTimes(1));

    rerender({ dep: 2 });
    await waitFor(() => expect(load).toHaveBeenCalledTimes(2));
  });

  it('keeps the newer reload result when an older in-flight call resolves later (stale success)', async () => {
    const first = createDeferred<string>();
    const second = createDeferred<string>();
    const load = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);

    const { result } = renderHook(() => useAsyncData('init', load, []));
    await waitFor(() => expect(load).toHaveBeenCalledTimes(1));

    act(() => {
      result.current.reload();
    });
    await waitFor(() => expect(load).toHaveBeenCalledTimes(2));

    await act(async () => {
      second.resolve('second-value');
      await second.promise;
    });
    expect(result.current.data).toBe('second-value');
    expect(result.current.loading).toBe(false);

    await act(async () => {
      first.resolve('first-value');
      await first.promise;
    });

    expect(result.current.data).toBe('second-value');
    expect(result.current.loading).toBe(false);
  });

  it('does not let a stale rejection overwrite loading/data or raise a notification (stale error)', async () => {
    const first = createDeferred<string>();
    const second = createDeferred<string>();
    const load = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);

    const { result } = renderHook(() => useAsyncData('init', load, []));
    await waitFor(() => expect(load).toHaveBeenCalledTimes(1));

    act(() => {
      result.current.reload();
    });
    await waitFor(() => expect(load).toHaveBeenCalledTimes(2));

    await act(async () => {
      second.resolve('second-value');
      await second.promise;
    });
    expect(result.current.data).toBe('second-value');
    expect(result.current.loading).toBe(false);

    await act(async () => {
      first.reject(new Error('stale-boom'));
      await first.promise.catch(() => {});
    });

    expect(result.current.data).toBe('second-value');
    expect(result.current.loading).toBe(false);
    expect(useNotificationStore.getState().queue).toEqual([]);
  });

  it('reports the error and leaves data untouched when load rejects', async () => {
    const error = new Error('boom');
    const load = vi.fn().mockRejectedValue(error);

    const { result } = renderHook(() => useAsyncData('init', load, []));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data).toBe('init');
    expect(useNotificationStore.getState().queue).toEqual([
      expect.objectContaining({ severity: 'error', text: 'Daten konnten nicht geladen werden: boom' }),
    ]);
  });
});
