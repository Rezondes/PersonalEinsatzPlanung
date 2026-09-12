import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { useLongPress } from './useLongPress';

/** jsdom has no PointerEvent constructor at all (confirmed: typeof window.PointerEvent is
 * undefined), so dispatching real DOM pointer events through fireEvent never reliably carries
 * clientX/clientY into React's synthetic event. Calling the returned handlers directly with a
 * minimal fake event sidesteps that entirely and still exercises the real handler logic - only
 * clientX/clientY/isPrimary are read from the event, so that's all a fake needs. isPrimary
 * defaults to true, matching a real single-touch/mouse pointer - onPointerDown bails out early on
 * a non-primary pointer (a second simultaneous touch), so every test that means to exercise a
 * normal single press needs this set. */
function fakeEvent(clientX: number, clientY: number, isPrimary = true): ReactPointerEvent {
  return { clientX, clientY, isPrimary } as ReactPointerEvent;
}

describe('useLongPress', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('fires onLongPress after the delay and not onTap', () => {
    const onLongPress = vi.fn();
    const onTap = vi.fn();
    const { result } = renderHook(() => useLongPress({ onLongPress, onTap, delayMs: 500, moveThresholdPx: 10 }));

    act(() => result.current.onPointerDown(fakeEvent(0, 0)));
    act(() => vi.advanceTimersByTime(500));
    act(() => result.current.onPointerUp());

    expect(onLongPress).toHaveBeenCalledTimes(1);
    expect(onTap).not.toHaveBeenCalled();
  });

  it('fires onTap on a short press, not onLongPress', () => {
    const onLongPress = vi.fn();
    const onTap = vi.fn();
    const { result } = renderHook(() => useLongPress({ onLongPress, onTap, delayMs: 500, moveThresholdPx: 10 }));

    act(() => result.current.onPointerDown(fakeEvent(0, 0)));
    act(() => vi.advanceTimersByTime(200));
    act(() => result.current.onPointerUp());

    expect(onTap).toHaveBeenCalledTimes(1);
    expect(onLongPress).not.toHaveBeenCalled();
  });

  it('cancels the long-press when the pointer moves past the threshold before the delay', () => {
    const onLongPress = vi.fn();
    const onTap = vi.fn();
    const { result } = renderHook(() => useLongPress({ onLongPress, onTap, delayMs: 500, moveThresholdPx: 10 }));

    act(() => result.current.onPointerDown(fakeEvent(0, 0)));
    act(() => result.current.onPointerMove(fakeEvent(50, 0)));
    act(() => vi.advanceTimersByTime(500));
    act(() => result.current.onPointerUp());

    expect(onLongPress).not.toHaveBeenCalled();
    // A cancelled long-press also doesn't fall back to a tap - the gesture was a scroll, not a click.
    expect(onTap).not.toHaveBeenCalled();
  });

  it('cancels the pending timer on pointer cancel', () => {
    const onLongPress = vi.fn();
    const { result } = renderHook(() => useLongPress({ onLongPress, onTap: vi.fn(), delayMs: 500, moveThresholdPx: 10 }));

    act(() => result.current.onPointerDown(fakeEvent(0, 0)));
    act(() => result.current.onPointerCancel());
    act(() => vi.advanceTimersByTime(500));

    expect(onLongPress).not.toHaveBeenCalled();
  });

  it('calls onTap on a plain click, so a native button already translates Enter/Space into activation', () => {
    const onLongPress = vi.fn();
    const onTap = vi.fn();
    const { result } = renderHook(() => useLongPress({ onLongPress, onTap, delayMs: 500, moveThresholdPx: 10 }));

    act(() => result.current.onClick());

    expect(onTap).toHaveBeenCalledTimes(1);
    expect(onLongPress).not.toHaveBeenCalled();
  });
});
