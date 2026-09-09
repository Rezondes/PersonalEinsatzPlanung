import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { StrictMode } from 'react';
import { useDismissOnBack } from './useDismissOnBack';

describe('useDismissOnBack', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not call onClose from its own StrictMode double-invoke', () => {
    // Regression test for the real bug this hook shipped with once: StrictMode synchronously
    // mounts, cleans up, and mounts an effect again. history.back() (called from the cleanup to
    // consume a stale pushed entry) is asynchronous, so an immediate call there fired its
    // popstate against the SECOND mount's listener - closing the sheet right after it opened.
    const onClose = vi.fn();
    const pushSpy = vi.spyOn(window.history, 'pushState');

    renderHook(() => useDismissOnBack(true, onClose), { wrapper: StrictMode });

    // Confirms this test actually exercised the double-invoke it's guarding against, not just a
    // single normal mount.
    expect(pushSpy.mock.calls.length).toBeGreaterThanOrEqual(2);

    act(() => vi.runAllTimers());
    expect(onClose).not.toHaveBeenCalled();

    pushSpy.mockRestore();
  });

  it('calls onClose when a real back gesture (popstate) fires', () => {
    const onClose = vi.fn();
    renderHook(() => useDismissOnBack(true, onClose), { wrapper: StrictMode });

    act(() => window.dispatchEvent(new PopStateEvent('popstate')));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('consumes the pushed entry via a deferred history.back() when closed by other means', () => {
    const backSpy = vi.spyOn(window.history, 'back').mockImplementation(() => {});
    const onClose = vi.fn();
    const { rerender } = renderHook(({ open }) => useDismissOnBack(open, onClose), {
      wrapper: StrictMode,
      initialProps: { open: true },
    });

    rerender({ open: false });
    act(() => vi.runAllTimers());

    expect(backSpy).toHaveBeenCalledTimes(1);
    backSpy.mockRestore();
  });

  it('does not leak a stale deferred history.back() into a DIFFERENT dialog instance opened before it fires', () => {
    // Regression test for the real bug found testing EmployeeDialog/ShiftTemplateDialog: this
    // hook's stale-entry cleanup is deferred via a real (un-mocked in those test files) setTimeout.
    // Vitest reuses one jsdom `window` across every `it()` in a file, so a first dialog's
    // still-pending timer was firing history.back() after a SECOND, unrelated dialog had already
    // mounted and attached its own popstate listener - closing a dialog that never actually
    // received a back gesture. The fix must cancel across instances, not just within one.
    const backSpy = vi.spyOn(window.history, 'back').mockImplementation(() => {});
    const closeA = vi.fn();
    const { unmount } = renderHook(() => useDismissOnBack(true, closeA));
    unmount(); // schedules dialog A's deferred history.back(), not yet run

    const closeB = vi.fn();
    renderHook(() => useDismissOnBack(true, closeB)); // dialog B opens before A's timer fires

    act(() => vi.runAllTimers());

    // The property that actually matters: B is never spuriously closed by A's leftover cleanup.
    expect(closeB).not.toHaveBeenCalled();
    // A's own deferred back() must not have fired either - B's mount cancels it outright (rather
    // than letting it run and consume B's freshly-pushed entry instead of A's). B's own eventual
    // close schedules its own consuming back() independently; that's a separate cycle, not
    // asserted here.
    expect(backSpy).not.toHaveBeenCalled();
    backSpy.mockRestore();
  });
});
