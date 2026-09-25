import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type {
  ReactNode,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  TouchEvent as ReactTouchEvent,
} from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import { useTranslation } from 'react-i18next';

const MIN_SCALE = 0.25;
const MAX_SCALE = 3;
/** Empirically comfortable: a full notch of a standard mouse wheel (deltaY ~100) moves the scale
 * by ~10%, matching typical map/canvas pan-zoom tools. */
const ZOOM_SENSITIVITY = 0.001;
/** One click on Vergrößern/Verkleinern or one +/- key press. */
const ZOOM_STEP = 0.25;
/** One arrow key press. */
const PAN_STEP = 40;
/** Breathing room left and right of a sheet scaled to fit the viewport. */
const FIT_MARGIN = 16;

interface Transform {
  scale: number;
  x: number;
  y: number;
}

const clampScale = (scale: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));

function touchDistance(a: { clientX: number; clientY: number }, b: { clientX: number; clientY: number }): number {
  return Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);
}

interface PanZoomContainerProps {
  children: ReactNode;
}

/**
 * A fixed-size viewport the caller's children can be panned (mouse drag, arrow keys) and zoomed
 * (wheel, pinch, the +/- buttons and keys) within, via a single `translate(...) scale(...)` on one
 * inner element - deliberately not native scrolling, which would fight a simultaneous drag-to-pan
 * over the same content. `@media print` resets the transform unconditionally (see the sx below): a
 * screen-only zoomed/panned state must never reach the printed/exported output, which always uses
 * the content's real, untransformed layout - same reasoning as PrintPageContent.tsx's own comment
 * on why pagination there uses actual font-size/padding shrinking rather than a transform.
 *
 * It opens scaled to the viewport's width (never above 1): at 375px the 297mm sheet used to open at
 * scale 1 with only its left third in view.
 */
export function PanZoomContainer({ children }: PanZoomContainerProps) {
  const { t } = useTranslation('print');
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  // The start and reset scale; measured once the sheet has its real width.
  const fitScale = useRef(1);
  const [transform, setTransform] = useState<Transform>({ scale: 1, x: 0, y: 0 });
  // Not state: written on every mousemove while dragging, which would otherwise re-render on
  // every pixel of movement for no benefit (the drag delta itself never needs to be displayed).
  const dragOrigin = useRef<{ pointerX: number; pointerY: number; startX: number; startY: number } | null>(null);

  useLayoutEffect(() => {
    const viewportWidth = viewportRef.current?.clientWidth ?? 0;
    const contentWidth = contentRef.current?.offsetWidth ?? 0;
    // jsdom (and a not yet laid out tree) reports 0: keep scale 1 then.
    if (!viewportWidth || !contentWidth) return;
    fitScale.current = clampScale(Math.min(1, (viewportWidth - FIT_MARGIN) / contentWidth));
    setTransform({ scale: fitScale.current, x: 0, y: 0 });
  }, []);

  // A native listener, not onWheel: React registers wheel listeners as passive, so preventDefault
  // there does nothing and a trackpad pinch (a ctrl+wheel) zoomed the whole page along with this.
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      setTransform((prev) => ({ ...prev, scale: clampScale(prev.scale - e.deltaY * ZOOM_SENSITIVITY) }));
    };
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, []);

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
      setTransform((prev) => ({ ...prev, scale: clampScale(origin.scale * (distance / origin.distance)) }));
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

  const reset = () => setTransform({ scale: fitScale.current, x: 0, y: 0 });
  const zoomBy = (delta: number) => setTransform((prev) => ({ ...prev, scale: clampScale(prev.scale + delta) }));
  const panBy = (dx: number, dy: number) => setTransform((prev) => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));

  // Keyboard users had no way to zoom or reach the parts of the sheet outside the frame.
  const handleKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const actions: Record<string, () => void> = {
      '+': () => zoomBy(ZOOM_STEP),
      '=': () => zoomBy(ZOOM_STEP),
      '-': () => zoomBy(-ZOOM_STEP),
      '0': reset,
      // The arrow moves the view, so the sheet moves the other way.
      ArrowRight: () => panBy(-PAN_STEP, 0),
      ArrowLeft: () => panBy(PAN_STEP, 0),
      ArrowDown: () => panBy(0, -PAN_STEP),
      ArrowUp: () => panBy(0, PAN_STEP),
    };
    const action = actions[e.key];
    if (!action) return;
    e.preventDefault();
    action();
  };

  const controls: { label: string; icon: ReactNode; onClick: () => void }[] = [
    { label: t('zoomInLabel'), icon: <ZoomInIcon />, onClick: () => zoomBy(ZOOM_STEP) },
    { label: t('zoomOutLabel'), icon: <ZoomOutIcon />, onClick: () => zoomBy(-ZOOM_STEP) },
    { label: t('resetViewLabel'), icon: <RestartAltIcon />, onClick: reset },
  ];

  return (
    <Box
      ref={viewportRef}
      role="region"
      aria-label={t('previewRegionLabel')}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      sx={{
        position: 'relative',
        flex: 1,
        minHeight: 0,
        overflow: 'hidden',
        // Flex centring, not margin:auto: a sheet wider than the viewport then overflows evenly on
        // both sides, so scaling it around its top centre keeps it in view.
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
        bgcolor: 'action.hover',
        '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: -2 },
        '@media print': { display: 'block', flex: 'none', overflow: 'visible', height: 'auto', bgcolor: 'transparent' },
      }}
    >
      {/* print-action-bar: the same "hide during printing" class the Zurück/Drucken buttons use
          (see printView.css's @media print rule) - reused rather than duplicating that rule. */}
      <Stack
        direction="row"
        spacing={1}
        className="print-action-bar"
        sx={{ position: 'absolute', top: 8, right: 8, zIndex: 1 }}
      >
        {controls.map((control) => (
          <Tooltip key={control.label} title={control.label}>
            <IconButton
              onClick={control.onClick}
              aria-label={control.label}
              sx={{ bgcolor: 'background.paper', boxShadow: 1 }}
            >
              {control.icon}
            </IconButton>
          </Tooltip>
        ))}
      </Stack>
      <Box
        ref={contentRef}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        data-testid="panzoom-content"
        sx={{
          // 297mm: fixed A4-landscape width (matches printView.css's `@page { size: A4 landscape }`),
          // independent of the viewport - AC1.
          width: '297mm',
          flexShrink: 0,
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
