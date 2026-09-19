import { useCallback, useRef, useState } from 'react';
import type { ReactNode, WheelEvent as ReactWheelEvent, MouseEvent as ReactMouseEvent } from 'react';
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
          '@media print': { width: 'auto', mx: 0, transform: 'none !important', cursor: 'auto' },
        }}
      >
        {children}
      </Box>
    </Box>
  );
}
