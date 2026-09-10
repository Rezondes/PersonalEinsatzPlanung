import { useCallback, useRef } from 'react';
import type { PointerEvent } from 'react';

interface UseLongPressOptions {
  onLongPress: () => void;
  /** Fires on a short tap/click - i.e. a pointer up that didn't already trigger onLongPress. */
  onTap?: () => void;
  delayMs?: number;
  /** A pointer moving further than this before the delay elapses cancels the long-press (and the
   * eventual tap too) - otherwise a scroll gesture starting on a card would open the action sheet. */
  moveThresholdPx?: number;
}

/**
 * Built on Pointer Events (not separate touch/mouse handler pairs) since that's the one API that
 * unifies both, and this codebase has no earlier long-press precedent to follow either way. Spread
 * the returned handlers onto the element that should react to a long press.
 */
export function useLongPress({ onLongPress, onTap, delayMs = 500, moveThresholdPx = 10 }: UseLongPressOptions) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const firedRef = useRef(false);
  // Separate from "did the timer fire": a move past the threshold cancels the long-press timer,
  // but without this it left onTap free to fire anyway on pointer-up - exactly the case this
  // threshold exists to prevent (a scroll gesture that happens to end over the row would still
  // have opened the row's default action).
  const movedRef = useRef(false);

  const clear = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const onPointerDown = useCallback(
    (e: PointerEvent) => {
      // Ignores a second simultaneous touch (e.g. an accidental palm/second-finger contact) -
      // without this, that second pointerdown would restart the gesture mid-press.
      if (!e.isPrimary) return;
      firedRef.current = false;
      movedRef.current = false;
      startRef.current = { x: e.clientX, y: e.clientY };
      clear();
      timerRef.current = setTimeout(() => {
        firedRef.current = true;
        onLongPress();
      }, delayMs);
    },
    [clear, delayMs, onLongPress],
  );

  const onPointerMove = useCallback(
    (e: PointerEvent) => {
      const start = startRef.current;
      if (!start) return;
      if (Math.hypot(e.clientX - start.x, e.clientY - start.y) > moveThresholdPx) {
        movedRef.current = true;
        clear();
      }
    },
    [clear, moveThresholdPx],
  );

  const onPointerUp = useCallback(() => {
    clear();
    if (!firedRef.current && !movedRef.current) {
      onTap?.();
    }
  }, [clear, onTap]);

  const onPointerCancel = useCallback(() => {
    clear();
  }, [clear]);

  return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel };
}
