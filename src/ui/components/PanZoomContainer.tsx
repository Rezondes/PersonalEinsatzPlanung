import { useCallback, useRef, useState } from 'react';
import type { ReactNode, WheelEvent as ReactWheelEvent, MouseEvent as ReactMouseEvent, TouchEvent as ReactTouchEvent } from 'react';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import { useTranslation } from 'react-i18next';

const MIN_SCALE = 0.25;
const MAX_SCALE = 3;
/** Empirically comfortable: a full notch of a standard mouse wheel (deltaY ~100) moves the scale
 * by ~10%, matching typical map/canvas pan-zoom tools. */
const ZOOM_SENSITIVITY = 0.001;

interface Transform {
  scale: number;
  x: number;
  y: number;
}

const INITIAL_TRANSFORM: Transform = { scale: 1, x: 0, y: 0 };

function touchDistance(a: { clientX: number; clientY: number }, b: { clientX: number; clientY: number }): number {
  return Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);
}

interface PanZoomContainerProps {
  children: ReactNode;
}

/**
 * A fixed-size viewport the caller's children can be panned (mouse drag) and zoomed (mouse wheel)
 * within, via a single `translate(...) scale(...)` on one inner element - deliberately not native
 * scrolling, which would fight a simultaneous drag-to-pan over the same content. `@media print`
 * resets the transform unconditionally (see the sx below): a screen-only zoomed/panned state must
 * never reach the printed/exported output, which always uses the content's real, untransformed
 * layout - same reasoning as PrintPageContent.tsx's own comment on why pagination there uses actual
 * font-size/padding shrinking rather than a transform.
 */
export function PanZoomContainer({ children }: PanZoomContainerProps) {
  const { t } = useTranslation('print');
  const [transform, setTransform] = useState<Transform>(INITIAL_TRANSFORM);
  // Not state: written on every mousemove while dragging, which would otherwise re-render on
  // every pixel of movement for no benefit (the drag delta itself never needs to be displayed).
  const dragOrigin = useRef<{ pointerX: number; pointerY: number; startX: number; startY: number } | null>(null);

  const handleWheel = (e: ReactWheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    setTransform((prev) => ({
      ...prev,
      scale: Math.min(MAX_SCALE, Math.max(MIN_SCALE, prev.scale - e.deltaY * ZOOM_SENSITIVITY)),
    }));
  };

  // Window-level listeners (not onMouseMove/onMouseUp on the element itself): a fast drag easily
  // moves the pointer outside the viewport's bounds mid-gesture, which would otherwise silently
  // strand the drag in progress with no mouseup ever reaching this element to end it.
  const handleMouseMove = useCallback((e: MouseEvent) => {
    const origin = dragOrigin.current;
    if (!origin) return;
    setTransform((prev) => ({
      ...prev,
      x: origin.startX + (e.clientX - origin.pointerX),
      y: origin.startY + (e.clientY - origin.pointerY),
    }));
  }, []);

  const handleMouseUp = useCallback(() => {
    dragOrigin.current = null;
    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('mouseup', handleMouseUp);
  }, [handleMouseMove]);

  const handleMouseDown = (e: ReactMouseEvent<HTMLDivElement>) => {
    dragOrigin.current = { pointerX: e.clientX, pointerY: e.clientY, startX: transform.x, startY: transform.y };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Not state, same reasoning as dragOrigin above - only the two touch-point distance at gesture
  // start matters, not every intermediate value.
  const pinchOrigin = useRef<{ distance: number; scale: number } | null>(null);

  // Window-level listeners, mirroring the mouse handlers above - a fast pinch/drag can move a
  // finger to a screen position outside the element's bounds mid-gesture just like a mouse drag
  // can, even though touch events normally keep targeting their original element.
  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (e.touches.length === 2 && pinchOrigin.current) {
      e.preventDefault();
      const origin = pinchOrigin.current;
      const distance = touchDistance(e.touches[0], e.touches[1]);
      setTransform((prev) => ({
        ...prev,
        scale: Math.min(MAX_SCALE, Math.max(MIN_SCALE, origin.scale * (distance / origin.distance))),
      }));
      return;
    }
    const origin = dragOrigin.current;
    if (!origin || e.touches.length !== 1) return;
    e.preventDefault();
    const touch = e.touches[0];
    setTransform((prev) => ({
      ...prev,
      x: origin.startX + (touch.clientX - origin.pointerX),
      y: origin.startY + (touch.clientY - origin.pointerY),
    }));
  }, []);

  const handleTouchEnd = useCallback(() => {
    dragOrigin.current = null;
    pinchOrigin.current = null;
    window.removeEventListener('touchmove', handleTouchMove);
    window.removeEventListener('touchend', handleTouchEnd);
    window.removeEventListener('touchcancel', handleTouchEnd);
  }, [handleTouchMove]);

  const handleTouchStart = (e: ReactTouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      dragOrigin.current = { pointerX: touch.clientX, pointerY: touch.clientY, startX: transform.x, startY: transform.y };
      pinchOrigin.current = null;
    } else if (e.touches.length === 2) {
      dragOrigin.current = null;
      pinchOrigin.current = { distance: touchDistance(e.touches[0], e.touches[1]), scale: transform.scale };
    } else {
      return;
    }
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);
    window.addEventListener('touchcancel', handleTouchEnd);
  };

  const reset = () => setTransform(INITIAL_TRANSFORM);

  return (
    <Box
      sx={{
        position: 'relative',
        flex: 1,
        minHeight: 0,
        overflow: 'hidden',
        bgcolor: 'action.hover',
        '@media print': { flex: 'none', overflow: 'visible', height: 'auto', bgcolor: 'transparent' },
      }}
    >
      {/* print-action-bar: the same "hide during printing" class the Zurück/Drucken buttons use
          (see printView.css's @media print rule) - reused rather than duplicating that rule. */}
      <Tooltip title={t('resetViewLabel')}>
        <IconButton
          className="print-action-bar"
          onClick={reset}
          aria-label={t('resetViewLabel')}
          sx={{ position: 'absolute', top: 8, right: 8, zIndex: 1, bgcolor: 'background.paper', boxShadow: 1 }}
        >
          <RestartAltIcon />
        </IconButton>
      </Tooltip>
      <Box
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        data-testid="panzoom-content"
        sx={{
          // 297mm: fixed A4-landscape width (matches printView.css's `@page { size: A4 landscape }`),
          // independent of the viewport - AC1. Centered so a narrower browser window still shows the
          // page centered rather than pinned to the left edge.
          width: '297mm',
          mx: 'auto',
          transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
          transformOrigin: 'top center',
          cursor: 'grab',
          '&:active': { cursor: 'grabbing' },
          // Overrides theme.ts's global html { touchAction: 'manipulation' } (kept there to
          // preserve horizontal table scrolling elsewhere), which still lets the browser handle
          // pinch natively - the opposite of what this component needs, since it drives zoom
          // itself via handleTouchMove. touch-action is the intersection of an element's own value
          // and its ancestors', so this more restrictive value wins here without touching the
          // global rule.
          touchAction: 'none',
          '@media print': { width: 'auto', mx: 0, transform: 'none !important', cursor: 'auto' },
        }}
      >
        {children}
      </Box>
    </Box>
  );
}
